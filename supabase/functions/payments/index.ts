// =====================================================================
// ShieldPay — Payments Edge Function
// Endpoint: https://rnplqhlwvnqrghrjvylx.supabase.co/functions/v1/payments
// Handles: execute payment via KCB Buni (M-Pesa) or Stanbic PesaLink
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// KCB Buni
const BUNI_ENV         = Deno.env.get("BUNI_ENV") || "sandbox";          // "sandbox" | "production"
const BUNI_CLIENT_ID   = Deno.env.get("BUNI_CLIENT_ID")!;
const BUNI_SECRET      = Deno.env.get("BUNI_CLIENT_SECRET")!;
const BUNI_SHORTCODE   = Deno.env.get("BUNI_SHORTCODE")!;
const BUNI_PASSKEY     = Deno.env.get("BUNI_PASSKEY")!;

// Stanbic PesaLink
const STANBIC_ENV      = Deno.env.get("STANBIC_ENV") || "sandbox";
const STANBIC_ID       = Deno.env.get("STANBIC_CLIENT_ID")!;
const STANBIC_SECRET   = Deno.env.get("STANBIC_CLIENT_SECRET")!;
const STANBIC_ACCOUNT  = Deno.env.get("STANBIC_ACCOUNT_NO")!;

const BUNI_BASE    = BUNI_ENV    === "production" ? "https://uat.buni.kcbgroup.com" : "https://uat.buni.kcbgroup.com";
const STANBIC_BASE = STANBIC_ENV === "production" ? "https://api.stanbicbank.co.ke" : "https://sandbox.stanbicbank.co.ke";

const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/callback`;

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── KCB Buni — get OAuth token ──────────────────────────────────────────────
async function getBuniToken(): Promise<string> {
  const res = await fetch(`${BUNI_BASE}/token?grant_type=client_credentials`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${BUNI_CLIENT_ID}:${BUNI_SECRET}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Buni token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ─── KCB Buni — STK Push (Paybill / Till) ────────────────────────────────────
async function buniStkPush(token: string, opts: {
  amount: number; phone: string; accountRef: string; description: string; paymentRequestId: string;
}) {
  const ts       = new Date().toISOString().replace(/[^0-9]/g,"").slice(0,14);
  const password = btoa(`${BUNI_SHORTCODE}${BUNI_PASSKEY}${ts}`);
  const res = await fetch(`${BUNI_BASE}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: BUNI_SHORTCODE,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(opts.amount),
      PartyA: opts.phone.replace(/^0/, "254"),
      PartyB: BUNI_SHORTCODE,
      PhoneNumber: opts.phone.replace(/^0/, "254"),
      CallBackURL: `${CALLBACK_URL}?type=buni_stk&id=${opts.paymentRequestId}`,
      AccountReference: opts.accountRef.slice(0,12),
      TransactionDesc: opts.description.slice(0,20),
    }),
  });
  return res.json();
}

// ─── KCB Buni — B2B Paybill Payment ─────────────────────────────────────────
async function buniB2BPaybill(token: string, opts: {
  amount: number; paybillNo: string; accountRef: string; description: string; paymentRequestId: string;
}) {
  const ts       = new Date().toISOString().replace(/[^0-9]/g,"").slice(0,14);
  const password = btoa(`${BUNI_SHORTCODE}${BUNI_PASSKEY}${ts}`);
  const res = await fetch(`${BUNI_BASE}/mpesa/b2b/v1/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      Initiator: "ShieldPay",
      SecurityCredential: password,
      CommandID: "BusinessPayBill",
      Amount: Math.round(opts.amount),
      PartyA: BUNI_SHORTCODE,
      PartyB: opts.paybillNo,
      AccountReference: opts.accountRef.slice(0,12),
      Remarks: opts.description.slice(0,100),
      QueueTimeOutURL: `${CALLBACK_URL}?type=buni_b2b_timeout&id=${opts.paymentRequestId}`,
      ResultURL: `${CALLBACK_URL}?type=buni_b2b&id=${opts.paymentRequestId}`,
    }),
  });
  return res.json();
}

// ─── KCB Buni — B2C (Send Money) ─────────────────────────────────────────────
async function buniB2C(token: string, opts: {
  amount: number; phone: string; description: string; paymentRequestId: string;
}) {
  const res = await fetch(`${BUNI_BASE}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      InitiatorName: "ShieldPay",
      SecurityCredential: btoa(`${BUNI_SHORTCODE}${BUNI_PASSKEY}`),
      CommandID: "BusinessPayment",
      Amount: Math.round(opts.amount),
      PartyA: BUNI_SHORTCODE,
      PartyB: opts.phone.replace(/^0/, "254"),
      Remarks: opts.description.slice(0,100),
      QueueTimeOutURL: `${CALLBACK_URL}?type=buni_b2c_timeout&id=${opts.paymentRequestId}`,
      ResultURL: `${CALLBACK_URL}?type=buni_b2c&id=${opts.paymentRequestId}`,
      Occasion: opts.paymentRequestId,
    }),
  });
  return res.json();
}

