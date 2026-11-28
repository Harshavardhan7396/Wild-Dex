-- ==============================================================================
-- WildDex Dev — Step 3: Idempotent Development Seed & Verification Script
-- ==============================================================================
-- RUN THIS ONLY IN THE "WildDex Dev" SUPABASE PROJECT SQL EDITOR!
-- DO NOT RUN AGAINST PRODUCTION.
--
-- Prerequisites (must be executed in order BEFORE this file):
--   1. supabase/schema.sql
--   2. supabase/migrations/002_wild_dex_2_0.sql
-- ==============================================================================

-- 1. Ensure at least one active weekly challenge exists for ChallengeBanner / /#/challenge
INSERT INTO public.challenges (
  title,
  description,
  category,
  target,
  points,
  starts_at,
  ends_at
)
SELECT
  'Avian Spotter Week',
  'Scan and log 5 distinct wild bird sightings to earn bonus explorer recognition.',
  'birds',
  5,
  500,
  TIMEZONE('utc'::text, NOW()) - INTERVAL '1 hour',
  TIMEZONE('utc'::text, NOW()) + INTERVAL '7 days'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.challenges
  WHERE starts_at <= TIMEZONE('utc'::text, NOW())
    AND ends_at > TIMEZONE('utc'::text, NOW())
);

-- 2. Refresh PostgREST schema cache so all newly created RPCs & tables are exposed immediately
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- 3. NON-DESTRUCTIVE INITIALIZATION VERIFICATION QUERIES
-- Inspect the output tabs below to verify WildDex Dev is complete.
-- ==============================================================================

-- Verify storage buckets ('scans' private, 'posts' public)
SELECT id, name, public
FROM storage.buckets
WHERE id IN ('scans', 'posts')
ORDER BY id;

-- Verify realtime publication includes public.messages
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;

-- Verify core + Phase 2 seed counts
SELECT
  (SELECT COUNT(*) FROM public.challenges WHERE ends_at > NOW()) AS active_weekly_challenges,
  (SELECT COUNT(*) FROM public.trusted_species_taxa) AS trusted_species_count,
  (SELECT COUNT(*) FROM public.achievements) AS achievements_count,
  (SELECT COUNT(*) FROM public.missions) AS missions_count,
  (SELECT COUNT(*) FROM public.species_daily_challenges) AS daily_challenges_count,
  (SELECT COUNT(*) FROM public.species_relationships) AS species_relationships_count;

-- Verify key RPC functions exist in public schema
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_email_by_username',
    'check_username_available',
    'leaderboard',
    'accept_invite',
    'get_profile',
    'search_people',
    'follow_list',
    'remove_follower',
    'relationship',
    'block_user',
    'are_mutual_friends',
    'start_conversation',
    'mark_read',
    'my_conversations',
    'unread_total',
    'compute_level_from_xp',
    'record_species_discovery',
    'claim_mission_reward',
    'get_species_of_the_day',
    'submit_species_daily_guess',
    'get_my_quest_state'
  )
ORDER BY routine_name;
