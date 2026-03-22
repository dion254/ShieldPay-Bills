-- ============================================================
-- ShieldPay v4 — Complete Database Schema
-- Industries: Restaurants · Logistics ONLY
-- Super Admin: diondickson3@gmail.com
-- Run in: Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ─── BUSINESSES ──────────────────────────────────────────────
CREATE TABLE public.businesses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  industry        TEXT NOT NULL DEFAULT 'restaurant'
                  CHECK (industry IN ('restaurant','logistics')),
  registration_no TEXT,
  kra_pin         TEXT,
  address         TEXT,
  county          TEXT,
  phone           TEXT,
  email           TEXT,
  status          TEXT NOT NULL DEFAULT 'trial'
                  CHECK (status IN ('trial','active','suspended')),
  trial_ends_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  plan            TEXT NOT NULL DEFAULT 'starter'
                  CHECK (plan IN ('starter','growth','enterprise')),
  owner_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_biz BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── BUSINESS MEMBERS ────────────────────────────────────────
CREATE TABLE public.business_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  email       TEXT NOT NULL,
  full_name   TEXT,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('owner','admin','finance_manager','approver','viewer')),
  status      TEXT NOT NULL DEFAULT 'invited'
              CHECK (status IN ('active','invited','suspended')),
  invited_at  TIMESTAMPTZ DEFAULT NOW(),
  joined_at   TIMESTAMPTZ,
  UNIQUE (business_id, email)
);
CREATE INDEX idx_mem_uid ON business_members(user_id);
CREATE INDEX idx_mem_bid ON business_members(business_id);

-- ─── SUPPLIERS ───────────────────────────────────────────────
CREATE TABLE public.suppliers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'paybill'
                  CHECK (type IN ('bank','paybill','till','mobile_money','other')),
  paybill_number  TEXT,
  account_number  TEXT,
  till_number     TEXT,
  phone_number    TEXT,
  bank_name       TEXT,
  bank_branch     TEXT,
  bank_account    TEXT,
  bank_swift      TEXT,
  bank_code       TEXT,
  kra_pin         TEXT,
  contact_name    TEXT,
  contact_phone   TEXT,
  contact_email   TEXT,
  default_method  TEXT NOT NULL DEFAULT 'kcb_paybill'
                  CHECK (default_method IN ('pesalink','kcb_paybill','kcb_till','kcb_mobile')),
  category        TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_sup BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_sup_bid ON suppliers(business_id, status);

-- ─── PAYMENT SCHEDULES ───────────────────────────────────────
CREATE TABLE public.payment_schedules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id       UUID NOT NULL REFERENCES suppliers(id),
  title             TEXT NOT NULL,
  description       TEXT,
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method    TEXT NOT NULL
                    CHECK (payment_method IN ('pesalink','kcb_paybill','kcb_till','kcb_mobile')),
  account_override  TEXT,
  reference         TEXT,
  notes             TEXT,
  frequency         TEXT NOT NULL DEFAULT 'monthly'
                    CHECK (frequency IN ('once','daily','weekly','biweekly','monthly','quarterly','biannual','yearly')),
  start_date        DATE NOT NULL,
  end_date          DATE,
  next_due_date     DATE NOT NULL,
  last_paid_date    DATE,
  last_paid_amount  NUMERIC(14,2),
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  auto_execute      BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_days     INT NOT NULL DEFAULT 3,
  budget_category   TEXT,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','completed','cancelled')),
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_sch BEFORE UPDATE ON payment_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_sch_biz_due ON payment_schedules(business_id, next_due_date, status);

-- ─── PAYMENT REQUESTS ────────────────────────────────────────
CREATE TABLE public.payment_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  schedule_id      UUID REFERENCES payment_schedules(id),
  supplier_id      UUID NOT NULL REFERENCES suppliers(id),
  title            TEXT NOT NULL,
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  platform_fee     NUMERIC(8,2)  NOT NULL DEFAULT 0, -- Always 0: subscription-only model, no per-transaction fees
  total_debit      NUMERIC(14,2) GENERATED ALWAYS AS (amount + platform_fee) STORED,
  payment_method   TEXT NOT NULL
                   CHECK (payment_method IN ('pesalink','kcb_paybill','kcb_till','kcb_mobile')),
  account_ref      TEXT,
  reference        TEXT,
  notes            TEXT,
  due_date         DATE NOT NULL,
  budget_category  TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','pending_approval','approved','rejected',
                                     'scheduled','executing','completed','failed','cancelled')),
  requested_by     UUID NOT NULL REFERENCES auth.users(id),
  approved_by      UUID REFERENCES auth.users(id),
  rejected_by      UUID REFERENCES auth.users(id),
  executed_by      UUID REFERENCES auth.users(id),
  requested_at     TIMESTAMPTZ DEFAULT NOW(),
  approved_at      TIMESTAMPTZ,
  rejected_at      TIMESTAMPTZ,
  executed_at      TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  mpesa_receipt    TEXT,
  bank_reference   TEXT,
  failure_reason   TEXT,
  stk_checkout_id  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER trg_pr BEFORE UPDATE ON payment_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_pr_biz_status ON payment_requests(business_id, status, due_date);
