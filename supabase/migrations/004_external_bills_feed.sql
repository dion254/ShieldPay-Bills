-- ============================================================
-- Migration 004: External Bills Feed + Admin Expansion
-- Adds: external_bills (QB/Zoho feed inbox), admin_actions,
--       super_admin can now impersonate + execute on any business
-- ============================================================

-- ─── EXTERNAL BILLS INBOX ────────────────────────────────────
-- Stores raw bills pulled from QB/Zoho before they become schedules.
-- This is the "feed" — admin reviews here and accepts/skips each.
CREATE TABLE IF NOT EXISTS public.external_bills (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  integration_id   UUID NOT NULL REFERENCES accounting_integrations(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('quickbooks','zoho','manual')),

  -- External identifiers
  external_id      TEXT NOT NULL,
  doc_number       TEXT,
  vendor_id        TEXT,
  vendor_name      TEXT NOT NULL,
  vendor_email     TEXT,
  vendor_kra_pin   TEXT,

  -- Bill details
  total_amount     NUMERIC(14,2) NOT NULL,
  tax_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount       NUMERIC(14,2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'KES',
  due_date         DATE NOT NULL,
  bill_date        DATE NOT NULL,
  description      TEXT,
  line_items       JSONB DEFAULT '[]',
  attachment_url   TEXT,

  -- Feed status
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','skipped','error')),
  accepted_schedule_id UUID REFERENCES payment_schedules(id) ON DELETE SET NULL,

  -- KRA compliance flag
  kra_pin_missing  BOOLEAN NOT NULL DEFAULT FALSE,

  raw_payload      JSONB,
  pulled_at        TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by      UUID REFERENCES auth.users(id),
  reviewed_at      TIMESTAMPTZ,

  UNIQUE (integration_id, external_id)
);
CREATE INDEX idx_eb_biz    ON external_bills(business_id, status, due_date);
CREATE INDEX idx_eb_integ  ON external_bills(integration_id, pulled_at DESC);
ALTER TABLE external_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY eb_sel ON external_bills FOR SELECT  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY eb_ins ON external_bills FOR INSERT  WITH CHECK (TRUE);
CREATE POLICY eb_upd ON external_bills FOR UPDATE  USING (is_biz_admin(business_id) OR is_super_admin());

-- ─── ADMIN ACTIONS LOG ───────────────────────────────────────
-- Dedicated super-admin action log (separate from business audit_logs)
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  admin_email   TEXT NOT NULL,
  action        TEXT NOT NULL,  -- 'impersonate','force_sync','override_status','manual_payment'
  target_type   TEXT,           -- 'business','payment_request','supplier'
  target_id     UUID,
  details       JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_aa_admin ON admin_actions(admin_user_id, created_at DESC);
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_sel ON admin_actions FOR SELECT  USING (is_super_admin());
CREATE POLICY aa_ins ON admin_actions FOR INSERT  WITH CHECK (TRUE);

-- ─── SUPPLIER EXTERNAL LINKS ─────────────────────────────────
-- Links Dion supplier to QB vendor / Zoho contact — reusable across syncs
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS qb_vendor_id    TEXT,
  ADD COLUMN IF NOT EXISTS zoho_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS auto_synced     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_synced_at  TIMESTAMPTZ;

-- ─── EXTERNAL BILL FEED VIEW ─────────────────────────────────
CREATE OR REPLACE VIEW v_external_bill_feed AS
SELECT
  eb.*,
  ai.provider        AS integration_provider,
  b.name             AS business_name,
  s.id               AS matched_supplier_id,
  s.name             AS matched_supplier_name
FROM external_bills eb
JOIN accounting_integrations ai ON ai.id = eb.integration_id
JOIN businesses b ON b.id = eb.business_id
LEFT JOIN suppliers s ON s.business_id = eb.business_id
  AND (s.qb_vendor_id = eb.vendor_id OR s.zoho_contact_id = eb.vendor_id OR s.name ILIKE '%' || eb.vendor_name || '%')
ORDER BY eb.due_date ASC, eb.pulled_at DESC;

-- ─── FUNCTION: Accept external bill → create schedule ────────
CREATE OR REPLACE FUNCTION accept_external_bill(
  p_bill_id    UUID,
  p_user_id    UUID,
  p_method     TEXT DEFAULT NULL,
  p_supplier_id UUID DEFAULT NULL
)
RETURNS UUID   -- returns new payment_schedule id
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_bill     external_bills%ROWTYPE;
  v_sup_id   UUID;
  v_sched_id UUID;
  v_method   TEXT;
BEGIN
  SELECT * INTO v_bill FROM external_bills WHERE id = p_bill_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF v_bill.status = 'accepted' THEN RAISE EXCEPTION 'Bill already accepted'; END IF;

  -- Resolve supplier
  v_sup_id := COALESCE(p_supplier_id,
    (SELECT id FROM suppliers
     WHERE business_id = v_bill.business_id
       AND (qb_vendor_id = v_bill.vendor_id OR zoho_contact_id = v_bill.vendor_id
            OR name ILIKE '%' || v_bill.vendor_name || '%')
       AND status = 'active'
     LIMIT 1)
  );

  IF v_sup_id IS NULL THEN
    -- Auto-create supplier from bill data
    INSERT INTO suppliers (business_id, name, type, default_method, notes, status, auto_synced)
    VALUES (v_bill.business_id, v_bill.vendor_name, 'other', 'kcb_paybill',
            'Auto-created from ' || v_bill.provider || ' bill ' || COALESCE(v_bill.doc_number, v_bill.external_id),
            'active', TRUE)
    RETURNING id INTO v_sup_id;
  END IF;

  -- Determine payment method
  v_method := COALESCE(p_method,
    (SELECT default_method FROM suppliers WHERE id = v_sup_id),
    'kcb_paybill'
  );

  -- Create payment schedule
  INSERT INTO payment_schedules (
    business_id, supplier_id, title, description, amount,
    payment_method, frequency, start_date, next_due_date,
    requires_approval, auto_execute, status, created_by,
    notes
  ) VALUES (
    v_bill.business_id, v_sup_id,
    COALESCE(v_bill.doc_number, v_bill.vendor_name || ' — ' || v_bill.bill_date::TEXT),
    v_bill.description,
    v_bill.total_amount,
    v_method, 'once', v_bill.due_date, v_bill.due_date,
    TRUE, FALSE, 'active', p_user_id,
    'Imported from ' || v_bill.provider || ' | Ref: ' || COALESCE(v_bill.doc_number,'') ||
    CASE WHEN v_bill.kra_pin_missing THEN ' | ⚠️ Vendor KRA PIN missing' ELSE '' END
  )
  RETURNING id INTO v_sched_id;

  -- Mark bill as accepted
  UPDATE external_bills
  SET status = 'accepted', accepted_schedule_id = v_sched_id,
      reviewed_by = p_user_id, reviewed_at = NOW()
  WHERE id = p_bill_id;

  RETURN v_sched_id;
END;
$$;
