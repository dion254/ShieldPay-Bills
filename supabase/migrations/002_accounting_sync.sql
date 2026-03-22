-- ============================================================
-- Dion Accounting Sync Module v1
-- Adds: QuickBooks Online + Zoho Books bidirectional sync
-- Kenya EAT timezone-aware; pgcrypto for token encryption
-- ============================================================

-- ─── ACCOUNTING INTEGRATIONS ────────────────────────────────
-- Stores one row per connected accounting provider per business.
-- Tokens are AES-encrypted via pgcrypto before storage.
CREATE TABLE public.accounting_integrations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL CHECK (provider IN ('quickbooks', 'zoho')),

  -- Encrypted OAuth tokens (pgcrypto AES-256)
  access_token_enc    BYTEA NOT NULL,          -- pgp_sym_encrypt(token, key)
  refresh_token_enc   BYTEA NOT NULL,
  token_expires_at    TIMESTAMPTZ NOT NULL,

  -- Provider-specific identifiers
  realm_id            TEXT,                    -- QuickBooks: company realmId
  organization_id     TEXT,                    -- Zoho: organization_id
  zoho_server_domain  TEXT DEFAULT 'https://books.zoho.com',  -- Kenya may differ

  -- Sync state
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'paused', 'error', 'revoked')),
  last_sync_at        TIMESTAMPTZ,
  last_sync_status    TEXT,                    -- 'ok' | 'partial' | 'error'
  last_error          TEXT,
  consecutive_errors  INT NOT NULL DEFAULT 0,

  -- Config: JSON mapping wizard output
  -- e.g. {"category_map":{"Food Supplier":"Food":...}, "default_account_id":"..."}
  sync_config         JSONB NOT NULL DEFAULT '{}',

  -- Webhook subscription IDs (for cleanup on disconnect)
  webhook_id          TEXT,

  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (business_id, provider)   -- one QB + one Zoho per business max
);
CREATE TRIGGER trg_ai BEFORE UPDATE ON accounting_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_ai_biz    ON accounting_integrations(business_id, status);
CREATE INDEX idx_ai_sync   ON accounting_integrations(last_sync_at, status)
  WHERE status = 'active';

-- ─── SYNC EVENTS LOG ────────────────────────────────────────
-- Immutable log of every pull/push operation; used for dashboard.
CREATE TABLE public.sync_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id  UUID NOT NULL REFERENCES accounting_integrations(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('pull', 'push')),
  event_type      TEXT NOT NULL,   -- 'bill_import' | 'payment_reconcile' | 'webhook_receive'
  status          TEXT NOT NULL CHECK (status IN ('ok', 'partial', 'error', 'retry')),
  provider_ref    TEXT,            -- QB bill ID / Zoho bill ID / payment ID
  dion_ref        TEXT,            -- Dion schedule_id or payment_request_id
  records_affected INT DEFAULT 0,
  error_detail    TEXT,
  duration_ms     INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()   -- always EAT-aware via client TZ
);
CREATE INDEX idx_se_integ ON sync_events(integration_id, created_at DESC);
CREATE INDEX idx_se_biz   ON sync_events(business_id, created_at DESC);

