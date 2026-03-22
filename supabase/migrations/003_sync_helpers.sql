-- ============================================================
-- Migration 003: pgcrypto RPC helpers for token encryption
-- Used by accounting sync adapters to encrypt/decrypt OAuth tokens
-- ============================================================

-- Requires pgcrypto extension (already enabled in migration 001)

-- ─── Encrypt a plaintext token ───────────────────────────────
-- Returns: base64-encoded ciphertext
-- Usage: SELECT encrypt_token('my_access_token', 'my-32-char-secret-key-here!!!!');
CREATE OR REPLACE FUNCTION encrypt_token(p_plaintext TEXT, p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(p_plaintext, p_key, 'cipher-algo=aes256'),
    'base64'
  );
END;
$$;

-- ─── Decrypt a ciphertext token ──────────────────────────────
-- Returns: plaintext token string
CREATE OR REPLACE FUNCTION decrypt_token(p_ciphertext TEXT, p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(p_ciphertext, 'base64'),
    p_key
  );
END;
$$;

-- ─── Revoke all tokens for a business (GDPR / offboarding) ───
CREATE OR REPLACE FUNCTION revoke_integrations(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE accounting_integrations
  SET status            = 'revoked',
      access_token_enc  = encode(gen_random_bytes(32), 'base64'), -- overwrite with noise
      refresh_token_enc = encode(gen_random_bytes(32), 'base64'),
      updated_at        = NOW()
  WHERE business_id = p_business_id;
END;
$$;

-- ─── Cron: trigger polling sync via pg_cron ───────────────────
-- Requires: pg_cron extension (enable in Supabase dashboard)
-- Schedule: every 10 minutes
-- Calls the Edge Function poll endpoint
-- NOTE: Replace <SUPABASE_PROJECT_REF> and <CRON_SECRET> with real values

-- SELECT cron.schedule(
--   'dion-accounting-poll',
--   '*/10 * * * *',
--   $$
--   SELECT net.http_post(
--     url    := 'https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/accounting-sync/poll',
--     headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
--     body   := '{}'::jsonb
--   );
--   $$
-- );

-- ─── Trigger: auto-push to accounting when payment completes ──
-- Calls the /sync/push endpoint after a payment_request is marked completed.
-- Uses pg_net extension for async HTTP (non-blocking).
CREATE OR REPLACE FUNCTION trigger_accounting_push()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
BEGIN
  -- Only fire when status transitions to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Check if this payment's business has any active integrations
    PERFORM 1
    FROM accounting_integrations
    WHERE business_id = NEW.business_id
      AND status = 'active'
    LIMIT 1;

    IF FOUND THEN
      -- Async HTTP call via pg_net (non-blocking, won't delay payment flow)
      -- Requires pg_net extension enabled in Supabase
      v_supabase_url := current_setting('app.supabase_url', TRUE);
      v_service_key  := current_setting('app.service_role_key', TRUE);

      -- In production, replace with actual values from Vault
      PERFORM net.http_post(
        url     := v_supabase_url || '/functions/v1/accounting-sync/sync/push',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body    := jsonb_build_object('paymentRequestId', NEW.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_accounting_push
  AFTER UPDATE ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_accounting_push();

-- ─── View: sync dashboard summary ────────────────────────────
CREATE OR REPLACE VIEW v_sync_dashboard AS
SELECT
  ai.business_id,
  ai.provider,
  ai.status                                             AS integration_status,
  ai.last_sync_at                                       AT TIME ZONE 'Africa/Nairobi' AS last_sync_eat,
  ai.last_sync_status,
  ai.consecutive_errors,
  ROUND(EXTRACT(EPOCH FROM (NOW() - ai.last_sync_at)) / 60)::INT
                                                        AS mins_since_sync,
  COUNT(se_ok.id)                                       AS syncs_ok_24h,
  COUNT(se_err.id)                                      AS syncs_err_24h,
  COUNT(bm_pend.id)                                     AS bills_pending,
  COUNT(bm_paid.id)                                     AS bills_reconciled,
  COALESCE(SUM(bm_paid_amt.raw_snapshot->>'total_amount')::NUMERIC, 0)
                                                        AS total_reconciled_kes
FROM accounting_integrations ai
LEFT JOIN sync_events se_ok   ON se_ok.integration_id = ai.id
  AND se_ok.status = 'ok'   AND se_ok.created_at > NOW() - INTERVAL '24 hours'
LEFT JOIN sync_events se_err  ON se_err.integration_id = ai.id
  AND se_err.status = 'error' AND se_err.created_at > NOW() - INTERVAL '24 hours'
LEFT JOIN bill_mappings bm_pend ON bm_pend.integration_id = ai.id
  AND bm_pend.sync_status = 'pending'
LEFT JOIN bill_mappings bm_paid ON bm_paid.integration_id = ai.id
  AND bm_paid.sync_status = 'paid'
LEFT JOIN bill_mappings bm_paid_amt ON bm_paid_amt.integration_id = ai.id
  AND bm_paid_amt.sync_status = 'paid'
GROUP BY ai.id;

COMMENT ON VIEW v_sync_dashboard IS
  'Aggregated sync health metrics per integration; used by Settings UI health card';
