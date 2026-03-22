// ============================================================
// Dion Accounting Sync — Main Edge Function Entry Point
// Routes: /oauth/connect, /oauth/callback, /sync/pull,
//         /sync/push, /webhooks/qb, /webhooks/zoho, /poll
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildQBAuthUrl, handleQBCallback }     from "./qb-adapter.ts";
import { buildZohoAuthUrl, handleZohoCallback } from "./zoho-adapter.ts";
import {
  runPullSync, runPushSync, runPollingScheduler, handleWebhookEvent
} from "./sync-engine.ts";
import type { OAuthState } from "../../src/lib/sync-types.ts";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_REDIRECT     = Deno.env.get("APP_URL") + "/settings/integrations";
const CRON_SECRET      = Deno.env.get("CRON_SECRET")!;  // protect polling endpoint
const QB_WEBHOOK_TOKEN = Deno.env.get("QB_WEBHOOK_VERIFIER_TOKEN") ?? "";

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE);

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

// ─── Authenticate caller via Supabase JWT ────────────────────
async function getAuthUser(req: Request): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");

  const { data: { user }, error } = await createClient(SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY")!
  ).auth.getUser(token);

  return error ? null : (user ? { id: user.id, email: user.email! } : null);
}

// ─── Main handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url     = new URL(req.url);
  const path    = url.pathname.replace(/^\/functions\/v1\/accounting-sync/, "");
  const method  = req.method;

  try {

    // ── OAuth: initiate connect ──────────────────────────────
    // POST /oauth/connect  body: { provider, businessId }
    if (path === "/oauth/connect" && method === "POST") {
      const user = await getAuthUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const { provider, businessId } = await req.json();
      if (!["quickbooks", "zoho"].includes(provider)) {
        return json({ error: "Invalid provider" }, 400);
      }

      const state: OAuthState = {
        businessId,
        userId:     user.id,
        provider,
        redirectTo: APP_REDIRECT,
        nonce:      crypto.randomUUID(),
        expiresAt:  Date.now() + 10 * 60 * 1000, // 10 min
      };

      const authUrl = provider === "quickbooks"
        ? buildQBAuthUrl(state)
        : buildZohoAuthUrl(state);

      return json({ url: authUrl });
    }

    // ── OAuth: QuickBooks callback ────────────────────────────
    // GET /oauth/callback/quickbooks?code=...&realmId=...&state=...
    if (path === "/oauth/callback/quickbooks" && method === "GET") {
      const code    = url.searchParams.get("code") ?? "";
      const realmId = url.searchParams.get("realmId") ?? "";
      const state   = url.searchParams.get("state") ?? "";

      await handleQBCallback(code, realmId, state);
      return redirect(`${APP_REDIRECT}?connected=quickbooks`);
    }

    // ── OAuth: Zoho callback ──────────────────────────────────
    // GET /oauth/callback/zoho?code=...&state=...
    if (path === "/oauth/callback/zoho" && method === "GET") {
      const code  = url.searchParams.get("code") ?? "";
      const state = url.searchParams.get("state") ?? "";

      await handleZohoCallback(code, state);
      return redirect(`${APP_REDIRECT}?connected=zoho`);
    }

    // ── Manual pull sync (admin test button + bill-feed internal) ─
    // POST /sync/pull  body: { integrationId, returnBills? }
    if (path === "/sync/pull" && method === "POST") {
      const user = await getAuthUser(req);
      // Allow service-role calls (from bill-feed function)
      const authHeader = req.headers.get("Authorization") ?? "";
      const isServiceCall = authHeader.includes(SUPABASE_SERVICE);
      if (!user && !isServiceCall) return json({ error: "Unauthorized" }, 401);

      const { integrationId, returnBills } = await req.json();
      const result = await runPullSync(integrationId, returnBills === true);
      return json({ ok: true, ...result });
    }

    // ── Push reconciliation (called internally after payment) ─
    // POST /sync/push  body: { paymentRequestId }
    // Protected by service-role secret in Authorization header
    if (path === "/sync/push" && method === "POST") {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.includes(SUPABASE_SERVICE) && !await getAuthUser(req)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const { paymentRequestId } = await req.json();
      await runPushSync(paymentRequestId);
      return json({ ok: true });
    }

    // ── Polling cron endpoint ─────────────────────────────────
    // POST /poll  — called by Supabase Cron every 10 min
    // Protected by CRON_SECRET header
    if (path === "/poll" && method === "POST") {
      const secret = req.headers.get("x-cron-secret") ?? "";
      if (secret !== CRON_SECRET) return json({ error: "Forbidden" }, 403);

      await runPollingScheduler();
      return json({ ok: true, ts: new Date().toISOString() });
    }

    // ── QB webhook receiver ───────────────────────────────────
    // POST /webhooks/quickbooks
    if (path === "/webhooks/quickbooks" && method === "POST") {
      const rawBody  = await req.text();
      const signature = req.headers.get("intuit-signature") ?? "";

      // Verify QB HMAC-SHA256 signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(QB_WEBHOOK_TOKEN), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
      );
      const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
      const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(rawBody));
      if (!valid) return json({ error: "Invalid signature" }, 401);

      const payload = JSON.parse(rawBody);
      const realmId = payload.eventNotifications?.[0]?.realmId;

      if (realmId) {
        // Find integration by realmId
        const { data: integ } = await supa
          .from("accounting_integrations")
          .select("id")
          .eq("realm_id", realmId)
          .single();

        if (integ) await handleWebhookEvent("quickbooks", integ.id, payload);
      }

      return new Response("ok", { status: 200 });
    }

    // ── Zoho webhook receiver ─────────────────────────────────
    // POST /webhooks/zoho
    if (path === "/webhooks/zoho" && method === "POST") {
      const payload    = await req.json();
      const orgId      = payload.data?.organization_id ?? payload.organization_id;

      if (orgId) {
        const { data: integ } = await supa
          .from("accounting_integrations")
          .select("id")
          .eq("organization_id", orgId)
          .single();

        if (integ) await handleWebhookEvent("zoho", integ.id, payload);
      }

      return new Response("ok", { status: 200 });
    }

    // ── Disconnect integration ────────────────────────────────
    // DELETE /integration/:id
    if (path.startsWith("/integration/") && method === "DELETE") {
      const user = await getAuthUser(req);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const integrationId = path.replace("/integration/", "");
      await supa.from("accounting_integrations")
        .update({ status: "revoked", access_token_enc: "", refresh_token_enc: "" })
        .eq("id", integrationId);

      return json({ ok: true });
    }

    // ── Health check ──────────────────────────────────────────
    if (path === "/health" && method === "GET") {
      return json({ ok: true, ts: new Date().toISOString(), version: "1.0.0" });
    }

    return json({ error: "Not found" }, 404);

  } catch (e: any) {
    console.error("accounting-sync error:", e);
    return json({ error: e.message }, 500);
  }
});
