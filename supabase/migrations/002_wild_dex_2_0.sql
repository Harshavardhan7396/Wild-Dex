-- ==============================================================================
-- WildDex 2.0 - Phase 2 Additive Database Migration (Zero-Trust Hardened Final)
-- File: supabase/migrations/002_wild_dex_2_0.sql
--
-- IMPORTANT:
--   * Strictly additive and idempotent (safe to re-run).
--   * Preserves ALL existing tables, records, triggers, policies, and RPCs.
--   * Does NOT drop, rename, or mutate existing production tables.
--   * Run in Supabase Dashboard -> SQL Editor ONLY AFTER explicit approval.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 0. AUTHORITATIVE RARITY HELPER & TRUSTED_SPECIES_TAXA CATALOG
-- ==============================================================================

-- Server-only IUCN Red List conservation status -> rarity tier calculation.
-- Rarity tiers are NEVER derived from client-supplied collection_items.rarity.
CREATE OR REPLACE FUNCTION public.internal_compute_rarity_from_iucn(p_iucn_status TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE UPPER(TRIM(COALESCE(p_iucn_status, 'NE')))
    WHEN 'CR' THEN 'legendary'
    WHEN 'EW' THEN 'legendary'
    WHEN 'EX' THEN 'legendary'
    WHEN 'EN' THEN 'rare'
    WHEN 'VU' THEN 'rare'
    WHEN 'NT' THEN 'uncommon'
    ELSE 'common'
  END;
$$;

REVOKE ALL ON FUNCTION public.internal_compute_rarity_from_iucn(TEXT) FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.trusted_species_taxa (
  species_key TEXT PRIMARY KEY CHECK (char_length(species_key) BETWEEN 1 AND 180),
  inat_taxon_id BIGINT NOT NULL UNIQUE CHECK (inat_taxon_id > 0),
  scientific_name TEXT NOT NULL CHECK (char_length(scientific_name) BETWEEN 1 AND 180),
  common_name TEXT NOT NULL CHECK (char_length(common_name) BETWEEN 1 AND 180),
  category TEXT NOT NULL DEFAULT 'other' CHECK (
    category IN ('mammals', 'birds', 'reptiles', 'amphibians', 'insects', 'marine', 'plants', 'fungi', 'other')
  ),
  iucn_status TEXT NOT NULL DEFAULT 'LC' CHECK (
    iucn_status IN ('LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'NE')
  ),
  rarity_tier TEXT NOT NULL DEFAULT 'common' CHECK (
    rarity_tier IN ('common', 'uncommon', 'rare', 'legendary')
  ),
  source TEXT NOT NULL DEFAULT 'iNaturalist / IUCN Red List',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.trusted_species_taxa
  ADD COLUMN IF NOT EXISTS iucn_status TEXT NOT NULL DEFAULT 'LC';
ALTER TABLE public.trusted_species_taxa
  ADD COLUMN IF NOT EXISTS rarity_tier TEXT NOT NULL DEFAULT 'common';

ALTER TABLE public.trusted_species_taxa ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trusted_species_taxa FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.trusted_species_taxa TO anon, authenticated;

DROP POLICY IF EXISTS "Trusted species taxa are viewable by everyone" ON public.trusted_species_taxa;
CREATE POLICY "Trusted species taxa are viewable by everyone"
  ON public.trusted_species_taxa FOR SELECT
  USING (true);

-- ==============================================================================
-- 0B. SCAN_VERIFICATIONS (Server-Only One-Time Attestations from Scanner Backend)
-- ==============================================================================
-- Written exclusively by trusted server code (service_role) after Gemini +
-- server-side iNaturalist verification. Clients have zero read/write access.
CREATE TABLE IF NOT EXISTS public.scan_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  species_key TEXT NOT NULL CHECK (char_length(species_key) BETWEEN 2 AND 180),
  common_name TEXT NOT NULL CHECK (char_length(common_name) BETWEEN 1 AND 180),
  scientific_name TEXT NOT NULL CHECK (char_length(scientific_name) BETWEEN 1 AND 180),
  category TEXT NOT NULL DEFAULT 'other' CHECK (
    category IN ('mammals', 'birds', 'reptiles', 'amphibians', 'insects', 'marine', 'plants', 'fungi', 'other')
  ),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  taxonomic_rank TEXT NOT NULL DEFAULT 'unknown' CHECK (
    taxonomic_rank IN ('species', 'subspecies', 'genus', 'family', 'order', 'unknown')
  ),
  not_a_species BOOLEAN NOT NULL DEFAULT false,
  inat_taxon_id BIGINT CHECK (inat_taxon_id IS NULL OR inat_taxon_id > 0),
  iucn_status TEXT NOT NULL DEFAULT 'NE' CHECK (
    iucn_status IN ('LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'NE')
  ),
  server_rarity TEXT NOT NULL DEFAULT 'common' CHECK (
    server_rarity IN ('common', 'uncommon', 'rare', 'legendary')
  ),
  taxonomy_source TEXT NOT NULL DEFAULT 'ai_unverified' CHECK (
    taxonomy_source IN ('trusted_catalog', 'inaturalist_api', 'ai_unverified')
  ),
  is_taxonomy_confirmed BOOLEAN NOT NULL DEFAULT false,
  consumed_collection_item_id UUID REFERENCES public.collection_items(id) ON DELETE SET NULL,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_verifications_user ON public.scan_verifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_verifications_consumed ON public.scan_verifications(consumed_collection_item_id);

ALTER TABLE public.scan_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scan_verifications FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "No direct client access to scan_verifications" ON public.scan_verifications;
CREATE POLICY "No direct client access to scan_verifications"
  ON public.scan_verifications FOR ALL
  USING (false)
  WITH CHECK (false);

-- ==============================================================================
-- 1. USER_SPECIES (Canonical Personal Dex Species Unlocks)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_species (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  species_key TEXT NOT NULL CHECK (char_length(species_key) BETWEEN 1 AND 180),
  inat_taxon_id BIGINT CHECK (inat_taxon_id IS NULL OR inat_taxon_id > 0),
  common_name TEXT NOT NULL CHECK (char_length(common_name) BETWEEN 1 AND 180),
  scientific_name TEXT NOT NULL CHECK (char_length(scientific_name) BETWEEN 1 AND 180),
  category TEXT NOT NULL DEFAULT 'other' CHECK (char_length(category) BETWEEN 1 AND 60),
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'legendary')),
  verification_status TEXT NOT NULL DEFAULT 'scanner_unverified' CHECK (
    verification_status IN ('verified_taxonomy', 'scanner_unverified')
  ),
  taxonomy_source TEXT NOT NULL DEFAULT 'ai_unverified' CHECK (
    taxonomy_source IN ('trusted_catalog', 'inaturalist_api', 'ai_unverified')
  ),
  first_collection_item_id UUID REFERENCES public.collection_items(id) ON DELETE SET NULL,
  photo_url TEXT NOT NULL DEFAULT '' CHECK (
    char_length(photo_url) <= 2048
    AND (photo_url = '' OR photo_url ~* '^https?://' OR photo_url !~* ':')
  ),
  sighting_count INT NOT NULL DEFAULT 1 CHECK (sighting_count >= 1),
  first_discovered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, species_key)
);

ALTER TABLE public.user_species
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'scanner_unverified';
ALTER TABLE public.user_species
  ADD COLUMN IF NOT EXISTS taxonomy_source TEXT NOT NULL DEFAULT 'ai_unverified';
ALTER TABLE public.user_species
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_species_user_id ON public.user_species(user_id);
CREATE INDEX IF NOT EXISTS idx_user_species_species_key ON public.user_species(species_key);
CREATE INDEX IF NOT EXISTS idx_user_species_category ON public.user_species(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_species_first_discovered ON public.user_species(user_id, first_discovered_at DESC);

ALTER TABLE public.user_species ENABLE ROW LEVEL SECURITY;
-- Clients cannot insert, update, or delete canonical Dex unlock entries directly
-- (prevents deleting & re-scanning to re-trigger missions/counts).
REVOKE ALL ON public.user_species FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_species TO authenticated;

DROP POLICY IF EXISTS "Users can view own or public user_species" ON public.user_species;
CREATE POLICY "Users can view own or public user_species"
  ON public.user_species FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_species.user_id
        AND COALESCE(p.is_public, true) = true
    )
  );

DROP POLICY IF EXISTS "Users can remove species from own personal dex" ON public.user_species;

