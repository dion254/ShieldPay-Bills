// ============================================================
// Dion Sync — Zoho Books Adapter (Supabase Edge Function)
// Zoho Books API v3 — Kenya org, KES currency, EAT timezone
// Zoho OAuth2 uses refresh tokens valid for 1 year
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  NormalisedBill, NormalisedLineItem, PaymentPushPayload, OAuthState
} from "../../src/lib/sync-types.ts";

const ZOHO_CLIENT_ID     = Deno.env.get("ZOHO_CLIENT_ID")!;
const ZOHO_CLIENT_SECRET = Deno.env.get("ZOHO_CLIENT_SECRET")!;
const ZOHO_REDIRECT_URI  = Deno.env.get("ZOHO_REDIRECT_URI")!;
const ENCRYPT_KEY        = Deno.env.get("TOKEN_ENCRYPT_KEY")!;
const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Zoho's Kenya/Africa server is .com (not .eu or .in)
const ZOHO_ACCOUNTS_URL  = "https://accounts.zoho.com";
const ZOHO_BOOKS_URL     = "https://www.zohoapis.com/books/v3";

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// ─── Token helpers (same pgcrypto RPC as QB adapter) ─────────
async function encryptToken(plain: string): Promise<string> {
  const { data, error } = await supa.rpc("encrypt_token", { p_plaintext: plain, p_key: ENCRYPT_KEY });
  if (error) throw new Error(`encrypt_token: ${error.message}`);
  return data as string;
}
async function decryptToken(cipher: string): Promise<string> {
  const { data, error } = await supa.rpc("decrypt_token", { p_ciphertext: cipher, p_key: ENCRYPT_KEY });
  if (error) throw new Error(`decrypt_token: ${error.message}`);
  return data as string;
}

// ─── Step 1: Build Zoho OAuth URL ────────────────────────────
export function buildZohoAuthUrl(state: OAuthState): string {
  const params = new URLSearchParams({
    client_id:     ZOHO_CLIENT_ID,
    redirect_uri:  ZOHO_REDIRECT_URI,
    response_type: "code",
    scope:         "ZohoBooks.bills.READ,ZohoBooks.bills.CREATE,ZohoBooks.vendorpayments.READ,ZohoBooks.vendorpayments.CREATE,ZohoBooks.contacts.READ",
    access_type:   "offline",   // required for refresh token
    prompt:        "consent",
    state:         btoa(JSON.stringify(state)),
  });
  return `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?${params.toString()}`;
}

