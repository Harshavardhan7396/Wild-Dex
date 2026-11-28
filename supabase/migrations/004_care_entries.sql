-- ==============================================================================
-- WildDex - My Care Entries Additive Migration
-- File: supabase/migrations/004_care_entries.sql
--
-- IMPORTANT:
--   * Strictly additive and idempotent (safe to re-run).
--   * Preserves all existing tables, records, triggers, policies, and RPCs.
--   * Requires 003_my_care.sql (care_subjects, care_reminders, private 'care' bucket).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.care_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.care_subjects(id) ON DELETE CASCADE NOT NULL,
  entry_type TEXT NOT NULL CHECK (char_length(TRIM(entry_type)) BETWEEN 1 AND 60),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL CHECK (char_length(TRIM(title)) BETWEEN 1 AND 180),
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  value DOUBLE PRECISION CHECK (value IS NULL OR value >= 0),
  unit TEXT NOT NULL DEFAULT '' CHECK (unit IN ('', 'kg', 'lb', 'cm')),
  photo_path TEXT NOT NULL DEFAULT '' CHECK (char_length(photo_path) <= 512),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_care_entries_subject_timeline
  ON public.care_entries(owner_id, subject_id, entry_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_care_entries_subject_type
  ON public.care_entries(owner_id, subject_id, entry_type, entry_date ASC);

ALTER TABLE public.care_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own care_entries" ON public.care_entries;
CREATE POLICY "Users can view own care_entries"
  ON public.care_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own care_entries" ON public.care_entries;
CREATE POLICY "Users can insert own care_entries"
  ON public.care_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.care_subjects s
      WHERE s.id = subject_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own care_entries" ON public.care_entries;
CREATE POLICY "Users can update own care_entries"
  ON public.care_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.care_subjects s
      WHERE s.id = subject_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own care_entries" ON public.care_entries;
CREATE POLICY "Users can delete own care_entries"
  ON public.care_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.touch_care_entries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_care_entries_updated_at ON public.care_entries;
CREATE TRIGGER trg_care_entries_updated_at
  BEFORE UPDATE ON public.care_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_care_entries_updated_at();

NOTIFY pgrst, 'reload schema';