-- ==============================================================================
-- 2. USER_PROGRESSION (Authoritative XP, Level & Discovery Streaks)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_progression (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  total_xp BIGINT NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  current_streak INT NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INT NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  streak_started_date DATE,
  last_active_date DATE,
  unique_species_count INT NOT NULL DEFAULT 0 CHECK (unique_species_count >= 0),
  verified_species_count INT NOT NULL DEFAULT 0 CHECK (verified_species_count >= 0),
  total_scans_count INT NOT NULL DEFAULT 0 CHECK (total_scans_count >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.user_progression ADD COLUMN IF NOT EXISTS streak_started_date DATE;
ALTER TABLE public.user_progression ADD COLUMN IF NOT EXISTS verified_species_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_progression_xp ON public.user_progression(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_progression_streak ON public.user_progression(current_streak DESC);

ALTER TABLE public.user_progression ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_progression FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_progression TO authenticated;

DROP POLICY IF EXISTS "Users can view own or public progression" ON public.user_progression;
CREATE POLICY "Users can view own or public progression"
  ON public.user_progression FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_progression.user_id
        AND COALESCE(p.is_public, true) = true
    )
  );

-- ==============================================================================
-- 3. XP_TRANSACTIONS & PROCESSED_SCAN_REWARDS (Idempotent Ledger)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'first_scan',
      'repeat_scan',
      'unverified_scan',
      'mission_claim',
      'achievement_unlock',
      'daily_challenge',
      'weekly_challenge',
      'streak_bonus'
    )
  ),
  source_ref TEXT NOT NULL,
  xp_amount INT NOT NULL CHECK (xp_amount > 0 AND xp_amount <= 5000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, source_type, source_ref)
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_created ON public.xp_transactions(user_id, created_at DESC);

ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xp_transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.xp_transactions TO authenticated;

DROP POLICY IF EXISTS "Users can view own xp_transactions" ON public.xp_transactions;
CREATE POLICY "Users can view own xp_transactions"
  ON public.xp_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Prevents replaying record_species_discovery on the same collection_items.id
CREATE TABLE IF NOT EXISTS public.processed_scan_rewards (
  collection_item_id UUID REFERENCES public.collection_items(id) ON DELETE CASCADE PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  species_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_scan_rewards_user ON public.processed_scan_rewards(user_id);

ALTER TABLE public.processed_scan_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.processed_scan_rewards FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "No direct client access to processed_scan_rewards" ON public.processed_scan_rewards;
CREATE POLICY "No direct client access to processed_scan_rewards"
  ON public.processed_scan_rewards FOR ALL
  USING (false)
  WITH CHECK (false);

-- ==============================================================================
-- 4. ACHIEVEMENTS & USER_ACHIEVEMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'military_tech',
  category TEXT NOT NULL DEFAULT 'exploration',
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  target_metric TEXT NOT NULL CHECK (
    target_metric IN ('unique_species', 'total_scans', 'streak_days', 'level', 'posts_count', 'daily_wins')
  ),
  target_value INT NOT NULL CHECK (target_value > 0),
  xp_reward INT NOT NULL DEFAULT 50 CHECK (xp_reward >= 0 AND xp_reward <= 2000),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id, unlocked_at DESC);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.achievements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.achievements TO anon, authenticated;
REVOKE ALL ON public.user_achievements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_achievements TO authenticated;

DROP POLICY IF EXISTS "Achievements catalog is viewable by everyone" ON public.achievements;
CREATE POLICY "Achievements catalog is viewable by everyone"
  ON public.achievements FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Users can view own or public user_achievements" ON public.user_achievements;
CREATE POLICY "Users can view own or public user_achievements"
  ON public.user_achievements FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_achievements.user_id
        AND COALESCE(p.is_public, true) = true
    )
  );

