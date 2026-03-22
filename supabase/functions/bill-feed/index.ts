// ============================================================
// Dion Bill Feed Edge Function
// POST /bill-feed/pull     — pull from QB/Zoho into external_bills
// POST /bill-feed/manual   — manually add a bill to the feed
// POST /bill-feed/accept   — accept a feed bill → create schedule
// POST /bill-feed/skip     — skip/dismiss a feed bill
// GET  /bill-feed/pending  — get pending bills for a business
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON    = Deno.env.get("SUPABASE_ANON_KEY")!;

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE);

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await createClient(SUPABASE_URL, SUPABASE_ANON).auth.getUser(token);
  return user;
}

// ─── Pull bills from QB/Zoho → populate external_bills ───────
async function pullBillsIntoFeed(
  integrationId: string,
  businessId:    string,
  daysBack = 45
): Promise<{ inserted: number; skipped: number }> {
  const { data: integ } = await supa
    .from("accounting_integrations")
    .select("provider, status")
    .eq("id", integrationId)
    .single();

  if (!integ || integ.status !== "active") throw new Error("Integration not active");

  // Call the accounting-sync function to get normalised bills
  const syncRes = await fetch(`${SUPABASE_URL}/functions/v1/accounting-sync/sync/pull`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE}`,
    },
    body: JSON.stringify({ integrationId, returnBills: true }),
  });

  if (!syncRes.ok) throw new Error(`Sync pull failed: ${await syncRes.text()}`);
  const { bills = [] } = await syncRes.json();

  let inserted = 0;
  let skipped  = 0;

  for (const bill of bills) {
    // Upsert into external_bills — idempotent
    const { error } = await supa.from("external_bills").upsert({
      business_id:    businessId,
      integration_id: integrationId,
      provider:       integ.provider,
      external_id:    bill.externalId,
      doc_number:     bill.docNumber,
      vendor_id:      bill.vendorId,
      vendor_name:    bill.vendorName,
      vendor_email:   bill.vendorEmail,
      vendor_kra_pin: bill.vendorKraPin,
      total_amount:   bill.totalAmount,
      tax_amount:     bill.taxAmount,
      net_amount:     bill.netAmount,
      currency:       bill.currency,
      due_date:       bill.dueDate,
      bill_date:      bill.txnDate,
      description:    bill.description,
      line_items:     bill.lineItems,
      attachment_url: bill.attachmentUrl,
      kra_pin_missing: !bill.vendorKraPin,
      raw_payload:    bill.rawPayload,
      status:         "pending",
    }, { onConflict: "integration_id,external_id", ignoreDuplicates: false });

    if (error) {
      console.error(`external_bills upsert error: ${error.message}`);
    } else {
      inserted++;
    }
  }

  // Notify business about new feed items
  if (inserted > 0) {
    await supa.from("notifications").insert({
      business_id: businessId,
      type:        "feed_bills_ready",
      title:       `${inserted} new bill${inserted > 1 ? "s" : ""} ready to review`,
      message:     `${integ.provider === "quickbooks" ? "QuickBooks" : "Zoho Books"} has ${inserted} open bill${inserted > 1 ? "s" : ""} waiting for your review in the Bills feed.`,
      entity_type: "external_bill",
      action_url:  "/bills?tab=feed",
    });
  }

  return { inserted, skipped };
}

// ─── Main handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url  = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1\/bill-feed/, "");

  try {
    // ── Pull from accounting tool into feed ──────────────────
    // POST /pull  { integrationId, businessId, daysBack? }
    if (path === "/pull" && req.method === "POST") {
      const user = await getUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const { integrationId, businessId, daysBack } = await req.json();
      const result = await pullBillsIntoFeed(integrationId, businessId, daysBack ?? 45);
      return json({ ok: true, ...result });
    }

    // ── Manual bill entry (no accounting tool needed) ────────
    // POST /manual  { businessId, vendorName, totalAmount, dueDate, ... }
    if (path === "/manual" && req.method === "POST") {
      const user = await getUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const body = await req.json();
      const {
        businessId, vendorName, totalAmount, dueDate,
        taxAmount = 0, description, supplierId,
        attachmentUrl, docNumber,
      } = body;

      if (!vendorName || !totalAmount || !dueDate || !businessId) {
        return json({ error: "vendorName, totalAmount, dueDate, businessId required" }, 400);
      }

      // Find integration for "manual" provider — use a dummy integration or null
      const { data: integ } = await supa
        .from("accounting_integrations")
        .select("id")
        .eq("business_id", businessId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      // For manual, we directly create external_bill with provider='manual'
      const { data: bill, error } = await supa.from("external_bills").insert({
        business_id:    businessId,
        integration_id: integ?.id ?? "00000000-0000-0000-0000-000000000000",
        provider:       "manual",
        external_id:    `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        doc_number:     docNumber,
        vendor_name:    vendorName,
        total_amount:   Number(totalAmount),
        tax_amount:     Number(taxAmount),
        net_amount:     Number(totalAmount) - Number(taxAmount),
        currency:       "KES",
        due_date:       dueDate,
        bill_date:      new Date().toISOString().split("T")[0],
        description,
        attachment_url: attachmentUrl,
        kra_pin_missing: true,
        status:         "pending",
      }).select().single();

      if (error) return json({ error: error.message }, 500);

      // If supplier provided, auto-accept immediately
      if (supplierId) {
        const { data: schedId } = await supa.rpc("accept_external_bill", {
          p_bill_id:    bill.id,
          p_user_id:    user.id,
          p_supplier_id: supplierId,
        });
        return json({ ok: true, billId: bill.id, scheduleId: schedId, autoAccepted: true });
      }

      return json({ ok: true, billId: bill.id });
    }

    // ── Accept a feed bill → create payment schedule ─────────
    // POST /accept  { billId, supplierId?, paymentMethod? }
    if (path === "/accept" && req.method === "POST") {
      const user = await getUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const { billId, supplierId, paymentMethod } = await req.json();
      if (!billId) return json({ error: "billId required" }, 400);

      const { data: scheduleId, error } = await supa.rpc("accept_external_bill", {
        p_bill_id:     billId,
        p_user_id:     user.id,
        p_method:      paymentMethod ?? null,
        p_supplier_id: supplierId ?? null,
      });

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, scheduleId });
    }

    // ── Skip / dismiss a feed bill ───────────────────────────
    // POST /skip  { billId, reason? }
    if (path === "/skip" && req.method === "POST") {
      const user = await getUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const { billId, reason } = await req.json();
      await supa.from("external_bills").update({
        status:      "skipped",
        reviewed_by:  user.id,
        reviewed_at:  new Date().toISOString(),
        description:  reason ?? null,
      }).eq("id", billId);

      return json({ ok: true });
    }

    // ── Get pending bills for a business ────────────────────
    // GET /pending?businessId=xxx
    if (path === "/pending" && req.method === "GET") {
      const user = await getUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const businessId = url.searchParams.get("businessId");
      if (!businessId) return json({ error: "businessId required" }, 400);

      const { data, error } = await supa
        .from("external_bills")
        .select("*")
        .eq("business_id", businessId)
        .eq("status", "pending")
        .order("due_date", { ascending: true });

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, bills: data });
    }

    return json({ error: "Not found" }, 404);
  } catch (e: any) {
    console.error("bill-feed error:", e);
    return json({ error: e.message }, 500);
  }
});
