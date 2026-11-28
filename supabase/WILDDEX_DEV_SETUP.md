# WildDex Dev — Separate Development Database Initialization Guide

This guide creates an isolated Supabase development database (**WildDex Dev**) for your existing WildDex codebase while keeping your **Production Supabase project, production credentials, and production user data 100% untouched**.

---

## 1. Inspected Repository Migration Sequence

Every database dependency used by the WildDex frontend (`src/`), Express backend (`server.ts`, `src/server/*`), and Supabase Edge Functions (`supabase/functions/*`) maps to the following exact sequence:

1. **`supabase/schema.sql`** — Base Phase 1 schema:
   - Extension: `uuid-ossp`
   - Tables: `profiles`, `user_private`, `albums`, `collection_items`, `follows`, `posts`, `notifications`, `user_follows`, `community_posts`, `post_likes`, `post_comments`, `reports`, `challenges`, `album_members`, `album_invites`, `shared_album_items`, `user_blocks`, `conversations`, `conversation_participants`, `messages`
   - View: `public_profiles`
   - Storage buckets & RLS: `scans` (private), `posts` (public)
   - Triggers: `on_auth_user_created` (`handle_new_user`), `on_album_created_add_owner` (`handle_new_album_member`)
   - RPCs: `get_email_by_username`, `check_username_available`, `leaderboard`, `is_album_owner`, `is_album_member`, `is_album_editor_or_owner`, `accept_invite`, `get_profile`, `search_people`, `follow_list`, `remove_follower`, `relationship`, `block_user`, `are_mutual_friends`, `start_conversation`, `mark_read`, `my_conversations`, `unread_total`
   - Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;`

2. **`supabase/migrations/002_wild_dex_2_0.sql`** — Phase 2 additive upgrade:
   - Extension: `pgcrypto`
   - Tables: `trusted_species_taxa`, `scan_verifications`, `user_species`, `user_progression`, `xp_transactions`, `processed_scan_rewards`, `achievements`, `user_achievements`, `missions`, `mission_progress`, `species_daily_challenges`, `species_daily_attempts`, `species_relationships`, `species_observations`
   - Immutability, ownership, and geo-privacy triggers + strict RLS policies
   - Zero-trust RPCs: `compute_level_from_xp`, `record_species_discovery`, `claim_mission_reward`, `get_species_of_the_day`, `submit_species_daily_guess`, `get_my_quest_state`
   - Seed data: `trusted_species_taxa`, `achievements`, `missions`, `species_daily_challenges`, `species_relationships`

3. **`supabase/seed_dev.sql`** — Dev-only optional seed & verification:
   - Inserts one active weekly challenge into `public.challenges` (idempotent; skips if one is already active)
   - Reloads PostgREST schema cache and verifies buckets, Realtime publication, seed counts, and all 21 RPC functions

4. **Supabase Edge Functions (`supabase/functions/*`)**:
   - `supabase/functions/scan/index.ts` — Called by `src/services/scannerService.ts` (`supabase.functions.invoke('scan', ...)`). Requires `GEMINI_API_KEY` set as a **Supabase Edge Function Secret** in **WildDex Dev**.
   - Note: `src/pages/HealthCheckerPage.tsx` also calls `supabase.functions.invoke('health', ...)` when running diagnostics. That `health` function source is not stored in this repository; deploy a simple `health` edge function in `WildDex Dev` if you want that diagnostic check to return `200 OK` on Dev.

---

## 2. Step-by-Step Setup for `WildDex Dev`

### Step A — Create the New Supabase Project
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and click **New Project**.
2. Set **Name** to `WildDex Dev`.
3. Choose a strong database password and your preferred region, then wait for provisioning to finish.
4. Go to **Settings -> API** inside **WildDex Dev** and copy:
   - **Project URL** (`https://<DEV_PROJECT_REF>.supabase.co`)
   - **`anon` public key**
   - **`service_role` secret key** *(keep strictly server-side — never expose in `VITE_*`)*

### Step B — Run the Database Migration Sequence on `WildDex Dev`
> Double-check the project badge in the top bar says **`WildDex Dev`** before running any SQL.

1. Open **SQL Editor -> New query** in **WildDex Dev**:
   - Paste the entire contents of `supabase/schema.sql` and click **Run**.
2. Open a second **New query** in **WildDex Dev**:
   - Paste the entire contents of `supabase/migrations/002_wild_dex_2_0.sql` and click **Run**.
3. Open a third **New query** in **WildDex Dev**:
   - Paste the entire contents of `supabase/seed_dev.sql` and click **Run**.
   - Verify the output shows:
     - `scans` (`public = false`) and `posts` (`public = true`)
     - `messages` in `supabase_realtime`
     - `active_weekly_challenges >= 1`, `trusted_species_count`, `achievements_count`, `missions_count`, `daily_challenges_count`, `species_relationships_count`
     - All 21 RPC functions listed

### Step C — Configure Authentication & Realtime in `WildDex Dev`
1. In **WildDex Dev -> Authentication -> URL Configuration**:
   - Add your Dev URLs to **Site URL** and **Redirect URLs** (for example `http://localhost:3000` and your AI Studio Dev URL).
2. In **Authentication -> Providers**:
   - Enable Email/Password (and OAuth providers if used in Dev).
3. In **Database -> Replication**:
   - Confirm `public.messages` has Realtime enabled.

### Step D — Deploy the `scan` Edge Function to `WildDex Dev`
From your local terminal (logged into Supabase CLI):
```bash
supabase link --project-ref YOUR_WILDDEX_DEV_PROJECT_REF
supabase secrets set GEMINI_API_KEY="YOUR_DEV_GEMINI_API_KEY"
supabase functions deploy scan
```
*(Do not run `supabase link` against your production project ref.)*

### Step E — Keep Dev & Production Credentials Strictly Separate
- **Local Development**:
  1. Copy `.env.development.example` to `.env.development` (gitignored).
  2. Fill in **only** the `WildDex Dev` URL, `anon` key, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY`.
  3. Run `npm run dev` — both Vite (client) and `server.ts` (Express `/api/*`) now automatically load `.env.development` in dev mode.
- **AI Studio / Hosted Environments**:
  - **Development App Secrets**: Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY` to your **WildDex Dev** values.
  - **Production App Secrets**: Leave untouched — keep pointing exclusively at your original Production Supabase project.
  - `server.ts` loads `.env.${NODE_ENV}` with `override: false`, so runtime secrets injected by your hosting platform always take precedence and never leak across environments.

### Step F — Smoke Test `WildDex Dev`
1. Sign up a fresh test account in your **Dev** app (do not insert rows directly into `auth.users` via SQL, so `on_auth_user_created` populates `profiles` and `user_private` properly).
2. Confirm in **WildDex Dev -> Table Editor** that `profiles` and `user_private` received your test user, while **Production** has zero new rows.
3. Scan or upload a test photo, save it to your Collection, and verify `scan_verifications`, `collection_items`, `user_species`, `user_progression`, and `xp_transactions` update inside **WildDex Dev**.
