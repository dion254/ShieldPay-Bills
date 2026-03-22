-- ============================================================
-- Migration 005: Subscription Enforcement
-- Ensures platform_fee is always 0 (subscription-only model)
-- Adds trial expiry check and plan limit enforcement
-- ============================================================

-- ─── ENFORCE ZERO PLATFORM FEES ──────────────────────────────
-- Trigger: always set platform_fee=0 on payment_requests
CREATE OR REPLACE FUNCTION enforce_zero_fee()
RETURNS TRIGGER AS $$
BEGIN
  NEW.platform_fee := 0;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_zero_fee
  BEFORE INSERT OR UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION enforce_zero_fee();

-- ─── TRIAL STATUS CHECK ───────────────────────────────────────
-- Function: check if business is allowed to execute payments
CREATE OR REPLACE FUNCTION can_execute_payment(p_business_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_biz businesses%ROWTYPE;
BEGIN
  SELECT * INTO v_biz FROM businesses WHERE id = p_business_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Active subscription = always allowed
  IF v_biz.status = 'active' THEN RETURN TRUE; END IF;

  -- Trial = allowed if not expired
  IF v_biz.status = 'trial' AND v_biz.trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── SCHEDULE LIMIT ENFORCEMENT ──────────────────────────────
CREATE OR REPLACE FUNCTION check_schedule_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_count  INT;
  v_max    INT;
  v_plan   TEXT;
  v_status TEXT;
  v_trial_end TIMESTAMPTZ;
BEGIN
  SELECT plan, status, trial_ends_at INTO v_plan, v_status, v_trial_end
  FROM businesses WHERE id = NEW.business_id;

  -- Trial expired check
  IF v_status = 'trial' AND v_trial_end < NOW() THEN
    RAISE EXCEPTION 'Trial expired. Please subscribe to continue creating bill schedules.';
  END IF;

  IF v_status = 'suspended' THEN
    RAISE EXCEPTION 'Account suspended. Please contact support.';
  END IF;

  -- Count active schedules
  SELECT COUNT(*) INTO v_count
  FROM payment_schedules
  WHERE business_id = NEW.business_id AND status NOT IN ('cancelled','completed');

  -- Get max from plan
  v_max := CASE v_plan
    WHEN 'starter'    THEN 20
    WHEN 'growth'     THEN 100
    WHEN 'enterprise' THEN 999999
    ELSE 5
  END;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Plan limit reached (% of % schedules). Upgrade to add more.', v_count, v_max;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_schedule_limit
  BEFORE INSERT ON payment_schedules
  FOR EACH ROW EXECUTE FUNCTION check_schedule_limit();

-- ─── VIRAL LOOP: receipt branded footer ──────────────────────
-- View for receipt display including ShieldPay branding
CREATE OR REPLACE VIEW v_branded_receipts AS
SELECT
  pr.*,
  'Paid securely via ShieldPay · shieldpay.ke' AS powered_by,
  'Receipt verified. Zero manual work.' AS tagline
FROM payment_receipts pr;

COMMENT ON VIEW v_branded_receipts IS
  'Receipt view with ShieldPay branding for viral loop';