// ─── Stanbic PesaLink ─────────────────────────────────────────────────────────
async function getStanbicToken(): Promise<string> {
  const res = await fetch(`${STANBIC_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${STANBIC_ID}:${STANBIC_SECRET}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Stanbic token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function pesaLinkTransfer(token: string, opts: {
  amount: number; recipientAccount: string; recipientBank: string; bankCode: string;
  recipientName: string; description: string; paymentRequestId: string;
}) {
  const res = await fetch(`${STANBIC_BASE}/pesalink/v1/transfer`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceAccount: STANBIC_ACCOUNT,
      destinationAccount: opts.recipientAccount,
      destinationBank: opts.bankCode,
      amount: opts.amount,
      currency: "KES",
      // 🚀 Viral loop: receipt footer branded with ShieldPay
      narration: opts.description.slice(0, 140),
      referenceNumber: opts.paymentRequestId.slice(0, 20),
      callbackUrl: `${CALLBACK_URL}?type=pesalink&id=${opts.paymentRequestId}`,
    }),
  });
  return res.json();
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  try {
    const { action, payment_request_id } = await req.json();

    if (action !== "execute") {
      return new Response(JSON.stringify({ success: false, error: "Unknown action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Load payment request + supplier
    const { data: pr, error: prErr } = await sb
      .from("payment_requests")
      .select("*, supplier:suppliers(*), business:businesses(*)")
      .eq("id", payment_request_id)
      .single();

    if (prErr || !pr) throw new Error(`Payment request not found: ${prErr?.message}`);
    if (!["approved","scheduled"].includes(pr.status)) throw new Error(`Cannot execute — status is ${pr.status}`);

    const sup = pr.supplier;
    const biz = pr.business;
    const method: string = pr.payment_method;

    let result: any;

    // ── KCB Buni M-Pesa ──────────────────────────────────────────────────────
    if (["kcb_paybill", "kcb_till", "kcb_mobile"].includes(method)) {
      const token = await getBuniToken();

      if (method === "kcb_mobile") {
        const phone = pr.account_ref || sup.phone_number;
        result = await buniB2C(token, {
          amount: pr.amount, phone, description: pr.title, paymentRequestId: pr.id,
        });

      } else if (method === "kcb_paybill") {
        const paybillNo = sup.paybill_number;
        const accountRef = pr.account_ref || sup.account_number || pr.id;
        result = await buniB2BPaybill(token, {
          amount: pr.amount, paybillNo, accountRef, description: pr.title, paymentRequestId: pr.id,
        });

      } else if (method === "kcb_till") {
        // Till — use STK-like B2B to till
        result = await buniB2BPaybill(token, {
          amount: pr.amount, paybillNo: sup.till_number, accountRef: pr.account_ref || pr.id,
          description: pr.title, paymentRequestId: pr.id,
        });
      }

      // Store checkout request ID for callback matching
      const checkoutId = result?.CheckoutRequestID || result?.ConversationID;
      await sb.from("payment_requests").update({
        status: "executing",
        stk_checkout_id: checkoutId || null,
        executed_at: new Date().toISOString(),
      }).eq("id", pr.id);

      await sb.from("audit_logs").insert({
        business_id: pr.business_id, action: "payment.buni_initiated",
        entity_type: "payment_request", entity_id: pr.id,
        details: { method, amount: pr.amount, result_code: result?.ResponseCode, checkout_id: checkoutId },
      });

      if (result?.ResponseCode !== "0" && result?.errorCode) {
        await sb.from("payment_requests").update({
          status: "failed", failure_reason: result?.errorMessage || JSON.stringify(result),
        }).eq("id", pr.id);
        throw new Error(result?.errorMessage || "KCB Buni error");
      }
    }

    // ── Stanbic PesaLink ─────────────────────────────────────────────────────
    else if (method === "pesalink") {
      const token = await getStanbicToken();
      result = await pesaLinkTransfer(token, {
        amount: pr.amount,
        recipientAccount: pr.account_ref || sup.bank_account,
        recipientBank: sup.bank_name,
        bankCode: sup.bank_code || "01",
        recipientName: sup.name,
        description: pr.title,
        paymentRequestId: pr.id,
      });

      const txRef = result?.transactionReference || result?.referenceNumber;

      if (result?.status === "success" || result?.responseCode === "00") {
        await sb.from("payment_requests").update({
          status: "completed", bank_reference: txRef, completed_at: new Date().toISOString(),
        }).eq("id", pr.id);
        await sb.from("payment_schedules").update({ last_paid_date: new Date().toISOString().split("T")[0] }).eq("id", pr.schedule_id);
      } else {
        await sb.from("payment_requests").update({ status: "executing", bank_reference: txRef || null, executed_at: new Date().toISOString() }).eq("id", pr.id);
      }

      await sb.from("audit_logs").insert({
        business_id: pr.business_id, action: "payment.pesalink_initiated",
        entity_type: "payment_request", entity_id: pr.id,
        details: { amount: pr.amount, reference: txRef },
      });
    }

    else {
      throw new Error(`Unknown payment method: ${method}`);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("payments edge fn error:", err);
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
