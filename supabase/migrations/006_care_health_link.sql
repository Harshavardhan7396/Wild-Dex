-- ==============================================================================
-- WildDex - Connect Health Help & Collection to My Care Additive Migration
-- File: supabase/migrations/006_care_health_link.sql
--
-- IMPORTANT:
--   * Strictly additive and idempotent (safe to re-run).
--   * Preserves all existing tables, records, triggers, policies, and RPCs.
--   * Requires 003_my_care.sql and 004_care_entries.sql.
-- ==============================================================================

ALTER TABLE public.care_entries
  ADD COLUMN IF NOT EXISTS health_result JSONB;

CREATE INDEX IF NOT EXISTS idx_care_entries_has_health_result
  ON public.care_entries(subject_id, entry_date DESC)
  WHERE health_result IS NOT NULL;

NOTIFY pgrst, 'reload schema';