CREATE INDEX idx_pr_schedule   ON payment_requests(schedule_id);
CREATE INDEX idx_pr_supplier   ON payment_requests(supplier_id);

-- ─── PAYMENT RECEIPTS (auto-generated on completion) ─────────
CREATE SEQUENCE IF NOT EXISTS receipt_seq START 1;

CREATE TABLE public.payment_receipts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_id       UUID NOT NULL REFERENCES payment_requests(id) ON DELETE CASCADE,
  receipt_number   TEXT NOT NULL UNIQUE,
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  business_name    TEXT NOT NULL,
  business_kra_pin TEXT,
  supplier_name    TEXT NOT NULL,
  supplier_type    TEXT NOT NULL,
  payment_method   TEXT NOT NULL,
  amount           NUMERIC(14,2) NOT NULL,
  platform_fee     NUMERIC(8,2)  NOT NULL DEFAULT 0, -- Always 0: subscription-only model, no per-transaction fees
  total_debit      NUMERIC(14,2) NOT NULL,
  reference        TEXT,
  mpesa_receipt    TEXT,
  bank_reference   TEXT,
  narration        TEXT,
  paid_by_name     TEXT,
  paid_by_email    TEXT,
  budget_category  TEXT,
  vat_applicable   BOOLEAN NOT NULL DEFAULT FALSE,
  vat_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount       NUMERIC(14,2) NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rcpt_biz ON payment_receipts(business_id, issued_at DESC);
CREATE INDEX idx_rcpt_pay ON payment_receipts(payment_id);
CREATE INDEX idx_rcpt_num ON payment_receipts(receipt_number);

CREATE OR REPLACE FUNCTION gen_receipt_no()
RETURNS TEXT AS $$
  SELECT 'SP-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(NEXTVAL('receipt_seq')::TEXT,6,'0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION auto_create_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_biz        businesses%ROWTYPE;
  v_sup        suppliers%ROWTYPE;
  v_paid_name  TEXT;
  v_paid_email TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT * INTO v_biz FROM businesses WHERE id = NEW.business_id;
    SELECT * INTO v_sup FROM suppliers   WHERE id = NEW.supplier_id;
    SELECT COALESCE(bm.full_name, au.email), au.email
    INTO v_paid_name, v_paid_email
    FROM auth.users au
    LEFT JOIN business_members bm ON bm.user_id = au.id AND bm.business_id = NEW.business_id
    WHERE au.id = COALESCE(NEW.executed_by, NEW.requested_by) LIMIT 1;

    INSERT INTO payment_receipts (
      business_id, payment_id, receipt_number, issued_at,
      business_name, business_kra_pin,
      supplier_name, supplier_type, payment_method,
      amount, platform_fee, total_debit,
      reference, mpesa_receipt, bank_reference, narration,
      paid_by_name, paid_by_email, budget_category, net_amount
    ) VALUES (
      NEW.business_id, NEW.id, gen_receipt_no(), NOW(),
      v_biz.name, v_biz.kra_pin,
      v_sup.name, v_sup.type, NEW.payment_method,
      NEW.amount, NEW.platform_fee, NEW.amount + NEW.platform_fee,
      NEW.reference, NEW.mpesa_receipt, NEW.bank_reference, NEW.notes,
      v_paid_name, v_paid_email, NEW.budget_category, NEW.amount
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_receipt
  AFTER UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION auto_create_receipt();

-- ─── CASH FLOW SNAPSHOTS ─────────────────────────────────────
CREATE TABLE public.cash_flow_snapshots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  month         DATE NOT NULL,
  total_paid    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_fees    NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_count INT NOT NULL DEFAULT 0,
  by_category   JSONB DEFAULT '{}',
  by_method     JSONB DEFAULT '{}',
  total_scheduled NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (business_id, month)
);
CREATE TRIGGER trg_cf BEFORE UPDATE ON cash_flow_snapshots FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_cf_biz_month ON cash_flow_snapshots(business_id, month DESC);

CREATE OR REPLACE FUNCTION update_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_month DATE := DATE_TRUNC('month', NEW.issued_at)::DATE;
  v_cat   TEXT := COALESCE(NEW.budget_category, 'Other');
BEGIN
  INSERT INTO cash_flow_snapshots (business_id, month, total_paid, total_fees, payment_count, by_category, by_method)
  VALUES (
    NEW.business_id, v_month, NEW.amount, NEW.platform_fee, 1,
    jsonb_build_object(v_cat, NEW.amount),
    jsonb_build_object(NEW.payment_method, NEW.amount)
  )
  ON CONFLICT (business_id, month) DO UPDATE SET
    total_paid    = cash_flow_snapshots.total_paid + NEW.amount,
    total_fees    = cash_flow_snapshots.total_fees + NEW.platform_fee,
    payment_count = cash_flow_snapshots.payment_count + 1,
    by_category   = cash_flow_snapshots.by_category ||
                    jsonb_build_object(v_cat,
                      COALESCE((cash_flow_snapshots.by_category->>v_cat)::NUMERIC, 0) + NEW.amount),
    by_method     = cash_flow_snapshots.by_method ||
                    jsonb_build_object(NEW.payment_method,
                      COALESCE((cash_flow_snapshots.by_method->>NEW.payment_method)::NUMERIC, 0) + NEW.amount),
    updated_at    = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_cashflow
  AFTER INSERT ON payment_receipts
  FOR EACH ROW EXECUTE FUNCTION update_cash_flow();

