// ─── Dion Accounting Sync — Shared TypeScript Types ──────────
// Used by both Supabase Edge Functions and frontend React code.

export type SyncProvider   = 'quickbooks' | 'zoho';
export type IntegStatus    = 'active' | 'paused' | 'error' | 'revoked';
export type SyncDirection  = 'pull' | 'push';
export type SyncEventType  = 'bill_import' | 'payment_reconcile' | 'webhook_receive' | 'token_refresh';
export type SyncEventStatus = 'ok' | 'partial' | 'error' | 'retry';
export type BillSyncStatus = 'pending' | 'scheduled' | 'paid' | 'skipped' | 'error';

// ── DB row shapes ─────────────────────────────────────────────
export interface AccountingIntegration {
  id:                 string;
  business_id:        string;
  provider:           SyncProvider;
  token_expires_at:   string;
  realm_id:           string | null;         // QuickBooks
  organization_id:    string | null;         // Zoho
  zoho_server_domain: string | null;
  status:             IntegStatus;
  last_sync_at:       string | null;
  last_sync_status:   string | null;
  last_error:         string | null;
  consecutive_errors: number;
  sync_config:        SyncConfig;
  webhook_id:         string | null;
  created_at:         string;
  updated_at:         string;
}

export interface SyncConfig {
  category_map?:         Record<string, string>;  // Dion category → QB/Zoho account name
  default_expense_account?: string;               // QB: account ID for unmapped categories
  default_ap_account?:   string;                  // QB: Accounts Payable account ID
  auto_create_suppliers?: boolean;                // auto-create Dion suppliers from QB vendors
  pull_days_back?:       number;                  // how far back to pull bills (default 30)
  poll_interval_mins?:   number;                  // polling fallback interval (default 10)
}

export interface SyncEvent {
  id:               string;
  integration_id:   string;
  business_id:      string;
  direction:        SyncDirection;
  event_type:       SyncEventType;
  status:           SyncEventStatus;
  provider_ref?:    string;
  dion_ref?:        string;
  records_affected: number;
  error_detail?:    string;
  duration_ms?:     number;
  created_at:       string;
}

export interface BillMapping {
  id:                  string;
  integration_id:      string;
  business_id:         string;
  external_id:         string;
  external_doc_no?:    string;
  external_vendor?:    string;
  schedule_id?:        string | null;
  payment_id?:         string | null;
  supplier_id?:        string | null;
  sync_status:         BillSyncStatus;
  last_pushed_at?:     string | null;
  push_ref?:           string | null;
  raw_snapshot?:       Record<string, unknown>;
  created_at:          string;
  updated_at:          string;
}

// ── Normalised bill shape (provider-agnostic) ─────────────────
// Both QB and Zoho bill adapters produce this shape for Dion to consume.
export interface NormalisedBill {
  externalId:    string;         // QB Bill.Id / Zoho bill_id
  docNumber?:    string;         // QB DocNumber / Zoho bill_number
  vendorId:      string;         // QB Vendor.Id / Zoho vendor_id
  vendorName:    string;
  vendorEmail?:  string;
  vendorKraPin?: string;         // eTIMS KRA PIN if available
  totalAmount:   number;         // KES (Zoho Kenya) or USD converted for QB
  taxAmount:     number;
  netAmount:     number;
  currency:      string;
  dueDate:       string;         // ISO date YYYY-MM-DD
  txnDate:       string;         // bill/invoice date
  description?:  string;
  lineItems:     NormalisedLineItem[];
  attachmentUrl?: string;
  status:        'open' | 'overdue' | 'partial';
  rawPayload:    Record<string, unknown>;
}

export interface NormalisedLineItem {
  description?: string;
  amount:       number;
  taxAmount:    number;
  accountId?:   string;
  accountName?: string;
}

// ── Payment push shape ────────────────────────────────────────
export interface PaymentPushPayload {
  externalBillId:  string;         // QB Bill.Id / Zoho bill_id
  paymentDate:     string;         // ISO date YYYY-MM-DD
  amountPaid:      number;
  currency:        string;
  paymentRef:      string;         // Dion payment_request.id or mpesa_receipt
  memo?:           string;
  mpesaReceipt?:   string;
  bankReference?:  string;
}

// ── OAuth state (stored temporarily in Supabase KV / Deno KV) ─
export interface OAuthState {
  businessId:  string;
  userId:      string;
  provider:    SyncProvider;
  redirectTo:  string;
  nonce:       string;            // CSRF protection
  expiresAt:   number;            // unix ms
}