// ─── Step 2: Handle Zoho OAuth callback ──────────────────────
export async function handleZohoCallback(
  code: string,
  stateRaw: string
): Promise<void> {
  const state: OAuthState = JSON.parse(atob(stateRaw));
  if (state.provider !== "zoho") throw new Error("Provider mismatch");
  if (Date.now() > state.expiresAt) throw new Error("OAuth state expired");

  const tokenRes = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      redirect_uri:  ZOHO_REDIRECT_URI,
      code,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Zoho token exchange failed: ${err}`);
  }

  const tokens = await tokenRes.json();
  if (tokens.error) throw new Error(`Zoho OAuth error: ${tokens.error}`);

  // Fetch the organization list (to get organization_id)
  const orgRes = await fetch(`${ZOHO_BOOKS_URL}/organizations`, {
    headers: { Authorization: `Zoho-oauthtoken ${tokens.access_token}` },
  });
  const orgData = await orgRes.json();
  // Pick the first active org (or the one matching Kenya)
  const orgs: any[] = orgData.organizations ?? [];
  const org = orgs.find((o: any) => o.country_code === "KE") ?? orgs[0];
  if (!org) throw new Error("No Zoho Books organization found");

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  const [encAccess, encRefresh] = await Promise.all([
    encryptToken(tokens.access_token),
    encryptToken(tokens.refresh_token),
  ]);

  const { error } = await supa
    .from("accounting_integrations")
    .upsert({
      business_id:         state.businessId,
      provider:            "zoho",
      access_token_enc:    encAccess,
      refresh_token_enc:   encRefresh,
      token_expires_at:    expiresAt,
      organization_id:     org.organization_id,
      zoho_server_domain:  ZOHO_BOOKS_URL,
      status:              "active",
      consecutive_errors:  0,
      created_by:          state.userId,
      updated_at:          new Date().toISOString(),
    }, { onConflict: "business_id,provider" });

  if (error) throw new Error(`DB upsert failed: ${error.message}`);
}

// ─── Token refresh ────────────────────────────────────────────
async function refreshZohoToken(integrationId: string): Promise<string> {
  const { data: row } = await supa
    .from("accounting_integrations")
    .select("refresh_token_enc")
    .eq("id", integrationId)
    .single();

  if (!row) throw new Error("Integration not found");
  const refreshToken = await decryptToken(row.refresh_token_enc);

  const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    await supa.from("accounting_integrations").update({
      status: "error",
      last_error: "Zoho token refresh failed — user must reconnect",
    }).eq("id", integrationId);
    throw new Error("Zoho token refresh failed");
  }

  const tokens = await res.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  const encAccess = await encryptToken(tokens.access_token);
  await supa.from("accounting_integrations").update({
    access_token_enc: encAccess,
    token_expires_at: expiresAt,
    status:           "active",
    consecutive_errors: 0,
  }).eq("id", integrationId);

  return tokens.access_token;
}

// ─── Get valid Zoho token ─────────────────────────────────────
async function getZohoToken(integrationId: string): Promise<{ token: string; orgId: string }> {
  const { data: row } = await supa
    .from("accounting_integrations")
    .select("access_token_enc, token_expires_at, organization_id, status")
    .eq("id", integrationId)
    .single();

  if (!row) throw new Error("Integration not found");
  if (row.status === "revoked") throw new Error("Integration revoked");

  const expiresAt = new Date(row.token_expires_at).getTime();
  let token: string;

  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    token = await refreshZohoToken(integrationId);
  } else {
    token = await decryptToken(row.access_token_enc);
  }

  return { token, orgId: row.organization_id! };
}

// ─── Zoho API helpers ─────────────────────────────────────────
async function zohoGet(
  token: string, orgId: string, endpoint: string, params: Record<string, string> = {}
): Promise<Record<string, unknown>> {
  const url = new URL(`${ZOHO_BOOKS_URL}${endpoint}`);
  url.searchParams.set("organization_id", orgId);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function zohoPost(
  token: string, orgId: string, endpoint: string, body: unknown
): Promise<Record<string, unknown>> {
  const url = `${ZOHO_BOOKS_URL}${endpoint}?organization_id=${orgId}`;
  const res = await fetch(url, {
    method:  "POST",
    headers: {
      Authorization:  `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoho POST ${endpoint} failed ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Pull open bills from Zoho Books ─────────────────────────
export async function pullZohoBills(
  integrationId: string,
  daysBack = 30
): Promise<NormalisedBill[]> {
  const t0 = Date.now();
  const { token, orgId } = await getZohoToken(integrationId);
  const { data: integ } = await supa
    .from("accounting_integrations")
    .select("business_id")
    .eq("id", integrationId)
    .single();

  // EAT = UTC+3 — use date filter relative to today in Nairobi time
  const since = new Date(Date.now() - daysBack * 86400_000)
    .toISOString().split("T")[0];

  const data = await zohoGet(token, orgId, "/bills", {
    status:       "open",               // Zoho: open = unpaid
    date_after:   since,
    sort_column:  "due_date",
    sort_order:   "A",
    per_page:     "200",
  });

  const bills: any[] = (data as any).bills ?? [];

  // Fetch line items for each bill (Zoho omits them in list view)
  const normalised = await Promise.all(bills.map(async (b: any): Promise<NormalisedBill> => {
    // Fetch full bill details for line items
    let lineItems: NormalisedLineItem[] = [];
    try {
      const detail = await zohoGet(token, orgId, `/bills/${b.bill_id}`);
      const fullBill = (detail as any).bill;
      lineItems = (fullBill?.line_items ?? []).map((l: any): NormalisedLineItem => ({
        description: l.description,
        amount:      parseFloat(l.total ?? "0"),
        taxAmount:   parseFloat(l.tax_amount ?? "0"),
        accountId:   l.account_id,
        accountName: l.account_name,
      }));
    } catch { /* non-critical; continue without line items */ }

    return {
      externalId:    b.bill_id,
      docNumber:     b.bill_number,
      vendorId:      b.vendor_id,
      vendorName:    b.vendor_name,
      vendorKraPin:  b.vendor_id ? undefined : undefined, // available in full vendor fetch
      totalAmount:   parseFloat(b.total ?? "0"),
      taxAmount:     parseFloat(b.tax_total ?? "0"),
      netAmount:     parseFloat(b.sub_total ?? "0"),
      currency:      b.currency_code ?? "KES",
      dueDate:       b.due_date,
      txnDate:       b.date,
      description:   b.notes,
      lineItems,
      status:        b.status === "overdue" ? "overdue" : "open",
      rawPayload:    b,
    };
  }));

  await supa.from("sync_events").insert({
    integration_id:   integrationId,
    business_id:      integ?.business_id,
    direction:        "pull",
    event_type:       "bill_import",
    status:           "ok",
    records_affected: normalised.length,
    duration_ms:      Date.now() - t0,
  });

  return normalised;
}

// ─── Push payment to Zoho as VendorPayment ───────────────────
// Zoho: POST /vendorpayments with bills[] allocation array
export async function pushZohoPayment(
  integrationId: string,
  payload: PaymentPushPayload
): Promise<string> {  // returns Zoho payment_id
  const t0 = Date.now();
  const { token, orgId } = await getZohoToken(integrationId);
  const { data: integ } = await supa
    .from("accounting_integrations")
    .select("business_id, sync_config")
    .eq("id", integrationId)
    .single();

  // Idempotency guard
  const { data: existing } = await supa
    .from("bill_mappings")
    .select("push_ref")
    .eq("integration_id", integrationId)
    .eq("external_id", payload.externalBillId)
    .single();

  if (existing?.push_ref) {
    console.log(`Zoho: Payment already pushed (${existing.push_ref}), skipping`);
    return existing.push_ref;
  }

  // Fetch bill to get vendor_id + amount
  const billDetail = await zohoGet(token, orgId, `/bills/${payload.externalBillId}`);
  const bill = (billDetail as any).bill;
  if (!bill) throw new Error(`Zoho bill ${payload.externalBillId} not found`);

  const reference = [
    `Dion:${payload.paymentRef}`,
    payload.mpesaReceipt  ? `MPESA:${payload.mpesaReceipt}`   : null,
    payload.bankReference ? `REF:${payload.bankReference}`     : null,
  ].filter(Boolean).join("|");

  const vendorPaymentBody = {
    vendor_id:      bill.vendor_id,
    payment_mode:   payload.mpesaReceipt ? "M-Pesa" : "Bank Transfer", // Zoho custom mode
    amount:         payload.amountPaid,
    date:           payload.paymentDate,
    reference_number: reference.slice(0, 100),
    description:    payload.memo ?? `Paid via Dion (ShieldPay)`,
    currency_id:    bill.currency_id,
    // Allocate payment to this specific bill
    bills: [{
      bill_id:        payload.externalBillId,
      amount_applied: payload.amountPaid,
    }],
  };

  const result = await zohoPost(token, orgId, "/vendorpayments", { payment: vendorPaymentBody });
  const zohoPay = (result as any).payment;
  const zohoPayId = zohoPay?.payment_id;

  if (!zohoPayId) throw new Error(`Zoho VendorPayment creation failed: ${JSON.stringify(result)}`);

  await supa.from("bill_mappings").update({
    sync_status:    "paid",
    last_pushed_at:  new Date().toISOString(),
    push_ref:        zohoPayId,
  }).eq("integration_id", integrationId).eq("external_id", payload.externalBillId);

  await supa.from("sync_events").insert({
    integration_id:   integrationId,
    business_id:      integ?.business_id,
    direction:        "push",
    event_type:       "payment_reconcile",
    status:           "ok",
    provider_ref:     payload.externalBillId,
    dion_ref:         payload.paymentRef,
    records_affected: 1,
    duration_ms:      Date.now() - t0,
  });

  console.log(`Zoho: Created VendorPayment ${zohoPayId} for bill ${payload.externalBillId}`);
  return zohoPayId;
}

// ─── Register Zoho Webhook ────────────────────────────────────
export async function registerZohoWebhook(
  integrationId: string,
  callbackUrl: string
): Promise<string> {
  const { token, orgId } = await getZohoToken(integrationId);

  // Zoho Books supports webhooks via Settings → Automation → Webhooks
  // We create it via API for automation
  const body = {
    webhook_name:    "DionSync_Bills",
    url:             callbackUrl,
    events:          ["bill.created", "bill.updated", "bill.statuschanged"],
    is_active:       true,
  };

  try {
    const result = await zohoPost(token, orgId, "/settings/webhooks", body);
    const webhookId = (result as any).webhook?.webhook_id ?? "zoho_webhook";
    await supa.from("accounting_integrations").update({ webhook_id: webhookId }).eq("id", integrationId);
    return webhookId;
  } catch (e) {
    console.warn("Zoho webhook registration failed (non-critical):", e);
    return "";
  }
}
