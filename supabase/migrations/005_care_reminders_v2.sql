-- ==============================================================================
-- WildDex - Care Reminders v2 & complete_reminder RPC Additive Migration
-- File: supabase/migrations/005_care_reminders_v2.sql
--
-- IMPORTANT:
--   * Strictly additive and idempotent (safe to re-run).
--   * Preserves all existing tables, records, triggers, policies, and RPCs.
--   * Upgrades public.care_reminders to support next_due, reminder_type,
--     repeat_days (1..730), is_active, and adds complete_reminder(p_id).
-- ==============================================================================

-- 1. Ensure care_reminders table exists and has v2 columns
CREATE TABLE IF NOT EXISTS public.care_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES public.care_subjects(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL CHECK (char_length(TRIM(title)) BETWEEN 1 AND 180),
  reminder_type TEXT NOT NULL DEFAULT 'other' CHECK (
    reminder_type IN (
      'watering',
      'feeding',
      'vet_visit',
      'vaccination',
      'grooming',
      'pruning',
      'treatment',
      'other'
    )
  ),
  next_due DATE NOT NULL DEFAULT CURRENT_DATE,
  repeat_days INT CHECK (repeat_days IS NULL OR (repeat_days >= 1 AND repeat_days <= 730)),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.care_reminders
  ADD COLUMN IF NOT EXISTS reminder_type TEXT NOT NULL DEFAULT 'other';
ALTER TABLE public.care_reminders
  ADD COLUMN IF NOT EXISTS next_due DATE;
ALTER TABLE public.care_reminders
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.care_reminders
  ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMPTZ;
ALTER TABLE public.care_reminders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- Backfill from legacy due_at / is_completed columns if migrating from 003_my_care.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'care_reminders' AND column_name = 'due_at'
  ) THEN
    EXECUTE '
      UPDATE public.care_reminders
      SET next_due = COALESCE(next_due, (due_at AT TIME ZONE ''utc'')::date, CURRENT_DATE)
      WHERE next_due IS NULL
    ';
    EXECUTE 'ALTER TABLE public.care_reminders ALTER COLUMN due_at DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'care_reminders' AND column_name = 'is_completed'
  ) THEN
    EXECUTE '
      UPDATE public.care_reminders
      SET is_active = NOT COALESCE(is_completed, false)
      WHERE is_completed = true AND is_active = true
    ';
  END IF;
END;
$$;

UPDATE public.care_reminders
SET next_due = CURRENT_DATE
WHERE next_due IS NULL;

ALTER TABLE public.care_reminders
  ALTER COLUMN next_due SET DEFAULT CURRENT_DATE,
  ALTER COLUMN next_due SET NOT NULL;

-- Add/refresh clean checks safely
ALTER TABLE public.care_reminders DROP CONSTRAINT IF EXISTS chk_care_reminders_type;
ALTER TABLE public.care_reminders
  ADD CONSTRAINT chk_care_reminders_type CHECK (
    reminder_type IN (
      'watering',
      'feeding',
      'vet_visit',
      'vaccination',
      'grooming',
      'pruning',
      'treatment',
      'other'
    )
  );

ALTER TABLE public.care_reminders DROP CONSTRAINT IF EXISTS chk_care_reminders_repeat_days;
ALTER TABLE public.care_reminders
  ADD CONSTRAINT chk_care_reminders_repeat_days CHECK (
    repeat_days IS NULL OR (repeat_days >= 1 AND repeat_days <= 730)
  );

CREATE INDEX IF NOT EXISTS idx_care_reminders_active_due
  ON public.care_reminders(owner_id, is_active, next_due ASC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_care_reminders_subject_active
  ON public.care_reminders(owner_id, subject_id, is_active, next_due ASC);

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

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.touch_care_reminders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_care_reminders_updated_at ON public.care_reminders;
CREATE TRIGGER trg_care_reminders_updated_at
  BEFORE UPDATE ON public.care_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_care_reminders_updated_at();

-- 2. RPC: complete_reminder(p_id UUID)
-- Atomically logs a diary entry in care_entries and either advances next_due
-- (for repeating reminders) or deactivates a one-time reminder.
CREATE OR REPLACE FUNCTION public.complete_reminder(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reminder public.care_reminders%ROWTYPE;
  v_entry_type TEXT;
  v_entry_id UUID;
  v_next_due DATE;
  v_now TIMESTAMPTZ := TIMEZONE('utc'::text, NOW());
  v_today DATE := (TIMEZONE('utc'::text, NOW()))::date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Reminder id is required';
  END IF;

  SELECT *
  INTO v_reminder
  FROM public.care_reminders
  WHERE id = p_id
    AND owner_id = v_user_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active reminder not found';
  END IF;

  v_entry_type := CASE v_reminder.reminder_type
    WHEN 'other' THEN 'note'
    ELSE v_reminder.reminder_type
  END;

  INSERT INTO public.care_entries (
    owner_id,
    subject_id,
    entry_type,
    entry_date,
    title,
    notes
  )
  VALUES (
    v_user_id,
    v_reminder.subject_id,
    v_entry_type,
    v_today,
    v_reminder.title,
    'Completed from reminder'
  )
  RETURNING id INTO v_entry_id;

  IF v_reminder.repeat_days IS NOT NULL AND v_reminder.repeat_days > 0 THEN
    v_next_due := v_today + v_reminder.repeat_days;
    UPDATE public.care_reminders
    SET
      next_due = v_next_due,
      last_completed_at = v_now,
      updated_at = v_now
    WHERE id = v_reminder.id
      AND owner_id = v_user_id;

    RETURN jsonb_build_object(
      'reminder_id', v_reminder.id,
      'entry_id', v_entry_id,
      'is_active', true,
      'next_due', v_next_due
    );
  ELSE
    UPDATE public.care_reminders
    SET
      is_active = false,
      last_completed_at = v_now,
      updated_at = v_now
    WHERE id = v_reminder.id
      AND owner_id = v_user_id;

    RETURN jsonb_build_object(
      'reminder_id', v_reminder.id,
      'entry_id', v_entry_id,
      'is_active', false,
      'next_due', v_reminder.next_due
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_reminder(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_reminder(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