-- ─── AUDIT LOGS ──────────────────────────────────────────────
CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  user_email  TEXT,
  user_role   TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_biz ON audit_logs(business_id, created_at DESC);

-- ─── NOTIFICATIONS ───────────────────────────────────────────
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  entity_id   UUID,
  entity_type TEXT,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  action_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id, read, created_at DESC);

-- ─── BUDGET LINES ────────────────────────────────────────────
CREATE TABLE public.budget_lines (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  monthly_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  fiscal_year    INT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (business_id, category, fiscal_year)
);
CREATE TRIGGER trg_bgt BEFORE UPDATE ON budget_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()) = 'diondickson3@gmail.com', FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_member(p UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM business_members WHERE business_id=p AND user_id=auth.uid() AND status='active');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_biz_admin(p UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM business_members WHERE business_id=p AND user_id=auth.uid() AND status='active' AND role IN ('owner','admin'));
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_member_role(p UUID)
RETURNS TEXT AS $$
  SELECT role FROM business_members WHERE business_id=p AND user_id=auth.uid() AND status='active' LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE businesses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines        ENABLE ROW LEVEL SECURITY;

CREATE POLICY biz_sel  ON businesses FOR SELECT  USING (is_super_admin() OR is_member(id));
CREATE POLICY biz_ins  ON businesses FOR INSERT  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY biz_upd  ON businesses FOR UPDATE  USING (owner_user_id = auth.uid() OR is_super_admin());

CREATE POLICY mem_sel  ON business_members FOR SELECT  USING (is_super_admin() OR user_id=auth.uid() OR is_biz_admin(business_id));
CREATE POLICY mem_ins  ON business_members FOR INSERT  WITH CHECK (is_biz_admin(business_id) OR is_super_admin() OR business_id IN (SELECT id FROM businesses WHERE owner_user_id=auth.uid()));
CREATE POLICY mem_upd  ON business_members FOR UPDATE  USING (is_biz_admin(business_id) OR is_super_admin());

CREATE POLICY sup_sel  ON suppliers FOR SELECT  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY sup_ins  ON suppliers FOR INSERT  WITH CHECK (is_biz_admin(business_id) OR is_super_admin());
CREATE POLICY sup_upd  ON suppliers FOR UPDATE  USING (is_biz_admin(business_id) OR is_super_admin());

CREATE POLICY sch_sel  ON payment_schedules FOR SELECT  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY sch_ins  ON payment_schedules FOR INSERT  WITH CHECK (is_super_admin() OR get_member_role(business_id) IN ('owner','admin','finance_manager'));
CREATE POLICY sch_upd  ON payment_schedules FOR UPDATE  USING (is_super_admin() OR get_member_role(business_id) IN ('owner','admin','finance_manager'));

CREATE POLICY pr_sel   ON payment_requests FOR SELECT  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY pr_ins   ON payment_requests FOR INSERT  WITH CHECK (is_super_admin() OR get_member_role(business_id) IN ('owner','admin','finance_manager'));
CREATE POLICY pr_upd   ON payment_requests FOR UPDATE  USING (is_super_admin() OR is_member(business_id));

CREATE POLICY rcpt_sel ON payment_receipts FOR SELECT  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY rcpt_ins ON payment_receipts FOR INSERT  WITH CHECK (TRUE);

CREATE POLICY cf_sel   ON cash_flow_snapshots FOR SELECT  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY cf_ins   ON cash_flow_snapshots FOR INSERT  WITH CHECK (TRUE);
CREATE POLICY cf_upd   ON cash_flow_snapshots FOR UPDATE  USING (TRUE);

CREATE POLICY audit_sel ON audit_logs FOR SELECT  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY audit_ins ON audit_logs FOR INSERT  WITH CHECK (TRUE);

CREATE POLICY notif_sel ON notifications FOR SELECT  USING (user_id=auth.uid() OR is_super_admin());
CREATE POLICY notif_ins ON notifications FOR INSERT  WITH CHECK (TRUE);
CREATE POLICY notif_upd ON notifications FOR UPDATE  USING (user_id=auth.uid());

CREATE POLICY bgt_sel  ON budget_lines FOR SELECT  USING (is_super_admin() OR is_member(business_id));
CREATE POLICY bgt_ins  ON budget_lines FOR INSERT  WITH CHECK (is_biz_admin(business_id) OR is_super_admin());
CREATE POLICY bgt_upd  ON budget_lines FOR UPDATE  USING (is_biz_admin(business_id) OR is_super_admin());

-- ============================================================
-- VERIFY
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' ORDER BY table_name;

-- To generate a secure auto-password for the super admin account:
-- SELECT encode(gen_random_bytes(16), 'hex');