-- ==============================================================================
-- 5. MISSIONS & MISSION_PROGRESS (Daily & Weekly WildQuest Missions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  action_type TEXT NOT NULL CHECK (
    action_type IN ('scan_any', 'scan_category', 'new_species', 'community_post', 'daily_challenge_play')
  ),
  target_category TEXT NOT NULL DEFAULT '',
  target_count INT NOT NULL DEFAULT 1 CHECK (target_count > 0),
  xp_reward INT NOT NULL DEFAULT 40 CHECK (xp_reward > 0 AND xp_reward <= 2000),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mission_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  period_key TEXT NOT NULL,
  current_count INT NOT NULL DEFAULT 0 CHECK (current_count >= 0),
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, mission_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_mission_progress_user_period ON public.mission_progress(user_id, period_key);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.missions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.missions TO anon, authenticated;
REVOKE ALL ON public.mission_progress FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mission_progress TO authenticated;

DROP POLICY IF EXISTS "Active missions are viewable by everyone" ON public.missions;
CREATE POLICY "Active missions are viewable by everyone"
  ON public.missions FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Users can view own mission_progress" ON public.mission_progress;
CREATE POLICY "Users can view own mission_progress"
  ON public.mission_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 6. SPECIES OF THE DAY (species_daily_challenges & species_daily_attempts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.species_daily_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_date DATE NOT NULL UNIQUE,
  species_key TEXT NOT NULL,
  answer_common_name TEXT NOT NULL,
  answer_scientific_name TEXT NOT NULL,
  accepted_aliases TEXT[] NOT NULL DEFAULT '{}'::text[],
  category TEXT NOT NULL DEFAULT 'other',
  ecosystem TEXT NOT NULL DEFAULT 'forest',
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  image_url TEXT NOT NULL,
  clues TEXT[] NOT NULL DEFAULT '{}'::text[],
  fun_fact TEXT NOT NULL DEFAULT '',
  source_citation TEXT NOT NULL DEFAULT 'iNaturalist / IUCN Red List',
  xp_reward INT NOT NULL DEFAULT 75 CHECK (xp_reward > 0 AND xp_reward <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_species_daily_date ON public.species_daily_challenges(challenge_date DESC);

CREATE TABLE IF NOT EXISTS public.species_daily_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID REFERENCES public.species_daily_challenges(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  attempt_number INT NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
  guess_text TEXT NOT NULL CHECK (char_length(guess_text) BETWEEN 1 AND 120),
  is_correct BOOLEAN NOT NULL DEFAULT false,
  xp_awarded INT NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(challenge_id, user_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_species_daily_attempts_user ON public.species_daily_attempts(user_id, challenge_id);

ALTER TABLE public.species_daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species_daily_attempts ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth: revoke direct table privileges on answer table from clients.
REVOKE ALL ON public.species_daily_challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.species_daily_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.species_daily_attempts TO authenticated;

DROP POLICY IF EXISTS "No direct client read on daily challenge answers" ON public.species_daily_challenges;
CREATE POLICY "No direct client read on daily challenge answers"
  ON public.species_daily_challenges FOR SELECT
  USING (false);

DROP POLICY IF EXISTS "Users can view own daily attempts" ON public.species_daily_attempts;
CREATE POLICY "Users can view own daily attempts"
  ON public.species_daily_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 7. SPECIES_RELATIONSHIPS (Verified Life Connections - Zero AI Fabrication)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.species_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_species_key TEXT NOT NULL,
  source_common_name TEXT NOT NULL,
  source_scientific_name TEXT NOT NULL,
  target_species_key TEXT NOT NULL,
  target_common_name TEXT NOT NULL,
  target_scientific_name TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (
    relationship_type IN (
      'predator_prey',
      'pollination',
      'seed_dispersal',
      'habitat_dependency',
      'symbiosis',
      'parasitism',
      'competition'
    )
  ),
  direction TEXT NOT NULL DEFAULT 'source_to_target' CHECK (direction IN ('source_to_target', 'bidirectional')),
  ecological_summary TEXT NOT NULL,
  source_citation TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(source_species_key, target_species_key, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_species_rel_source ON public.species_relationships(source_species_key);
CREATE INDEX IF NOT EXISTS idx_species_rel_target ON public.species_relationships(target_species_key);
CREATE INDEX IF NOT EXISTS idx_species_rel_type ON public.species_relationships(relationship_type);

ALTER TABLE public.species_relationships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.species_relationships FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.species_relationships TO anon, authenticated;

DROP POLICY IF EXISTS "Verified ecological relationships are viewable by everyone" ON public.species_relationships;
CREATE POLICY "Verified ecological relationships are viewable by everyone"
  ON public.species_relationships FOR SELECT
  USING (verified = true);

-- ==============================================================================
-- 8. SPECIES_OBSERVATIONS (Privacy-Rounded Opt-In Global Discovery Map)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.species_observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  collection_item_id UUID REFERENCES public.collection_items(id) ON DELETE SET NULL,
  species_key TEXT NOT NULL CHECK (char_length(species_key) BETWEEN 1 AND 180),
  species_name TEXT NOT NULL CHECK (char_length(species_name) BETWEEN 1 AND 180),
  scientific_name TEXT NOT NULL CHECK (char_length(scientific_name) BETWEEN 1 AND 180),
  category TEXT NOT NULL DEFAULT 'other' CHECK (char_length(category) BETWEEN 1 AND 60),
  ecosystem TEXT NOT NULL DEFAULT 'forest' CHECK (
    ecosystem IN ('forest', 'ocean', 'desert', 'mountain', 'grassland', 'freshwater', 'wetlands', 'microscopic')
  ),
  photo_url TEXT NOT NULL DEFAULT '' CHECK (
    char_length(photo_url) <= 2048
    AND (photo_url = '' OR photo_url ~* '^https?://')
  ),
  region_label TEXT NOT NULL DEFAULT '' CHECK (char_length(region_label) <= 120),
  rounded_lat DOUBLE PRECISION NOT NULL CHECK (rounded_lat BETWEEN -90 AND 90),
  rounded_lng DOUBLE PRECISION NOT NULL CHECK (rounded_lng BETWEEN -180 AND 180),
  is_public_map BOOLEAN NOT NULL DEFAULT false,
  observed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_species_obs_public_map ON public.species_observations(is_public_map, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_species_obs_ecosystem ON public.species_observations(ecosystem, is_public_map);
CREATE INDEX IF NOT EXISTS idx_species_obs_user_id ON public.species_observations(user_id);

-- Privacy Trigger: Reject non-finite coords and always round to 0.1 deg (~11 km grid)
CREATE OR REPLACE FUNCTION public.round_species_observation_coords()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.rounded_lat IS NULL OR NEW.rounded_lng IS NULL
     OR NEW.rounded_lat::text IN ('NaN', 'Infinity', '-Infinity')
     OR NEW.rounded_lng::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Valid latitude and longitude coordinates are required';
  END IF;

  NEW.rounded_lat := ROUND(NEW.rounded_lat::numeric, 1)::double precision;
  NEW.rounded_lng := ROUND(NEW.rounded_lng::numeric, 1)::double precision;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.round_species_observation_coords() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_round_species_observation_coords ON public.species_observations;
CREATE TRIGGER trg_round_species_observation_coords
  BEFORE INSERT OR UPDATE ON public.species_observations
  FOR EACH ROW EXECUTE FUNCTION public.round_species_observation_coords();

ALTER TABLE public.species_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.species_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.species_observations TO authenticated;

DROP POLICY IF EXISTS "Users view own or explicitly public non-private observations" ON public.species_observations;
CREATE POLICY "Users view own or explicitly public non-private observations"
  ON public.species_observations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      is_public_map = true
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = species_observations.user_id
          AND COALESCE(p.is_public, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own observations" ON public.species_observations;
CREATE POLICY "Users can insert own observations"
  ON public.species_observations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      collection_item_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.collection_items ci
        WHERE ci.id = collection_item_id AND ci.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own observations" ON public.species_observations;
CREATE POLICY "Users can update own observations"
  ON public.species_observations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      collection_item_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.collection_items ci
        WHERE ci.id = collection_item_id AND ci.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own observations" ON public.species_observations;
CREATE POLICY "Users can delete own observations"
  ON public.species_observations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 8B. SERVICE-ROLE-BYPASS-PROOF OWNERSHIP & IMMUTABILITY TRIGGERS
-- ==============================================================================
-- RLS is bypassed by service_role. Database triggers ALWAYS execute, ensuring
-- even service_role operations cannot link another user's collection_items row,
-- reassign user_id across accounts, mutate append-only XP ledgers, or un-consume
-- redeemed scan attestations.

CREATE OR REPLACE FUNCTION public.internal_enforce_scan_verification_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot reassign scan_verifications.user_id';
    END IF;
    IF OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at THEN
      RAISE EXCEPTION 'Cannot modify consumed_at on an already-redeemed scan verification';
    END IF;
    IF OLD.consumed_collection_item_id IS NOT NULL
       AND NEW.consumed_collection_item_id IS NOT NULL
       AND NEW.consumed_collection_item_id IS DISTINCT FROM OLD.consumed_collection_item_id THEN
      RAISE EXCEPTION 'Cannot reassign consumed_collection_item_id on scan verification';
    END IF;
  END IF;

  IF NEW.consumed_collection_item_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.collection_items ci
      WHERE ci.id = NEW.consumed_collection_item_id
        AND ci.owner_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Ownership mismatch: consumed_collection_item_id does not belong to scan_verifications.user_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_enforce_scan_verification_ownership() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_scan_verifications_ownership ON public.scan_verifications;
CREATE TRIGGER trg_scan_verifications_ownership
  BEFORE INSERT OR UPDATE ON public.scan_verifications
  FOR EACH ROW EXECUTE FUNCTION public.internal_enforce_scan_verification_ownership();

CREATE OR REPLACE FUNCTION public.internal_enforce_collection_item_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot reassign %.user_id', TG_TABLE_NAME;
  END IF;

  IF TG_TABLE_NAME = 'processed_scan_rewards' THEN
    IF TG_OP = 'UPDATE' AND NEW.collection_item_id IS DISTINCT FROM OLD.collection_item_id THEN
      RAISE EXCEPTION 'Cannot reassign processed_scan_rewards.collection_item_id';
    END IF;
    v_item_id := NEW.collection_item_id;
  ELSIF TG_TABLE_NAME = 'user_species' THEN
    v_item_id := NEW.first_collection_item_id;
  ELSIF TG_TABLE_NAME = 'species_observations' THEN
    v_item_id := NEW.collection_item_id;
  END IF;

  IF v_item_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.collection_items ci
      WHERE ci.id = v_item_id
        AND ci.owner_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Ownership mismatch: referenced collection_item_id does not belong to user_id in %', TG_TABLE_NAME;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_enforce_collection_item_ownership() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_processed_scan_rewards_ownership ON public.processed_scan_rewards;
CREATE TRIGGER trg_processed_scan_rewards_ownership
  BEFORE INSERT OR UPDATE ON public.processed_scan_rewards
  FOR EACH ROW EXECUTE FUNCTION public.internal_enforce_collection_item_ownership();

DROP TRIGGER IF EXISTS trg_user_species_ownership ON public.user_species;
CREATE TRIGGER trg_user_species_ownership
  BEFORE INSERT OR UPDATE ON public.user_species
  FOR EACH ROW EXECUTE FUNCTION public.internal_enforce_collection_item_ownership();

DROP TRIGGER IF EXISTS trg_species_observations_ownership ON public.species_observations;
CREATE TRIGGER trg_species_observations_ownership
  BEFORE INSERT OR UPDATE ON public.species_observations
  FOR EACH ROW EXECUTE FUNCTION public.internal_enforce_collection_item_ownership();

CREATE OR REPLACE FUNCTION public.internal_prevent_user_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot reassign %.user_id', TG_TABLE_NAME;
  END IF;

  IF TG_TABLE_NAME = 'xp_transactions' THEN
    IF NEW.xp_amount IS DISTINCT FROM OLD.xp_amount
       OR NEW.source_type IS DISTINCT FROM OLD.source_type
       OR NEW.source_ref IS DISTINCT FROM OLD.source_ref THEN
      RAISE EXCEPTION 'xp_transactions ledger entries are immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_prevent_user_reassignment() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_xp_transactions_immutable ON public.xp_transactions;
CREATE TRIGGER trg_xp_transactions_immutable
  BEFORE UPDATE ON public.xp_transactions
  FOR EACH ROW EXECUTE FUNCTION public.internal_prevent_user_reassignment();

DROP TRIGGER IF EXISTS trg_user_achievements_owner_immutable ON public.user_achievements;
CREATE TRIGGER trg_user_achievements_owner_immutable
  BEFORE UPDATE ON public.user_achievements
  FOR EACH ROW EXECUTE FUNCTION public.internal_prevent_user_reassignment();

DROP TRIGGER IF EXISTS trg_mission_progress_owner_immutable ON public.mission_progress;
CREATE TRIGGER trg_mission_progress_owner_immutable
  BEFORE UPDATE ON public.mission_progress
  FOR EACH ROW EXECUTE FUNCTION public.internal_prevent_user_reassignment();

DROP TRIGGER IF EXISTS trg_daily_attempts_owner_immutable ON public.species_daily_attempts;
CREATE TRIGGER trg_daily_attempts_owner_immutable
  BEFORE UPDATE ON public.species_daily_attempts
  FOR EACH ROW EXECUTE FUNCTION public.internal_prevent_user_reassignment();

-- ==============================================================================
-- 9. SERVER-SIDE XP, PROGRESSION, STREAK, MISSION & DAILY CHALLENGE RPCS
-- ==============================================================================

-- Deterministic XP -> Level calculation: XP threshold for level L is 50 * L * (L - 1)
CREATE OR REPLACE FUNCTION public.compute_level_from_xp(p_xp BIGINT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT GREATEST(
    1,
    FLOOR((1.0 + SQRT(1.0 + (4.0 * GREATEST(COALESCE(p_xp, 0), 0)) / 50.0)) / 2.0)::INT
  );
$$;

REVOKE ALL ON FUNCTION public.compute_level_from_xp(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_level_from_xp(BIGINT) TO authenticated, service_role;

-- Internal helper: Idempotent XP grant (revoked from PUBLIC, anon, authenticated)
CREATE OR REPLACE FUNCTION public.internal_grant_xp(
  p_user_id UUID,
  p_source_type TEXT,
  p_source_ref TEXT,
  p_xp_amount INT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_xp INT := 0;
BEGIN
  IF p_user_id IS NULL OR COALESCE(p_xp_amount, 0) <= 0 OR p_xp_amount > 5000 THEN
    RETURN 0;
  END IF;

  IF p_source_type NOT IN (
    'first_scan',
    'repeat_scan',
    'unverified_scan',
    'mission_claim',
    'achievement_unlock',
    'daily_challenge',
    'weekly_challenge',
    'streak_bonus'
  ) THEN
    RAISE EXCEPTION 'Invalid XP source type';
  END IF;

  INSERT INTO public.user_progression (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.xp_transactions (user_id, source_type, source_ref, xp_amount, metadata)
  VALUES (p_user_id, p_source_type, p_source_ref, p_xp_amount, COALESCE(p_metadata, '{}'::jsonb))
  ON CONFLICT (user_id, source_type, source_ref) DO NOTHING
  RETURNING xp_amount INTO v_inserted_xp;

  IF COALESCE(v_inserted_xp, 0) > 0 THEN
    UPDATE public.user_progression up
    SET
      total_xp = up.total_xp + v_inserted_xp,
      level = public.compute_level_from_xp(up.total_xp + v_inserted_xp),
      updated_at = NOW()
    WHERE up.user_id = p_user_id;
  END IF;

  RETURN COALESCE(v_inserted_xp, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.internal_grant_xp(UUID, TEXT, TEXT, INT, JSONB) FROM PUBLIC, anon, authenticated, service_role;

-- Internal helper: Update UTC activity streak cleanly
-- Uses streak_started_date so each milestone bonus ('streak:<start_date>:<days>')
-- is idempotent per streak run AND legitimately re-earnable on a future new streak.
CREATE OR REPLACE FUNCTION public.internal_touch_streak(p_user_id UUID)
RETURNS TABLE (current_streak INT, longest_streak INT, streak_bonus_xp INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'UTC')::date;
  v_last DATE;
  v_start DATE;
  v_curr INT := 0;
  v_best INT := 0;
  v_bonus INT := 0;
  v_milestone_xp INT := 0;
BEGIN
  INSERT INTO public.user_progression (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT up.last_active_date, up.streak_started_date, up.current_streak, up.longest_streak
  INTO v_last, v_start, v_curr, v_best
  FROM public.user_progression up
  WHERE up.user_id = p_user_id
  FOR UPDATE;

  IF v_last IS NULL THEN
    v_curr := 1;
    v_start := v_today;
  ELSIF v_last = v_today THEN
    v_start := COALESCE(v_start, (v_today - GREATEST(0, v_curr - 1)));
  ELSIF v_last = (v_today - 1) THEN
    v_curr := v_curr + 1;
    v_start := COALESCE(v_start, (v_today - GREATEST(0, v_curr - 1)));
  ELSE
    v_curr := 1;
    v_start := v_today;
  END IF;

  v_best := GREATEST(v_best, v_curr);

  UPDATE public.user_progression up
  SET
    current_streak = v_curr,
    longest_streak = v_best,
    streak_started_date = v_start,
    last_active_date = v_today,
    updated_at = NOW()
  WHERE up.user_id = p_user_id;

  IF v_curr IN (3, 7, 14, 30) AND (v_today - v_start) = (v_curr - 1) THEN
    v_milestone_xp := CASE v_curr WHEN 3 THEN 40 WHEN 7 THEN 100 WHEN 14 THEN 200 ELSE 400 END;
    v_bonus := public.internal_grant_xp(
      p_user_id,
      'streak_bonus',
      'streak:' || v_start::text || ':' || v_curr::text,
      v_milestone_xp,
      jsonb_build_object('streak_days', v_curr, 'streak_started_date', v_start)
    );
  END IF;

  RETURN QUERY SELECT v_curr, v_best, COALESCE(v_bonus, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.internal_touch_streak(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- Internal helper: Evaluate and unlock qualifying achievements
-- NOTE: 'unique_species' achievements require verified_species_count so unverified
-- scans or arbitrary entries never count toward scientific collector milestones.
CREATE OR REPLACE FUNCTION public.internal_evaluate_achievements(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prog RECORD;
  v_posts_count INT := 0;
  v_daily_wins INT := 0;
  v_ach RECORD;
  v_metric_val INT := 0;
  v_unlocked JSONB := '[]'::jsonb;
  v_inserted_id UUID;
  v_bonus INT := 0;
BEGIN
  SELECT * INTO v_prog
  FROM public.user_progression up
  WHERE up.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN v_unlocked;
  END IF;

  SELECT COUNT(*)::INT INTO v_posts_count
  FROM public.community_posts cp
  WHERE cp.user_id = p_user_id;

  SELECT COUNT(DISTINCT sda.challenge_id)::INT INTO v_daily_wins
  FROM public.species_daily_attempts sda
  WHERE sda.user_id = p_user_id AND sda.is_correct = true;

  FOR v_ach IN
    SELECT a.*
    FROM public.achievements a
    WHERE a.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.user_achievements ua
        WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
      )
  LOOP
    v_metric_val := CASE v_ach.target_metric
      WHEN 'unique_species' THEN v_prog.verified_species_count
      WHEN 'total_scans' THEN v_prog.total_scans_count
      WHEN 'streak_days' THEN v_prog.longest_streak
      WHEN 'level' THEN v_prog.level
      WHEN 'posts_count' THEN v_posts_count
      WHEN 'daily_wins' THEN v_daily_wins
      ELSE 0
    END;

    IF v_metric_val >= v_ach.target_value THEN
      v_inserted_id := NULL;
      INSERT INTO public.user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_ach.id)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING id INTO v_inserted_id;

      IF v_inserted_id IS NOT NULL THEN
        v_bonus := public.internal_grant_xp(
          p_user_id,
          'achievement_unlock',
          'achievement:' || v_ach.code,
          v_ach.xp_reward,
          jsonb_build_object('code', v_ach.code, 'title', v_ach.title)
        );
        v_unlocked := v_unlocked || jsonb_build_object(
          'code', v_ach.code,
          'title', v_ach.title,
          'tier', v_ach.tier,
          'xp_reward', v_bonus
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_unlocked;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_evaluate_achievements(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- Internal helper: Increment mission progress for the active daily/weekly period
-- Supports single or comma-separated target_category values (e.g. 'plants,fungi').
CREATE OR REPLACE FUNCTION public.internal_advance_missions(
  p_user_id UUID,
  p_action_type TEXT,
  p_category TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_daily_key TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_weekly_key TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'IYYY-"W"IW');
  v_m RECORD;
  v_period TEXT;
BEGIN
  FOR v_m IN
    SELECT m.*
    FROM public.missions m
    WHERE m.is_active = true
      AND m.action_type = p_action_type
      AND (
        m.action_type <> 'scan_category'
        OR LOWER(TRIM(COALESCE(p_category, ''))) = ANY(
          STRING_TO_ARRAY(REPLACE(LOWER(TRIM(m.target_category)), ' ', ''), ',')
        )
      )
  LOOP
    v_period := CASE WHEN v_m.cadence = 'daily' THEN v_daily_key ELSE v_weekly_key END;

    INSERT INTO public.mission_progress (user_id, mission_id, period_key, current_count, completed_at)
    VALUES (
      p_user_id,
      v_m.id,
      v_period,
      1,
      CASE WHEN 1 >= v_m.target_count THEN NOW() ELSE NULL END
    )
    ON CONFLICT (user_id, mission_id, period_key) DO UPDATE SET
      current_count = LEAST(v_m.target_count, public.mission_progress.current_count + 1),
      completed_at = COALESCE(
        public.mission_progress.completed_at,
        CASE
          WHEN LEAST(v_m.target_count, public.mission_progress.current_count + 1) >= v_m.target_count
          THEN NOW()
          ELSE NULL
        END
      ),
      updated_at = NOW();
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.internal_advance_missions(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;

-- Public Authenticated RPC: record_species_discovery(p_collection_item_id, p_scan_verification_id)
-- Zero-trust progression & species verification:
--   * Never treats collection_items row ownership as verified taxonomy.
--   * Never reads collection_items.rarity, confidence, or category for XP/missions.
--   * Requires a single-use, unexpired server attestation from public.scan_verifications
--     matching auth.uid() and the collection item species before awarding progression.
--   * Cross-verifies against public.trusted_species_taxa (authoritative catalog rarity/taxon)
--     or server-confirmed iNaturalist taxonomy (supporting species worldwide), while
--     explicitly isolating unverified scans into 'scanner_unverified' with capped common XP.
--   * Serializes per-user progression via canonical pg_advisory_xact_lock + atomic upsert.
CREATE OR REPLACE FUNCTION public.record_species_discovery(
  p_collection_item_id UUID,
  p_scan_verification_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item RECORD;
  v_item_key TEXT;
  v_psr RECORD;
  v_existing_us RECORD;
  v_sv RECORD;
  v_catalog RECORD;
  v_final_key TEXT;
  v_final_common TEXT;
  v_final_scientific TEXT;
  v_final_category TEXT;
  v_final_taxon_id BIGINT := NULL;
  v_final_rarity TEXT := 'common';
  v_taxonomy_source TEXT := 'ai_unverified';
  v_verification_status TEXT := 'scanner_unverified';
  v_clean_photo TEXT;
  v_existing_species_id UUID;
  v_species_row_id UUID;
  v_persisted_status TEXT;
  v_persisted_source TEXT;
  v_persisted_taxon_id BIGINT;
  v_persisted_rarity TEXT;
  v_is_new BOOLEAN := false;
  v_ever_first_verified BOOLEAN := false;
  v_today_key TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_xp_base INT := 0;
  v_xp_awarded INT := 0;
  v_streak_bonus INT := 0;
  v_streak_rec RECORD;
  v_unlocked JSONB := '[]'::jsonb;
  v_prog RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_collection_item_id IS NULL THEN
    RAISE EXCEPTION 'A saved collection item ID is required';
  END IF;

  -- Canonical per-user progression lock FIRST for deadlock-free serialization
  PERFORM pg_advisory_xact_lock(hashtext('user_prog:' || v_user_id::text));

  SELECT * INTO v_item
  FROM public.collection_items ci
  WHERE ci.id = p_collection_item_id
    AND ci.owner_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection item not found or unauthorized';
  END IF;

  v_item_key := LOWER(
    REGEXP_REPLACE(
      TRIM(COALESCE(NULLIF(v_item.scientific_name, ''), v_item.species_name, '')),
      '\s+',
      ' ',
      'g'
    )
  );
  IF char_length(v_item_key) < 2
     OR char_length(v_item_key) > 180
     OR v_item_key IN ('n/a', 'not a living species', 'unknown', 'unknown species') THEN
    RAISE EXCEPTION 'Collection item does not represent a valid biological species';
  END IF;

  -- Idempotency check BEFORE mutating scan_verifications
  SELECT psr.* INTO v_psr
  FROM public.processed_scan_rewards psr
  WHERE psr.collection_item_id = p_collection_item_id;

  IF FOUND THEN
    SELECT us.* INTO v_existing_us
    FROM public.user_species us
    WHERE us.user_id = v_user_id
      AND us.species_key = COALESCE(v_psr.species_key, v_item_key);

    SELECT * INTO v_prog FROM public.user_progression up WHERE up.user_id = v_user_id;
    RETURN jsonb_build_object(
      'recorded', true,
      'eligible_for_xp', true,
      'already_processed', true,
      'is_new_species', false,
      'verification_status', COALESCE(v_existing_us.verification_status, 'scanner_unverified'),
      'taxonomy_source', COALESCE(v_existing_us.taxonomy_source, 'ai_unverified'),
      'species_key', COALESCE(v_existing_us.species_key, v_psr.species_key, v_item_key),
      'inat_taxon_id', v_existing_us.inat_taxon_id,
      'xp_awarded', 0,
      'total_xp', COALESCE(v_prog.total_xp, 0),
      'level', COALESCE(v_prog.level, 1),
      'current_streak', COALESCE(v_prog.current_streak, 0),
      'longest_streak', COALESCE(v_prog.longest_streak, 0),
      'unlocked_achievements', '[]'::jsonb
    );
  END IF;

  -- Unattested manual collection_items inserts are NOT eligible for XP or confirmed Dex unlocks
  IF p_scan_verification_id IS NULL THEN
    SELECT * INTO v_prog FROM public.user_progression up WHERE up.user_id = v_user_id;
    RETURN jsonb_build_object(
      'recorded', false,
      'eligible_for_xp', false,
      'already_processed', false,
      'is_new_species', false,
      'verification_status', 'unverified',
      'taxonomy_source', 'unverified',
      'species_key', v_item_key,
      'inat_taxon_id', NULL,
      'xp_awarded', 0,
      'total_xp', COALESCE(v_prog.total_xp, 0),
      'level', COALESCE(v_prog.level, 1),
      'current_streak', COALESCE(v_prog.current_streak, 0),
      'longest_streak', COALESCE(v_prog.longest_streak, 0),
      'unlocked_achievements', '[]'::jsonb,
      'message', 'A verified server scan attestation is required to unlock Dex entries and earn XP.'
    );
  END IF;

  -- Lock & validate one-time server scan attestation
  SELECT * INTO v_sv
  FROM public.scan_verifications sv
  WHERE sv.id = p_scan_verification_id
    AND sv.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scan verification not found or unauthorized';
  END IF;

  -- Check BOTH consumed_at AND consumed_collection_item_id so deleting the collection item
  -- (which sets consumed_collection_item_id = NULL) never makes an attestation reusable.
  IF v_sv.consumed_at IS NOT NULL OR v_sv.consumed_collection_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'Scan verification has already been redeemed';
  END IF;

  IF v_sv.expires_at < NOW() THEN
    RAISE EXCEPTION 'Scan verification has expired; please re-scan specimen';
  END IF;

  IF v_sv.not_a_species = true OR v_sv.confidence < 0.50 THEN
    RAISE EXCEPTION 'Specimen did not meet verified biological confidence threshold';
  END IF;

  IF v_sv.species_key <> v_item_key THEN
    RAISE EXCEPTION 'Collection item species does not match verified scan attestation';
  END IF;

  -- Atomically consume the one-time attestation
  UPDATE public.scan_verifications
  SET
    consumed_collection_item_id = p_collection_item_id,
    consumed_at = NOW()
  WHERE id = v_sv.id;

  -- Mark collection item processed inside the same transaction
  INSERT INTO public.processed_scan_rewards (collection_item_id, user_id, species_key)
  VALUES (p_collection_item_id, v_user_id, v_sv.species_key);

  -- Resolve authoritative taxonomy & server rarity tier
  SELECT * INTO v_catalog
  FROM public.trusted_species_taxa tst
  WHERE tst.species_key = v_sv.species_key;

  IF FOUND THEN
    v_final_key := v_catalog.species_key;
    v_final_common := v_catalog.common_name;
    v_final_scientific := v_catalog.scientific_name;
    v_final_category := v_catalog.category;
    v_final_taxon_id := v_catalog.inat_taxon_id;
    v_final_rarity := v_catalog.rarity_tier;
    v_taxonomy_source := 'trusted_catalog';
    v_verification_status := 'verified_taxonomy';
  ELSIF v_sv.is_taxonomy_confirmed = true
        AND v_sv.inat_taxon_id IS NOT NULL
        AND v_sv.taxonomic_rank IN ('species', 'subspecies') THEN
    v_final_key := v_sv.species_key;
    v_final_common := v_sv.common_name;
    v_final_scientific := v_sv.scientific_name;
    v_final_category := v_sv.category;
    v_final_taxon_id := v_sv.inat_taxon_id;
    v_final_rarity := public.internal_compute_rarity_from_iucn(v_sv.iucn_status);
    v_taxonomy_source := 'inaturalist_api';
    v_verification_status := 'verified_taxonomy';
  ELSE
    -- Outside trusted catalog & unconfirmed externally: supported in Dex as unverified,
    -- NEVER treated as scientifically confirmed and NEVER eligible for rare/legendary XP.
    v_final_key := v_sv.species_key;
    v_final_common := v_sv.common_name;
    v_final_scientific := v_sv.scientific_name;
    v_final_category := v_sv.category;
    v_final_taxon_id := NULL;
    v_final_rarity := 'common';
    v_taxonomy_source := 'ai_unverified';
    v_verification_status := 'scanner_unverified';
  END IF;

  v_clean_photo := LEFT(TRIM(COALESCE(v_item.photo_path, '')), 2048);
  IF v_clean_photo <> '' AND v_clean_photo !~* '^https?://' AND v_clean_photo ~* ':' THEN
    v_clean_photo := '';
  END IF;

  -- Check existence under the canonical advisory lock before upserting
  SELECT us.id INTO v_existing_species_id
  FROM public.user_species us
  WHERE us.user_id = v_user_id
    AND us.species_key = v_final_key;
  v_is_new := (v_existing_species_id IS NULL);

  -- Upsert canonical Dex entry; duplicate discoveries preserve the original
  -- verification_status, taxonomy_source, rarity, inat_taxon_id, and last_verified_at.
  INSERT INTO public.user_species (
    user_id, species_key, inat_taxon_id, common_name, scientific_name,
    category, rarity, verification_status, taxonomy_source,
    first_collection_item_id, photo_url, sighting_count, last_verified_at
  )
  VALUES (
    v_user_id,
    v_final_key,
    v_final_taxon_id,
    v_final_common,
    v_final_scientific,
    v_final_category,
    v_final_rarity,
    v_verification_status,
    v_taxonomy_source,
    p_collection_item_id,
    v_clean_photo,
    1,
    CASE WHEN v_verification_status = 'verified_taxonomy' THEN NOW() ELSE NULL END
  )
  ON CONFLICT (user_id, species_key) DO UPDATE SET
    sighting_count = public.user_species.sighting_count + 1,
    last_seen_at = NOW(),
    photo_url = CASE
      WHEN public.user_species.photo_url = '' AND EXCLUDED.photo_url <> '' THEN EXCLUDED.photo_url
      ELSE public.user_species.photo_url
    END
  RETURNING id, verification_status, taxonomy_source, inat_taxon_id, rarity
  INTO v_species_row_id, v_persisted_status, v_persisted_source, v_persisted_taxon_id, v_persisted_rarity;

  SELECT EXISTS (
    SELECT 1 FROM public.xp_transactions xt
    WHERE xt.user_id = v_user_id
      AND xt.source_type = 'first_scan'
      AND xt.source_ref = 'species:' || v_final_key
  ) INTO v_ever_first_verified;

  IF v_persisted_status = 'verified_taxonomy' THEN
    IF NOT v_ever_first_verified THEN
      v_xp_base := CASE v_persisted_rarity
        WHEN 'legendary' THEN 200
        WHEN 'rare' THEN 125
        WHEN 'uncommon' THEN 75
        ELSE 50
      END;

      v_xp_awarded := public.internal_grant_xp(
        v_user_id,
        'first_scan',
        'species:' || v_final_key,
        v_xp_base,
        jsonb_build_object(
          'species_key', v_final_key,
          'rarity', v_persisted_rarity,
          'taxonomy_source', v_persisted_source
        )
      );
    ELSE
      v_xp_awarded := public.internal_grant_xp(
        v_user_id,
        'repeat_scan',
        'species:' || v_final_key || ':' || v_today_key,
        10,
        jsonb_build_object('species_key', v_final_key, 'date', v_today_key)
      );
    END IF;
  ELSE
    -- Capped one-time observation XP for unverified scanner finds (no repeat XP)
    v_xp_awarded := public.internal_grant_xp(
      v_user_id,
      'unverified_scan',
      'species_unverified:' || v_final_key,
      15,
      jsonb_build_object('species_key', v_final_key, 'verification_status', v_persisted_status)
    );
  END IF;

  INSERT INTO public.user_progression (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_progression up
  SET
    unique_species_count = (
      SELECT COUNT(*)::INT FROM public.user_species us WHERE us.user_id = v_user_id
    ),
    verified_species_count = (
      SELECT COUNT(*)::INT FROM public.user_species us
      WHERE us.user_id = v_user_id AND us.verification_status = 'verified_taxonomy'
    ),
    total_scans_count = up.total_scans_count + 1,
    updated_at = NOW()
  WHERE up.user_id = v_user_id;

  SELECT * INTO v_streak_rec FROM public.internal_touch_streak(v_user_id);
  v_streak_bonus := COALESCE(v_streak_rec.streak_bonus_xp, 0);

  PERFORM public.internal_advance_missions(v_user_id, 'scan_any', v_final_category);
  PERFORM public.internal_advance_missions(v_user_id, 'scan_category', v_final_category);
  IF v_is_new AND v_persisted_status = 'verified_taxonomy' AND NOT v_ever_first_verified THEN
    PERFORM public.internal_advance_missions(v_user_id, 'new_species', v_final_category);
  END IF;

  v_unlocked := public.internal_evaluate_achievements(v_user_id);
  SELECT * INTO v_prog FROM public.user_progression up WHERE up.user_id = v_user_id;

  RETURN jsonb_build_object(
    'recorded', true,
    'eligible_for_xp', true,
    'already_processed', false,
    'is_new_species', v_is_new,
    'verification_status', v_persisted_status,
    'taxonomy_source', v_persisted_source,
    'species_key', v_final_key,
    'inat_taxon_id', v_persisted_taxon_id,
    'xp_awarded', v_xp_awarded + v_streak_bonus,
    'total_xp', COALESCE(v_prog.total_xp, 0),
    'level', COALESCE(v_prog.level, 1),
    'current_streak', COALESCE(v_prog.current_streak, 1),
    'longest_streak', COALESCE(v_prog.longest_streak, 1),
    'unlocked_achievements', v_unlocked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_species_discovery(UUID, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_species_discovery(UUID, UUID) TO authenticated;

-- Public Authenticated RPC: claim_mission_reward(p_mission_id UUID, p_period_key TEXT)
CREATE OR REPLACE FUNCTION public.claim_mission_reward(
  p_mission_id UUID,
  p_period_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mission RECORD;
  v_expected_period TEXT;
  v_period TEXT;
  v_progress RECORD;
  v_xp_awarded INT := 0;
  v_unlocked JSONB := '[]'::jsonb;
  v_prog RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_mission_id IS NULL THEN
    RAISE EXCEPTION 'Mission ID is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('user_prog:' || v_user_id::text));

  SELECT * INTO v_mission
  FROM public.missions m
  WHERE m.id = p_mission_id AND m.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found or inactive';
  END IF;

  v_expected_period := CASE
    WHEN v_mission.cadence = 'daily' THEN TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    ELSE TO_CHAR(NOW() AT TIME ZONE 'UTC', 'IYYY-"W"IW')
  END;

  IF p_period_key IS NOT NULL AND TRIM(p_period_key) <> '' THEN
    v_period := TRIM(p_period_key);
    IF (v_mission.cadence = 'daily' AND v_period !~ '^\d{4}-\d{2}-\d{2}$')
       OR (v_mission.cadence = 'weekly' AND v_period !~ '^\d{4}-W\d{2}$') THEN
      RAISE EXCEPTION 'Invalid mission period key format';
    END IF;
    IF v_period <> v_expected_period THEN
      RAISE EXCEPTION 'Mission period is inactive or expired';
    END IF;
  ELSE
    v_period := v_expected_period;
  END IF;

  SELECT * INTO v_progress
  FROM public.mission_progress mp
  WHERE mp.user_id = v_user_id
    AND mp.mission_id = p_mission_id
    AND mp.period_key = v_period
  FOR UPDATE;

  IF NOT FOUND OR v_progress.current_count < v_mission.target_count THEN
    RAISE EXCEPTION 'Mission requirements are not yet complete';
  END IF;

  IF v_progress.claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Mission reward already claimed for this period';
  END IF;

  UPDATE public.mission_progress mp
  SET claimed_at = NOW(), updated_at = NOW()
  WHERE mp.id = v_progress.id;

  v_xp_awarded := public.internal_grant_xp(
    v_user_id,
    'mission_claim',
    v_mission.id::text || ':' || v_period,
    v_mission.xp_reward,
    jsonb_build_object('mission_code', v_mission.code, 'period_key', v_period)
  );

  v_unlocked := public.internal_evaluate_achievements(v_user_id);
  SELECT * INTO v_prog FROM public.user_progression up WHERE up.user_id = v_user_id;

  RETURN jsonb_build_object(
    'claimed', true,
    'xp_awarded', v_xp_awarded,
    'total_xp', COALESCE(v_prog.total_xp, 0),
    'level', COALESCE(v_prog.level, 1),
    'unlocked_achievements', v_unlocked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_mission_reward(UUID, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.claim_mission_reward(UUID, TEXT) TO authenticated;

-- Public Authenticated/Anon-safe RPC: get_species_of_the_day(p_date DATE)
CREATE OR REPLACE FUNCTION public.get_species_of_the_day(
  p_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_utc_today DATE := (NOW() AT TIME ZONE 'UTC')::date;
  v_target_date DATE := LEAST(COALESCE(p_date, (NOW() AT TIME ZONE 'UTC')::date), v_utc_today);
  v_ch RECORD;
  v_attempts INT := 0;
  v_solved BOOLEAN := false;
  v_xp_earned INT := 0;
  v_reveal BOOLEAN := false;
BEGIN
  SELECT * INTO v_ch
  FROM public.species_daily_challenges sdc
  WHERE sdc.challenge_date <= v_target_date
  ORDER BY sdc.challenge_date DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT
      COUNT(*)::INT,
      COALESCE(BOOL_OR(sda.is_correct), false),
      COALESCE(SUM(sda.xp_awarded), 0)::INT
    INTO v_attempts, v_solved, v_xp_earned
    FROM public.species_daily_attempts sda
    WHERE sda.challenge_id = v_ch.id
      AND sda.user_id = v_user_id;
  END IF;

  v_reveal := (v_user_id IS NOT NULL) AND (v_solved OR v_attempts >= 3);

  RETURN jsonb_build_object(
    'id', v_ch.id,
    'challenge_date', v_ch.challenge_date,
    'category', v_ch.category,
    'ecosystem', v_ch.ecosystem,
    'difficulty', v_ch.difficulty,
    'image_url', v_ch.image_url,
    'clues', v_ch.clues,
    'source_citation', v_ch.source_citation,
    'xp_reward', v_ch.xp_reward,
    'attempts_used', v_attempts,
    'max_attempts', 3,
    'solved', v_solved,
    'xp_earned', v_xp_earned,
    'answer_common_name', CASE WHEN v_reveal THEN v_ch.answer_common_name ELSE NULL END,
    'answer_scientific_name', CASE WHEN v_reveal THEN v_ch.answer_scientific_name ELSE NULL END,
    'fun_fact', CASE WHEN v_reveal THEN v_ch.fun_fact ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_species_of_the_day(DATE) FROM PUBLIC, service_role;
GRANT EXECUTE ON FUNCTION public.get_species_of_the_day(DATE) TO anon, authenticated;

-- Public Authenticated RPC: submit_species_daily_guess(p_challenge_id UUID, p_guess TEXT)
CREATE OR REPLACE FUNCTION public.submit_species_daily_guess(
  p_challenge_id UUID,
  p_guess TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_utc_today DATE := (NOW() AT TIME ZONE 'UTC')::date;
  v_active_id UUID;
  v_ch RECORD;
  v_clean_guess TEXT;
  v_attempts INT := 0;
  v_already_solved BOOLEAN := false;
  v_next_attempt INT := 1;
  v_is_correct BOOLEAN := false;
  v_xp_awarded INT := 0;
  v_streak_rec RECORD;
  v_unlocked JSONB := '[]'::jsonb;
  v_reveal BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Please sign in to play Species of the Day';
  END IF;

  IF p_challenge_id IS NULL THEN
    RAISE EXCEPTION 'Challenge ID is required';
  END IF;

  v_clean_guess := LOWER(REGEXP_REPLACE(TRIM(COALESCE(p_guess, '')), '\s+', ' ', 'g'));
  IF char_length(v_clean_guess) < 2 OR char_length(v_clean_guess) > 120 THEN
    RAISE EXCEPTION 'Guess must be between 2 and 120 characters';
  END IF;

  -- Canonical per-user progression lock strictly serializes concurrent guesses
  PERFORM pg_advisory_xact_lock(hashtext('user_prog:' || v_user_id::text));

  SELECT sdc.id INTO v_active_id
  FROM public.species_daily_challenges sdc
  WHERE sdc.challenge_date <= v_utc_today
  ORDER BY sdc.challenge_date DESC
  LIMIT 1;

  IF v_active_id IS NULL OR v_active_id <> p_challenge_id THEN
    RAISE EXCEPTION 'Only the active daily challenge can be answered';
  END IF;

  SELECT * INTO v_ch
  FROM public.species_daily_challenges sdc
  WHERE sdc.id = p_challenge_id;

  SELECT COUNT(*)::INT, COALESCE(BOOL_OR(sda.is_correct), false)
  INTO v_attempts, v_already_solved
  FROM public.species_daily_attempts sda
  WHERE sda.challenge_id = p_challenge_id AND sda.user_id = v_user_id;

  IF v_already_solved THEN
    RAISE EXCEPTION 'You have already solved this challenge';
  END IF;

  IF v_attempts >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 guesses reached for today';
  END IF;

  v_next_attempt := v_attempts + 1;

  v_is_correct := (
    v_clean_guess = LOWER(TRIM(v_ch.answer_common_name))
    OR v_clean_guess = LOWER(TRIM(v_ch.answer_scientific_name))
    OR EXISTS (
      SELECT 1
      FROM UNNEST(v_ch.accepted_aliases) AS alias
      WHERE LOWER(TRIM(alias)) = v_clean_guess
    )
  );

  IF v_is_correct THEN
    v_xp_awarded := public.internal_grant_xp(
      v_user_id,
      'daily_challenge',
      'daily:' || v_ch.challenge_date::text,
      v_ch.xp_reward,
      jsonb_build_object('challenge_id', v_ch.id, 'attempts_used', v_next_attempt)
    );
  END IF;

  INSERT INTO public.species_daily_attempts (
    challenge_id, user_id, attempt_number, guess_text, is_correct, xp_awarded
  )
  VALUES (
    p_challenge_id, v_user_id, v_next_attempt, LEFT(TRIM(p_guess), 120), v_is_correct, v_xp_awarded
  );

  SELECT * INTO v_streak_rec FROM public.internal_touch_streak(v_user_id);
  PERFORM public.internal_advance_missions(v_user_id, 'daily_challenge_play', v_ch.category);
  v_unlocked := public.internal_evaluate_achievements(v_user_id);

  v_reveal := v_is_correct OR v_next_attempt >= 3;

  RETURN jsonb_build_object(
    'is_correct', v_is_correct,
    'attempts_used', v_next_attempt,
    'max_attempts', 3,
    'xp_awarded', v_xp_awarded + COALESCE(v_streak_rec.streak_bonus_xp, 0),
    'answer_common_name', CASE WHEN v_reveal THEN v_ch.answer_common_name ELSE NULL END,
    'answer_scientific_name', CASE WHEN v_reveal THEN v_ch.answer_scientific_name ELSE NULL END,
    'fun_fact', CASE WHEN v_reveal THEN v_ch.fun_fact ELSE NULL END,
    'unlocked_achievements', v_unlocked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_species_daily_guess(UUID, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.submit_species_daily_guess(UUID, TEXT) TO authenticated;

-- Public Authenticated RPC: get_my_quest_state()
CREATE OR REPLACE FUNCTION public.get_my_quest_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_daily_key TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_weekly_key TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'IYYY-"W"IW');
  v_prog RECORD;
  v_missions JSONB := '[]'::jsonb;
  v_achievements JSONB := '[]'::jsonb;
  v_recent_xp JSONB := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.user_progression (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_prog FROM public.user_progression up WHERE up.user_id = v_user_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'code', m.code,
      'title', m.title,
      'description', m.description,
      'cadence', m.cadence,
      'action_type', m.action_type,
      'target_category', m.target_category,
      'target_count', m.target_count,
      'xp_reward', m.xp_reward,
      'period_key', CASE WHEN m.cadence = 'daily' THEN v_daily_key ELSE v_weekly_key END,
      'current_count', COALESCE(mp.current_count, 0),
      'completed_at', mp.completed_at,
      'claimed_at', mp.claimed_at
    )
    ORDER BY m.cadence ASC, m.xp_reward ASC
  ), '[]'::jsonb)
  INTO v_missions
  FROM public.missions m
  LEFT JOIN public.mission_progress mp
    ON mp.mission_id = m.id
    AND mp.user_id = v_user_id
    AND mp.period_key = CASE WHEN m.cadence = 'daily' THEN v_daily_key ELSE v_weekly_key END
  WHERE m.is_active = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'code', a.code,
      'title', a.title,
      'description', a.description,
      'icon', a.icon,
      'category', a.category,
      'tier', a.tier,
      'target_metric', a.target_metric,
      'target_value', a.target_value,
      'xp_reward', a.xp_reward,
      'unlocked_at', ua.unlocked_at
    )
    ORDER BY a.sort_order ASC
  ), '[]'::jsonb)
  INTO v_achievements
  FROM public.achievements a
  LEFT JOIN public.user_achievements ua
    ON ua.achievement_id = a.id
    AND ua.user_id = v_user_id
  WHERE a.is_active = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', xt.id,
      'source_type', xt.source_type,
      'source_ref', xt.source_ref,
      'xp_amount', xt.xp_amount,
      'metadata', xt.metadata,
      'created_at', xt.created_at
    )
  ), '[]'::jsonb)
  INTO v_recent_xp
  FROM (
    SELECT * FROM public.xp_transactions
    WHERE user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 15
  ) xt;

  RETURN jsonb_build_object(
    'progression', jsonb_build_object(
      'total_xp', v_prog.total_xp,
      'level', v_prog.level,
      'current_streak', v_prog.current_streak,
      'longest_streak', v_prog.longest_streak,
      'last_active_date', v_prog.last_active_date,
      'unique_species_count', v_prog.unique_species_count,
      'verified_species_count', v_prog.verified_species_count,
      'total_scans_count', v_prog.total_scans_count
    ),
    'missions', v_missions,
    'achievements', v_achievements,
    'recent_xp', v_recent_xp
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_quest_state() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_quest_state() TO authenticated;

-- ==============================================================================
-- 10. INITIAL IDEMPOTENT SEED DATA (Trusted Taxa, Achievements, Missions, Daily, Links)
-- ==============================================================================

INSERT INTO public.trusted_species_taxa (
  species_key, inat_taxon_id, scientific_name, common_name, category, iucn_status, rarity_tier
)
VALUES
  ('danaus plexippus', 48662, 'Danaus plexippus', 'Monarch Butterfly', 'insects', 'LC', 'common'),
  ('ailurus fulgens', 41655, 'Ailurus fulgens', 'Red Panda', 'mammals', 'EN', 'rare'),
  ('amanita muscaria', 48715, 'Amanita muscaria', 'Fly Agaric', 'fungi', 'LC', 'common'),
  ('apis mellifera', 47219, 'Apis mellifera', 'Western Honey Bee', 'insects', 'LC', 'common'),
  ('canis lupus', 42048, 'Canis lupus', 'Gray Wolf', 'mammals', 'LC', 'common'),
  ('enhydra lutris', 41860, 'Enhydra lutris', 'Sea Otter', 'marine', 'EN', 'rare'),
  ('nucifraga columbiana', 8319, 'Nucifraga columbiana', 'Clark''s Nutcracker', 'birds', 'LC', 'common'),
  ('panthera leo', 41964, 'Panthera leo', 'Lion', 'mammals', 'VU', 'rare'),
  ('crotalus atrox', 30750, 'Crotalus atrox', 'Western Diamondback Rattlesnake', 'reptiles', 'LC', 'common'),
  ('asclepias syriaca', 47911, 'Asclepias syriaca', 'Common Milkweed', 'plants', 'LC', 'common')
ON CONFLICT (species_key) DO UPDATE SET
  iucn_status = EXCLUDED.iucn_status,
  rarity_tier = EXCLUDED.rarity_tier;

INSERT INTO public.achievements (code, title, description, icon, category, tier, target_metric, target_value, xp_reward, sort_order)
VALUES
  ('first_discovery', 'First Field Note', 'Unlock your first verified species in My Dex.', 'explore', 'exploration', 'bronze', 'unique_species', 1, 50, 1),
  ('collector_10', 'Field Apprentice', 'Unlock 10 distinct verified species in My Dex.', 'bookmarks', 'collection', 'silver', 'unique_species', 10, 150, 2),
  ('collector_25', 'Biodiversity Curator', 'Unlock 25 distinct verified species in My Dex.', 'workspace_premium', 'collection', 'gold', 'unique_species', 25, 350, 3),
  ('streak_3', 'Trail Regular', 'Maintain a 3-day active discovery streak.', 'local_fire_department', 'streak', 'bronze', 'streak_days', 3, 75, 4),
  ('streak_7', 'Weekly Naturalist', 'Maintain a 7-day active discovery streak.', 'bolt', 'streak', 'gold', 'streak_days', 7, 200, 5),
  ('daily_scholar', 'Mystery Solver', 'Solve 3 Species of the Day challenges.', 'quiz', 'knowledge', 'silver', 'daily_wins', 3, 150, 6),
  ('community_voice', 'Field Reporter', 'Share 3 sightings with the WildDex community.', 'dynamic_feed', 'social', 'bronze', 'posts_count', 3, 100, 7)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.missions (code, title, description, cadence, action_type, target_category, target_count, xp_reward)
VALUES
  ('daily_scan_1', 'Daily Field Check', 'Scan and record 1 living organism today.', 'daily', 'scan_any', '', 1, 40),
  ('daily_mystery_play', 'Daily Mystery Clue', 'Attempt today''s Species of the Day challenge.', 'daily', 'daily_challenge_play', '', 1, 35),
  ('weekly_new_3', 'New Taxa Explorer', 'Unlock 3 new verified species this week.', 'weekly', 'new_species', '', 3, 150),
  ('weekly_plants_2', 'Botanical Survey', 'Scan 2 plant or fungi specimens this week.', 'weekly', 'scan_category', 'plants,fungi', 2, 100)
ON CONFLICT (code) DO UPDATE SET
  target_category = EXCLUDED.target_category,
  description = EXCLUDED.description;

INSERT INTO public.species_daily_challenges (
  challenge_date, species_key, answer_common_name, answer_scientific_name, accepted_aliases,
  category, ecosystem, difficulty, image_url, clues, fun_fact, source_citation, xp_reward
)
VALUES
  (
    (NOW() AT TIME ZONE 'UTC')::date,
    'danaus plexippus',
    'Monarch Butterfly',
    'Danaus plexippus',
    ARRAY['monarch', 'monarch butterfly', 'danaus plexippus'],
    'insects',
    'grassland',
    'easy',
    'https://upload.wikimedia.org/wikipedia/commons/6/63/Monarch_In_May.jpg',
    ARRAY[
      'Its caterpillars feed primarily on milkweed (Asclepias) and related Apocynaceae host plants.',
      'It completes a multi-generational migration spanning thousands of kilometers across North America.',
      'Distinct black wing veins frame vibrant orange membranes with double white marginal spots.'
    ],
    'Monarch butterflies sequester toxic cardenolides from milkweed during their larval stage, making adults unpalatable to many avian predators.',
    'iNaturalist Taxon 48662 / IUCN Red List',
    75
  ),
  (
    (NOW() AT TIME ZONE 'UTC')::date + 1,
    'ailurus fulgens',
    'Red Panda',
    'Ailurus fulgens',
    ARRAY['red panda', 'ailurus fulgens', 'lesser panda'],
    'mammals',
    'mountain',
    'medium',
    'https://upload.wikimedia.org/wikipedia/commons/e/e6/Red_Panda_%2824986761703%29.jpg',
    ARRAY[
      'Inhabits temperate bamboo forests across the eastern Himalayas and southwestern China.',
      'Possesses a modified radial sesamoid wrist bone acting like a false thumb to grip bamboo stems.',
      'Classified in its own taxonomic family, Ailuridae, rather than Ursidae.'
    ],
    'The Red Panda is the sole living member of family Ailuridae and shares closer evolutionary ancestry with mustelids and raccoons than giant pandas.',
    'IUCN Red List (Ailurus fulgens) / iNaturalist Taxon 41655',
    90
  ),
  (
    (NOW() AT TIME ZONE 'UTC')::date + 2,
    'amanita muscaria',
    'Fly Agaric',
    'Amanita muscaria',
    ARRAY['fly agaric', 'amanita muscaria'],
    'fungi',
    'forest',
    'medium',
    'https://upload.wikimedia.org/wikipedia/commons/3/32/Amanita_muscaria_3_vliegenzwammen_op_rij.jpg',
    ARRAY[
      'Forms ectomycorrhizal partnerships with birch, pine, and spruce trees.',
      'Features a bright scarlet cap dotted with white universal-veil warts.',
      'Contains muscimol and ibotenic acid and is toxic if ingested.'
    ],
    'Fly Agaric exchanges soil minerals and water with temperate forest trees in return for photosynthetic sugars via underground mycelium networks.',
    'MycoBank / iNaturalist Taxon 48715',
    85
  )
ON CONFLICT (challenge_date) DO NOTHING;

INSERT INTO public.species_relationships (
  source_species_key, source_common_name, source_scientific_name,
  target_species_key, target_common_name, target_scientific_name,
  relationship_type, direction, ecological_summary, source_citation, source_url, verified
)
VALUES
  (
    'danaus plexippus', 'Monarch Butterfly', 'Danaus plexippus',
    'asclepias syriaca', 'Common Milkweed', 'Asclepias syriaca',
    'habitat_dependency', 'source_to_target',
    'Monarch caterpillars are specialist herbivores on Asclepias milkweed foliage and sequester defensive cardenolides, while adults visit milkweed flowers for nectar and transfer pollinia.',
    'U.S. Fish & Wildlife Service / Xerces Society / iNaturalist Taxon 48662',
    'https://www.inaturalist.org/taxa/48662-Danaus-plexippus',
    true
  ),
  (
    'apis mellifera', 'Western Honey Bee', 'Apis mellifera',
    'malus domestica', 'Apple Tree', 'Malus domestica',
    'pollination', 'source_to_target',
    'Honey bees transfer pollen between apple blossoms during nectar and pollen foraging, enabling cross-pollination and fruit set.',
    'FAO / USDA Pollination Reference / iNaturalist Taxon 47219',
    'https://www.inaturalist.org/taxa/47219-Apis-mellifera',
    true
  ),
  (
    'canis lupus', 'Gray Wolf', 'Canis lupus',
    'cervus canadensis', 'Elk', 'Cervus canadensis',
    'predator_prey', 'source_to_target',
    'Gray wolves prey selectively on elk across temperate mountain ecosystems, influencing herd abundance, age structure, and seasonal foraging distribution.',
    'National Park Service (Yellowstone Wolf Project) / iNaturalist Taxon 42048',
    'https://www.nps.gov/yell/learn/nature/wolves.htm',
    true
  ),
  (
    'enhydra lutris', 'Sea Otter', 'Enhydra lutris',
    'macrocystis pyrifera', 'Giant Kelp', 'Macrocystis pyrifera',
    'habitat_dependency', 'bidirectional',
    'Sea otters prey on herbivorous sea urchins, limiting urchin overgrazing of giant kelp forests while using floating kelp canopies as resting habitat.',
    'NOAA / Monterey Bay Aquarium / iNaturalist Taxon 41860',
    'https://www.inaturalist.org/taxa/41860-Enhydra-lutris',
    true
  ),
  (
    'nucifraga columbiana', 'Clark''s Nutcracker', 'Nucifraga columbiana',
    'pinus albicaulis', 'Whitebark Pine', 'Pinus albicaulis',
    'seed_dispersal', 'source_to_target',
    'Clark''s Nutcrackers harvest and cache thousands of Whitebark Pine seeds in alpine soils; unretrieved caches serve as the tree''s primary dispersal and germination mechanism.',
    'USDA Forest Service / Whitebark Pine Ecosystem Foundation / iNaturalist Taxon 8319',
    'https://www.inaturalist.org/taxa/8319-Nucifraga-columbiana',
    true
  )
ON CONFLICT (source_species_key, target_species_key, relationship_type) DO UPDATE SET
  relationship_type = EXCLUDED.relationship_type,
  ecological_summary = EXCLUDED.ecological_summary,
  source_citation = EXCLUDED.source_citation,
  source_url = EXCLUDED.source_url;

NOTIFY pgrst, 'reload schema';
