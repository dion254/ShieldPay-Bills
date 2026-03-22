// =====================================================================
// ShieldPay — Payment Callback Edge Function
// Endpoint: https://rnplqhlwvnqrghrjvylx.supabase.co/functions/v1/callback
// Handles: KCB Buni STK/B2B/B2C callbacks + Stanbic PesaLink callbacks
// This URL must be registered with KCB Buni (Charles Murage) and Stanbic
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "unknown";
  const paymentRequestId = url.searchParams.get("id");

  let body: any = {};
  try { body = await req.json(); } catch (_) {}

  console.log(`[callback] type=${type} id=${paymentRequestId}`, JSON.stringify(body));

  try {
    // ── KCB Buni STK Push callback ──────────────────────────────────────────
    if (type === "buni_stk") {
      const stk = body?.Body?.stkCallback;
      if (!stk) return new Response("bad callback", { status: 400 });

      const resultCode = stk.ResultCode;
      const items      = stk.CallbackMetadata?.Item || [];
      const getItem    = (name: string) => items.find((i: any) => i.Name === name)?.Value;

      if (resultCode === 0) {
        const receipt    = getItem("MpesaReceiptNumber");
        const transDate  = getItem("TransactionDate");
        await sb.from("payment_requests").update({
          status:       "completed",
          mpesa_receipt: receipt || null,
          completed_at: new Date().toISOString(),
        }).eq("id", paymentRequestId);

        // Update schedule last paid date
        const { data: pr } = await sb.from("payment_requests").select("schedule_id, business_id").eq("id", paymentRequestId).single();
        if (pr?.schedule_id) {
          await sb.from("payment_schedules").update({ last_paid_date: new Date().toISOString().split("T")[0] }).eq("id", pr.schedule_id);
        }
        if (pr?.business_id) {
          await notifyBusiness(sb, pr.business_id, paymentRequestId!, "payment_completed", "Payment completed", `M-Pesa receipt: ${receipt}`);
        }
      } else {
        const reason = stk.ResultDesc || `ResultCode: ${resultCode}`;
        await sb.from("payment_requests").update({ status: "failed", failure_reason: reason }).eq("id", paymentRequestId);
        const { data: pr } = await sb.from("payment_requests").select("business_id").eq("id", paymentRequestId).single();
        if (pr?.business_id) {
          await notifyBusiness(sb, pr.business_id, paymentRequestId!, "payment_failed", "Payment failed", reason);
        }
      }

      await sb.from("audit_logs").insert({
        action: "payment.buni_stk_callback", entity_type: "payment_request", entity_id: paymentRequestId,
        details: { result_code: resultCode, stk },
      });
    }

    // ── KCB Buni B2B callback ───────────────────────────────────────────────
    else if (type === "buni_b2b") {
      const result = body?.Result;
      if (!result) return new Response("bad callback", { status: 400 });

      const code = result.ResultCode;
      if (code === 0) {
        const params  = result.ResultParameters?.ResultParameter || [];
        const getP    = (key: string) => params.find((p: any) => p.Key === key)?.Value;
        const receipt = getP("TransactionID") || getP("ConversationID");
        await sb.from("payment_requests").update({
          status: "completed", mpesa_receipt: receipt || null, completed_at: new Date().toISOString(),
        }).eq("id", paymentRequestId);

        const { data: pr } = await sb.from("payment_requests").select("schedule_id, business_id").eq("id", paymentRequestId).single();
        if (pr?.schedule_id) await sb.from("payment_schedules").update({ last_paid_date: new Date().toISOString().split("T")[0] }).eq("id", pr.schedule_id);
        if (pr?.business_id) await notifyBusiness(sb, pr.business_id, paymentRequestId!, "payment_completed", "Payment completed", `Receipt: ${receipt}`);
      } else {
        const reason = result.ResultDesc || `Code ${code}`;
        await sb.from("payment_requests").update({ status: "failed", failure_reason: reason }).eq("id", paymentRequestId);
        const { data: pr } = await sb.from("payment_requests").select("business_id").eq("id", paymentRequestId).single();
        if (pr?.business_id) await notifyBusiness(sb, pr.business_id, paymentRequestId!, "payment_failed", "B2B payment failed", reason);
      }

      await sb.from("audit_logs").insert({
        action: "payment.buni_b2b_callback", entity_type: "payment_request", entity_id: paymentRequestId,
        details: { result_code: code, result },
      });
    }

    // ── KCB Buni B2C callback ───────────────────────────────────────────────
    else if (type === "buni_b2c") {
      const result = body?.Result;
      const code   = result?.ResultCode;

      if (code === 0) {
        const params  = result.ResultParameters?.ResultParameter || [];
        const getP    = (key: string) => params.find((p: any) => p.Key === key)?.Value;
        const receipt = getP("TransactionID") || getP("ConversationID");
        await sb.from("payment_requests").update({
          status: "completed", mpesa_receipt: receipt || null, completed_at: new Date().toISOString(),
        }).eq("id", paymentRequestId);

        const { data: pr } = await sb.from("payment_requests").select("schedule_id, business_id").eq("id", paymentRequestId).single();
        if (pr?.schedule_id) await sb.from("payment_schedules").update({ last_paid_date: new Date().toISOString().split("T")[0] }).eq("id", pr.schedule_id);
        if (pr?.business_id) await notifyBusiness(sb, pr.business_id, paymentRequestId!, "payment_completed", "B2C payment completed", `Receipt: ${receipt}`);
      } else {
        const reason = result?.ResultDesc || `Code ${code}`;
        await sb.from("payment_requests").update({ status: "failed", failure_reason: reason }).eq("id", paymentRequestId);
      }

      await sb.from("audit_logs").insert({
        action: "payment.buni_b2c_callback", entity_type: "payment_request", entity_id: paymentRequestId,
        details: { result_code: code },
      });
    }

    // ── Timeout callbacks ───────────────────────────────────────────────────
    else if (type === "buni_b2b_timeout" || type === "buni_b2c_timeout") {
      await sb.from("payment_requests").update({ status: "failed", failure_reason: "Gateway timeout — please retry" }).eq("id", paymentRequestId);
      await sb.from("audit_logs").insert({ action: `payment.${type}`, entity_type: "payment_request", entity_id: paymentRequestId, details: body });
    }

    // ── Stanbic PesaLink callback ───────────────────────────────────────────
    else if (type === "pesalink") {
      const status = body?.status || body?.responseCode;
      const ref    = body?.transactionReference || body?.referenceNumber;

      if (status === "success" || status === "00") {
        await sb.from("payment_requests").update({
          status: "completed", bank_reference: ref || null, completed_at: new Date().toISOString(),
        }).eq("id", paymentRequestId);

        const { data: pr } = await sb.from("payment_requests").select("schedule_id, business_id").eq("id", paymentRequestId).single();
        if (pr?.schedule_id) await sb.from("payment_schedules").update({ last_paid_date: new Date().toISOString().split("T")[0] }).eq("id", pr.schedule_id);
        if (pr?.business_id) await notifyBusiness(sb, pr.business_id, paymentRequestId!, "payment_completed", "PesaLink transfer completed", `Reference: ${ref}`);
      } else {
        const reason = body?.message || body?.description || `PesaLink status: ${status}`;
        await sb.from("payment_requests").update({ status: "failed", failure_reason: reason, bank_reference: ref || null }).eq("id", paymentRequestId);
        const { data: pr } = await sb.from("payment_requests").select("business_id").eq("id", paymentRequestId).single();
        if (pr?.business_id) await notifyBusiness(sb, pr.business_id, paymentRequestId!, "payment_failed", "PesaLink transfer failed", reason);
      }

      await sb.from("audit_logs").insert({
        action: "payment.pesalink_callback", entity_type: "payment_request", entity_id: paymentRequestId,
        details: { status, reference: ref, body },
      });
    }

    else {
      console.log(`[callback] unhandled type=${type}`, body);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[callback] error:", err);
    return new Response(JSON.stringify({ error: err?.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

// ─── Helper: notify all admins/owners of a business ──────────────────────────
async function notifyBusiness(sb: any, businessId: string, entityId: string, type: string, title: string, message: string) {
  const { data: admins } = await sb.from("business_members")
    .select("user_id").eq("business_id", businessId)
    .in("role", ["owner","admin","finance_manager"]).eq("status","active");

  await Promise.all((admins || []).map((m: any) =>
    sb.from("notifications").insert({ business_id: businessId, user_id: m.user_id, type, title, message, entity_id: entityId })
  ));
}
