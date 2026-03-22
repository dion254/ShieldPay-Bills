// ============================================================
// Dion Sync Engine — Core Orchestrator
// Handles: bill import → Dion schedule creation
//          payment complete → accounting push
//          polling scheduler with exponential backoff
//          Germany-engineering grade: idempotent, retry-safe, EAT-aware
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pullQBBills, pushQBPayment }     from "./qb-adapter.ts";
import { pullZohoBills, pushZohoPayment } from "./zoho-adapter.ts";
import type {
  NormalisedBill, PaymentPushPayload, AccountingIntegration, SyncConfig
} from "../../src/lib/sync-types.ts";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// Kenya EAT = UTC+3
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

function toEATDate(date: Date): string {
  return new Date(date.getTime() + EAT_OFFSET_MS).toISOString().split("T")[0];
}

function todayEAT(): string {
  return toEATDate(new Date());
}

// ─── Map external bill → Dion payment schedule ───────────────
// This is the "translation layer" between accounting world and Dion.
async function mapBillToSchedule(
  bill:        NormalisedBill,
  integration: AccountingIntegration,
  supplierId:  string
): Promise<Record<string, unknown>> {
  const config: SyncConfig = integration.sync_config ?? {};

  // Map category using wizard config, fall back to "Other"
  const rawCategory = bill.lineItems[0]?.accountName ?? "Other";
  const category    = config.category_map?.[rawCategory] ?? rawCategory;

  // Determine payment method: Zoho bills in KES with vendor phone → M-Pesa preferred
  // QB bills typically USD → prefer PesaLink unless supplier has M-Pesa
  const defaultMethod = integration.provider === "zoho" ? "kcb_paybill" : "pesalink";

  return {
    business_id:      integration.business_id,
    supplier_id:      supplierId,
    title:            `[${integration.provider === "quickbooks" ? "QB" : "ZB"}] ${bill.docNumber ?? bill.externalId} — ${bill.vendorName}`,
    description:      bill.description ?? `Imported from ${integration.provider === "quickbooks" ? "QuickBooks" : "Zoho Books"}`,
    amount:           bill.totalAmount,
    payment_method:   defaultMethod,
    frequency:        "once",
    start_date:       bill.dueDate,
    next_due_date:    bill.dueDate,
    budget_category:  category,
    requires_approval: true,
    auto_execute:     false,
    reminder_days:    3,
    status:           "active",
    // Store sync source in notes for traceability
    notes:            `Sync source: ${integration.provider} | Bill: ${bill.docNumber ?? bill.externalId} | VAT: KES ${bill.taxAmount.toFixed(2)}`,
    created_at:       new Date().toISOString(),
  };
}

// ─── Find or create Dion supplier from external vendor ────────
async function resolveSupplier(
  integration: AccountingIntegration,
  bill:        NormalisedBill
): Promise<string> {
  const { business_id } = integration;

  // 1. Check supplier_mappings for pre-mapped vendor
  const { data: mapping } = await supa
    .from("supplier_mappings")
    .select("supplier_id")
    .eq("integration_id", integration.id)
    .eq("external_vendor_id", bill.vendorId)
    .single();

  if (mapping?.supplier_id) return mapping.supplier_id;

  // 2. Fuzzy-match by supplier name (case-insensitive)
  const { data: existing } = await supa
    .from("suppliers")
    .select("id, name")
    .eq("business_id", business_id)
    .eq("status", "active")
    .ilike("name", `%${bill.vendorName.trim()}%`)
    .limit(1)
    .single();

  if (existing) {
    // Auto-save the mapping for future syncs
    await supa.from("supplier_mappings").upsert({
      integration_id:       integration.id,
      business_id,
      supplier_id:          existing.id,
      external_vendor_id:   bill.vendorId,
      external_vendor_name: bill.vendorName,
    }, { onConflict: "integration_id,supplier_id" });
    return existing.id;
  }

  // 3. Auto-create supplier if config allows
  const config: SyncConfig = integration.sync_config;
  if (!config.auto_create_suppliers) {
    throw new Error(`No supplier mapping for vendor "${bill.vendorName}" (${bill.vendorId}). Configure mapping wizard.`);
  }

  const { data: newSup, error } = await supa
    .from("suppliers")
    .insert({
      business_id,
      name:           bill.vendorName,
      type:           "other",
      default_method: integration.provider === "zoho" ? "kcb_paybill" : "pesalink",
      notes:          `Auto-created from ${integration.provider} vendor ${bill.vendorId}`,
      status:         "active",
    })
    .select("id")
    .single();

  if (error || !newSup) throw new Error(`Failed to create supplier: ${error?.message}`);

  await supa.from("supplier_mappings").insert({
    integration_id:       integration.id,
    business_id,
    supplier_id:          newSup.id,
    external_vendor_id:   bill.vendorId,
    external_vendor_name: bill.vendorName,
  });

  return newSup.id;
}

