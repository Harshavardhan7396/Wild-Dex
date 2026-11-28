-- ==============================================================================
-- WildDex - My Care Additive Database & Private Storage Migration
-- File: supabase/migrations/003_my_care.sql
--
-- IMPORTANT:
--   * Strictly additive and idempotent (safe to re-run).
--   * Preserves all existing tables, records, triggers, policies, and RPCs.
--   * Run in Supabase Dashboard -> SQL Editor for your target project.
-- ==============================================================================

-- 1. CARE_SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS public.care_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('pet', 'plant', 'crop', 'tree')),
  name TEXT NOT NULL CHECK (char_length(TRIM(name)) BETWEEN 1 AND 120),
  species_common TEXT NOT NULL DEFAULT '' CHECK (char_length(species_common) <= 180),
  species_scientific TEXT NOT NULL DEFAULT '' CHECK (char_length(species_scientific) <= 180),
  inat_taxon_id BIGINT CHECK (inat_taxon_id IS NULL OR inat_taxon_id > 0),
  started_on DATE,
  sex TEXT NOT NULL DEFAULT '' CHECK (sex IN ('', 'male', 'female', 'unknown')),
  photo_path TEXT NOT NULL DEFAULT '' CHECK (char_length(photo_path) <= 512),
  extra_photo_paths TEXT[] NOT NULL DEFAULT '{}'::text[],
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_care_subjects_owner_active
  ON public.care_subjects(owner_id, archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_subjects_owner_kind
  ON public.care_subjects(owner_id, kind)
  WHERE archived = false;

ALTER TABLE public.care_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own care_subjects" ON public.care_subjects;
CREATE POLICY "Users can view own care_subjects"
  ON public.care_subjects FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own care_subjects" ON public.care_subjects;
CREATE POLICY "Users can insert own care_subjects"
  ON public.care_subjects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own care_subjects" ON public.care_subjects;
CREATE POLICY "Users can update own care_subjects"
  ON public.care_subjects FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own care_subjects" ON public.care_subjects;
CREATE POLICY "Users can delete own care_subjects"
  ON public.care_subjects FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.touch_care_subjects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_care_subjects_updated_at ON public.care_subjects;
CREATE TRIGGER trg_care_subjects_updated_at
  BEFORE UPDATE ON public.care_subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_care_subjects_updated_at();

-- 2. CARE_REMINDERS TABLE (powers due/overdue reminder indicator dot on My Care cards)
CREATE TABLE IF NOT EXISTS public.care_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES public.care_subjects(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL CHECK (char_length(TRIM(title)) BETWEEN 1 AND 180),
  due_at TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  repeat_days INT CHECK (repeat_days IS NULL OR repeat_days > 0),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_care_reminders_due
  ON public.care_reminders(owner_id, subject_id, due_at)
  WHERE is_completed = false;

ALTER TABLE public.care_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own care_reminders" ON public.care_reminders;
CREATE POLICY "Users can view own care_reminders"
  ON public.care_reminders FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own care_reminders" ON public.care_reminders;
CREATE POLICY "Users can insert own care_reminders"
  ON public.care_reminders FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.care_subjects s
      WHERE s.id = subject_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own care_reminders" ON public.care_reminders;
CREATE POLICY "Users can update own care_reminders"
  ON public.care_reminders FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.care_subjects s
      WHERE s.id = subject_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own care_reminders" ON public.care_reminders;
CREATE POLICY "Users can delete own care_reminders"
  ON public.care_reminders FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- 3. PRIVATE STORAGE BUCKET 'care' ({user_id}/{timestamp}.jpg)
INSERT INTO storage.buckets (id, name, public)
VALUES ('care', 'care', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Users can view their own care photos" ON storage.objects;
CREATE POLICY "Users can view their own care photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'care' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload their own care photos" ON storage.objects;
CREATE POLICY "Users can upload their own care photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'care' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own care photos" ON storage.objects;
CREATE POLICY "Users can update their own care photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'care' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'care' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own care photos" ON storage.objects;
CREATE POLICY "Users can delete their own care photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'care' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