-- ─── BILL MAPPINGS ──────────────────────────────────────────
-- Tracks which external bill maps to which Dion schedule/request.
-- Enables idempotent re-sync and prevents duplicates.
CREATE TABLE public.bill_mappings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id  UUID NOT NULL REFERENCES accounting_integrations(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- External provider identifiers
  external_id     TEXT NOT NULL,   -- QB Bill.Id / Zoho bill_id
  external_doc_no TEXT,            -- QB DocNumber / Zoho bill_number
  external_vendor TEXT,            -- vendor name from QB/Zoho

  -- Dion references (nullable until mapped)
  schedule_id     UUID REFERENCES payment_schedules(id) ON DELETE SET NULL,
  payment_id      UUID REFERENCES payment_requests(id)  ON DELETE SET NULL,
  supplier_id     UUID REFERENCES suppliers(id)          ON DELETE SET NULL,

  -- Sync status for this specific bill
  sync_status     TEXT NOT NULL DEFAULT 'pending'
                  CHECK (sync_status IN ('pending','scheduled','paid','skipped','error')),
  last_pushed_at  TIMESTAMPTZ,   -- when we last pushed payment back to provider
  push_ref        TEXT,          -- QB BillPayment.Id / Zoho VendorPayment.payment_id

  -- Raw snapshot of the external bill at time of last pull (for diffing)
  raw_snapshot    JSONB,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (integration_id, external_id)
);
CREATE TRIGGER trg_bm BEFORE UPDATE ON bill_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_bm_integ  ON bill_mappings(integration_id, sync_status);
CREATE INDEX idx_bm_sched  ON bill_mappings(schedule_id) WHERE schedule_id IS NOT NULL;
CREATE INDEX idx_bm_pay    ON bill_mappings(payment_id)  WHERE payment_id  IS NOT NULL;

-- ─── SUPPLIER MAPPINGS ──────────────────────────────────────
-- Stores the one-time wizard mapping: Dion supplier ↔ QB vendor / Zoho contact
CREATE TABLE public.supplier_mappings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id  UUID NOT NULL REFERENCES accounting_integrations(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  external_vendor_id   TEXT NOT NULL,   -- QB Vendor.Id / Zoho contact_id
  external_vendor_name TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, supplier_id)
);

-- ─── RLS POLICIES ───────────────────────────────────────────
ALTER TABLE accounting_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_mappings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_mappings       ENABLE ROW LEVEL SECURITY;

-- Only admins/owners see/manage integrations
CREATE POLICY ai_sel ON accounting_integrations FOR SELECT
  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY ai_ins ON accounting_integrations FOR INSERT
  WITH CHECK (is_biz_admin(business_id) OR is_super_admin());
CREATE POLICY ai_upd ON accounting_integrations FOR UPDATE
  USING (is_biz_admin(business_id) OR is_super_admin());
CREATE POLICY ai_del ON accounting_integrations FOR DELETE
  USING (is_biz_admin(business_id) OR is_super_admin());

CREATE POLICY se_sel ON sync_events FOR SELECT
  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY se_ins ON sync_events FOR INSERT WITH CHECK (TRUE);

CREATE POLICY bm_sel ON bill_mappings FOR SELECT
  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY bm_ins ON bill_mappings FOR INSERT WITH CHECK (TRUE);
CREATE POLICY bm_upd ON bill_mappings FOR UPDATE USING (TRUE);

CREATE POLICY sm_sel ON supplier_mappings FOR SELECT
  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY sm_ins ON supplier_mappings FOR INSERT
  WITH CHECK (is_biz_admin(business_id) OR is_super_admin());
CREATE POLICY sm_upd ON supplier_mappings FOR UPDATE
  USING (is_biz_admin(business_id) OR is_super_admin());
CREATE POLICY sm_del ON supplier_mappings FOR DELETE
  USING (is_biz_admin(business_id) OR is_super_admin());

-- ─── HELPER VIEW: Integration health for dashboard ──────────
CREATE OR REPLACE VIEW v_integration_health AS
SELECT
  ai.id,
  ai.business_id,
  ai.provider,
  ai.status,
  ai.last_sync_at,
  ai.last_sync_status,
  ai.last_error,
  ai.consecutive_errors,
  EXTRACT(EPOCH FROM (NOW() - ai.last_sync_at)) / 60 AS minutes_since_sync,
  COUNT(se.id) FILTER (WHERE se.status = 'error'
    AND se.created_at > NOW() - INTERVAL '24 hours') AS errors_last_24h,
  COUNT(bm.id) FILTER (WHERE bm.sync_status = 'pending') AS pending_bills,
  COUNT(bm.id) FILTER (WHERE bm.sync_status = 'paid')    AS paid_bills
FROM accounting_integrations ai
LEFT JOIN sync_events  se ON se.integration_id = ai.id
LEFT JOIN bill_mappings bm ON bm.integration_id = ai.id
GROUP BY ai.id;