// ─── Core pull: import bills from provider → Dion schedules ──
export async function runPullSync(integrationId: string, returnBills = false): Promise<{
  imported: number; skipped: number; errors: string[]; bills?: unknown[];
}> {
  const { data: integration, error: intErr } = await supa
    .from("accounting_integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (intErr || !integration) throw new Error("Integration not found");
  if (integration.status === "revoked") throw new Error("Integration revoked");

  const config: SyncConfig = integration.sync_config;
  const daysBack = config.pull_days_back ?? 30;

  // Pull bills from provider
  let bills: NormalisedBill[];
  try {
    bills = integration.provider === "quickbooks"
      ? await pullQBBills(integrationId, daysBack)
      : await pullZohoBills(integrationId, daysBack);
  } catch (e: any) {
    await markIntegrationError(integrationId, e.message);
    throw e;
  }

  let imported = 0;
  let skipped  = 0;
  const errors: string[] = [];
  const billsOut: unknown[] = [];

  for (const bill of bills) {
    try {
      // Idempotency: skip if already mapped
      const { data: existingMapping } = await supa
        .from("bill_mappings")
        .select("id, sync_status")
        .eq("integration_id", integrationId)
        .eq("external_id", bill.externalId)
        .single();

      if (existingMapping) {
        // Update raw snapshot in case amounts changed
        await supa.from("bill_mappings").update({
          raw_snapshot: bill.rawPayload,
          updated_at:   new Date().toISOString(),
        }).eq("id", existingMapping.id);
        skipped++;
        continue;
      }

      // Resolve supplier
      const supplierId = await resolveSupplier(integration as AccountingIntegration, bill);

      // Create payment schedule in Dion
      const scheduleData = await mapBillToSchedule(bill, integration as AccountingIntegration, supplierId);
      const { data: schedule, error: schedErr } = await supa
        .from("payment_schedules")
        .insert(scheduleData)
        .select("id")
        .single();

      if (schedErr || !schedule) throw new Error(`Schedule insert failed: ${schedErr?.message}`);

      // Create bill_mapping record
      await supa.from("bill_mappings").insert({
        integration_id:    integrationId,
        business_id:       integration.business_id,
        external_id:       bill.externalId,
        external_doc_no:   bill.docNumber,
        external_vendor:   bill.vendorName,
        supplier_id:       supplierId,
        schedule_id:       schedule.id,
        sync_status:       "scheduled",
        raw_snapshot:      bill.rawPayload,
      });

      // Fire notification to business owner
      await supa.from("notifications").insert({
        business_id: integration.business_id,
        type:        "sync_bill_imported",
        title:       `New bill imported from ${integration.provider === "quickbooks" ? "QuickBooks" : "Zoho Books"}`,
        message:     `${bill.vendorName} — KES ${bill.totalAmount.toLocaleString()} due ${bill.dueDate}`,
        entity_id:   schedule.id,
        entity_type: "payment_schedule",
        action_url:  `/bills`,
      });

      imported++;
      if (returnBills) billsOut.push({ ...bill, dionScheduleId: schedule.id });
    } catch (e: any) {
      errors.push(`Bill ${bill.externalId}: ${e.message}`);
      console.error(`Sync error for bill ${bill.externalId}:`, e);
    }
  }

  // Update last_sync_at on integration
  await supa.from("accounting_integrations").update({
    last_sync_at:       new Date().toISOString(),
    last_sync_status:   errors.length === 0 ? "ok" : imported > 0 ? "partial" : "error",
    last_error:         errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
    consecutive_errors: errors.length > 0 ? integration.consecutive_errors + 1 : 0,
    status:             errors.length > 0 && imported === 0 ? "error" : "active",
  }).eq("id", integrationId);

  const bills = billsOut;
    return { imported, skipped, errors, ...(returnBills ? { bills } : {}) };
}

// ─── Core push: after Dion payment completes → reconcile ─────
// Call this after a payment_request reaches status='completed'.
export async function runPushSync(paymentRequestId: string): Promise<void> {
  // Load payment request with all relations
  const { data: payment, error } = await supa
    .from("payment_requests")
    .select("*, supplier:supplier_id(name, category)")
    .eq("id", paymentRequestId)
    .single();

  if (error || !payment) throw new Error("Payment request not found");
  if (payment.status !== "completed") throw new Error("Payment not completed yet");

  // Find bill_mapping for this payment's schedule
  const { data: mapping } = await supa
    .from("bill_mappings")
    .select("*, integration:integration_id(*)")
    .eq("payment_id", paymentRequestId)
    .maybeSingle();

  // Also check via schedule_id
  const { data: mappingBySchedule } = !mapping ? await supa
    .from("bill_mappings")
    .select("*, integration:integration_id(*)")
    .eq("schedule_id", payment.schedule_id ?? "none")
    .maybeSingle() : { data: null };

  const resolvedMapping = mapping ?? mappingBySchedule;
  if (!resolvedMapping) {
    console.log(`No bill_mapping for payment ${paymentRequestId} — not syncing`);
    return;
  }

  if (resolvedMapping.sync_status === "paid") {
    console.log(`Bill ${resolvedMapping.external_id} already marked paid — skipping push`);
    return;
  }

  const integration = resolvedMapping.integration;

  const pushPayload: PaymentPushPayload = {
    externalBillId: resolvedMapping.external_id,
    paymentDate:    payment.completed_at
                      ? toEATDate(new Date(payment.completed_at))
                      : todayEAT(),
    amountPaid:     payment.amount,
    currency:       "KES",
    paymentRef:     paymentRequestId,
    memo:           `Paid via Dion/ShieldPay — ${payment.title}`,
    mpesaReceipt:   payment.mpesa_receipt ?? undefined,
    bankReference:  payment.bank_reference ?? undefined,
  };

  try {
    if (integration.provider === "quickbooks") {
      await pushQBPayment(integration.id, pushPayload);
    } else {
      await pushZohoPayment(integration.id, pushPayload);
    }

    // Update mapping payment_id link
    await supa.from("bill_mappings").update({
      payment_id: paymentRequestId,
    }).eq("id", resolvedMapping.id);

  } catch (e: any) {
    await markIntegrationError(integration.id, e.message);
    // Write error sync event
    await supa.from("sync_events").insert({
      integration_id:  integration.id,
      business_id:     integration.business_id,
      direction:       "push",
      event_type:      "payment_reconcile",
      status:          "error",
      dion_ref:        paymentRequestId,
      error_detail:    e.message,
      records_affected: 0,
    });
    throw e;
  }
}

// ─── Mark integration error + increment counter ───────────────
async function markIntegrationError(integrationId: string, errorMsg: string): Promise<void> {
  const { data: cur } = await supa
    .from("accounting_integrations")
    .select("consecutive_errors")
    .eq("id", integrationId)
    .single();

  const newCount = (cur?.consecutive_errors ?? 0) + 1;
  const suspended = newCount >= 10;

  await supa.from("accounting_integrations").update({
    last_error:         errorMsg,
    consecutive_errors: newCount,
    status:             suspended ? "error" : "active",
    last_sync_status:   "error",
  }).eq("id", integrationId);

  if (suspended) {
    // Fire alert notification
    const { data: integ } = await supa
      .from("accounting_integrations")
      .select("business_id, provider")
      .eq("id", integrationId)
      .single();

    if (integ) {
      await supa.from("notifications").insert({
        business_id: integ.business_id,
        type:        "sync_persistent_error",
        title:       `⚠️ Accounting sync paused`,
        message:     `${integ.provider === "quickbooks" ? "QuickBooks" : "Zoho Books"} sync has failed 10 times. Please check settings. Last error: ${errorMsg.slice(0, 200)}`,
        entity_type: "accounting_integration",
        entity_id:   integrationId,
        action_url:  `/settings/integrations`,
      });
    }
  }
}

// ─── Polling scheduler (cron fallback if webhooks fail) ───────
// Called by Supabase Cron every 10 minutes.
// Exponential backoff: 1×, 2×, 4×, 8× up to 60-min cap.
export async function runPollingScheduler(): Promise<void> {
  const now = new Date().toISOString();

  // Find active integrations due for a poll
  const { data: integrations } = await supa
    .from("accounting_integrations")
    .select("id, provider, last_sync_at, sync_config, consecutive_errors, status")
    .in("status", ["active", "error"])
    .order("last_sync_at", { ascending: true, nullsFirst: true });

  if (!integrations?.length) return;

  for (const integ of integrations) {
    try {
      // Calculate backoff interval
      const errorCount = integ.consecutive_errors ?? 0;
      const baseIntervalMins = integ.sync_config?.poll_interval_mins ?? 10;
      const backoffMins = Math.min(
        baseIntervalMins * Math.pow(2, errorCount),
        60  // 1-hour cap
      );

      const lastSync  = integ.last_sync_at ? new Date(integ.last_sync_at) : new Date(0);
      const nextPoll  = new Date(lastSync.getTime() + backoffMins * 60_000);
      const isDue     = new Date() >= nextPoll;

      if (!isDue) continue;

      console.log(`Polling sync for integration ${integ.id} (${integ.provider})`);
      await runPullSync(integ.id);

    } catch (e: any) {
      console.error(`Polling failed for ${integ.id}:`, e.message);
      // Already handled inside runPullSync — don't re-throw
    }
  }
}

// ─── Webhook handler dispatcher ──────────────────────────────
export async function handleWebhookEvent(
  provider:      "quickbooks" | "zoho",
  integrationId: string,
  payload:       Record<string, unknown>
): Promise<void> {
  if (provider === "quickbooks") {
    // QB sends { eventNotifications: [{ realmId, dataChangeEvent: { entities: [...] } }] }
    const notifications: any[] = (payload as any).eventNotifications ?? [];
    for (const notif of notifications) {
      const entities: any[] = notif.dataChangeEvent?.entities ?? [];
      const billEntities = entities.filter((e: any) => e.name === "Bill");
      if (billEntities.length > 0) {
        // Trigger a targeted pull (we re-pull recent bills)
        await runPullSync(integrationId);
      }
    }
  } else if (provider === "zoho") {
    // Zoho sends { event: "bill.created", data: { bill: {...} } }
    const event = (payload as any).event ?? "";
    if (event.startsWith("bill.")) {
      await runPullSync(integrationId);
    }
  }

  await supa.from("sync_events").insert({
    integration_id: integrationId,
    business_id:    (await supa.from("accounting_integrations")
                       .select("business_id").eq("id", integrationId).single()).data?.business_id,
    direction:      "pull",
    event_type:     "webhook_receive",
    status:         "ok",
    records_affected: 1,
  });
}
