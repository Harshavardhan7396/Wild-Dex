-- ==============================================================================
-- WildDex - Supabase Database Schema, Row Level Security & Storage Configuration
-- Run this entire script in the Supabase Dashboard -> SQL Editor -> New query
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES TABLE
-- Automatically populated when users sign up via auth trigger
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_public BOOLEAN DEFAULT true,
  not_interested_taxa BIGINT[] DEFAULT '{}'::bigint[],
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS not_interested_taxa BIGINT[] DEFAULT '{}'::bigint[];

-- 2B. USER_PRIVATE TABLE (Sensitive onboarding interests, favorites & rounded home location)
CREATE TABLE IF NOT EXISTS public.user_private (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  interests TEXT[] DEFAULT '{}'::text[],
  favorite_species JSONB DEFAULT '[]'::jsonb,
  onboarding_done BOOLEAN DEFAULT false,
  location_consent BOOLEAN DEFAULT false,
  home_lat DOUBLE PRECISION,
  home_lng DOUBLE PRECISION,
  home_label TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.user_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user_private" ON public.user_private;
CREATE POLICY "Users can view own user_private"
  ON public.user_private FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own user_private" ON public.user_private;
CREATE POLICY "Users can insert own user_private"
  ON public.user_private FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own user_private" ON public.user_private;
CREATE POLICY "Users can update own user_private"
  ON public.user_private FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own user_private" ON public.user_private;
CREATE POLICY "Users can delete own user_private"
  ON public.user_private FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Unique case-insensitive index for usernames
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);

-- 3. ALBUMS TABLE
CREATE TABLE IF NOT EXISTS public.albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- Indexes for albums
CREATE INDEX IF NOT EXISTS idx_albums_owner_id ON public.albums(owner_id);
CREATE INDEX IF NOT EXISTS idx_albums_created_at ON public.albums(created_at);

-- 4. COLLECTION_ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.collection_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  album_id UUID REFERENCES public.albums(id) ON DELETE SET NULL,
  species_name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  rarity TEXT NOT NULL,
  photo_path TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for collection_items
CREATE INDEX IF NOT EXISTS idx_collection_items_owner_id ON public.collection_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_created_at ON public.collection_items(created_at);
CREATE INDEX IF NOT EXISTS idx_collection_items_album_id ON public.collection_items(album_id);

-- 5. FUTURE SOCIAL TABLES (Placeholders for expansion)
-- FOLLOWS
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- POSTS (Community / Field Feed)
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  collection_item_id UUID REFERENCES public.collection_items(id) ON DELETE SET NULL,
  caption TEXT,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (is_public = true OR auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- Albums Policies
DROP POLICY IF EXISTS "Users can view own albums" ON public.albums;
CREATE POLICY "Users can view own albums"
  ON public.albums FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can create own albums" ON public.albums;
CREATE POLICY "Users can create own albums"
  ON public.albums FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own albums" ON public.albums;
CREATE POLICY "Users can update own albums"
  ON public.albums FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own albums" ON public.albums;
CREATE POLICY "Users can delete own albums"
  ON public.albums FOR DELETE
  USING (auth.uid() = owner_id);

-- Collection Items Policies
DROP POLICY IF EXISTS "Users can view own collection items" ON public.collection_items;
CREATE POLICY "Users can view own collection items"
  ON public.collection_items FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own collection items" ON public.collection_items;
CREATE POLICY "Users can insert own collection items"
  ON public.collection_items FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own collection items" ON public.collection_items;
CREATE POLICY "Users can update own collection items"
  ON public.collection_items FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own collection items" ON public.collection_items;
CREATE POLICY "Users can delete own collection items"
  ON public.collection_items FOR DELETE
  USING (auth.uid() = owner_id);

-- Future tables RLS policies
DROP POLICY IF EXISTS "Users can view notifications for themselves" ON public.notifications;
CREATE POLICY "Users can view notifications for themselves"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Posts are viewable by all logged-in users" ON public.posts;
CREATE POLICY "Posts are viewable by all logged-in users"
  ON public.posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
CREATE POLICY "Users can create their own posts"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
CREATE POLICY "Follows are viewable by everyone"
  ON public.follows FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can follow/unfollow" ON public.follows;
CREATE POLICY "Users can follow/unfollow"
  ON public.follows FOR ALL
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

-- ==============================================================================
-- 7. AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGN-UP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
BEGIN
  -- Extract username from user metadata, defaulting to email prefix if not supplied
  v_username := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))));
  v_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, username, display_name, avatar_url, bio, is_public)
  VALUES (
    NEW.id,
    v_username,
    v_display_name,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    'Nature enthusiast & biodiversity explorer',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);

  INSERT INTO public.user_private (user_id, onboarding_done)
  VALUES (NEW.id, false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 8. SECURITY DEFINER RPC FUNCTIONS FOR USERNAME LOOKUP & AVAILABILITY
-- ==============================================================================

-- Lookup matching email by username without exposing the profiles table
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF p_username IS NULL OR TRIM(p_username) = '' THEN
    RETURN NULL;
  END IF;

  SELECT u.email INTO v_email
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE LOWER(p.username) = LOWER(TRIM(p_username))
  LIMIT 1;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_by_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated, service_role;

-- Fast username availability check for real-time validation
CREATE OR REPLACE FUNCTION public.check_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_username IS NULL OR LENGTH(TRIM(p_username)) < 3 OR LENGTH(TRIM(p_username)) > 20 THEN
    RETURN FALSE;
  END IF;

  -- Verify format: 3-20 characters, alphanumeric and underscore only
  IF TRIM(p_username) !~ '^[a-zA-Z0-9_]{3,20}$' THEN
    RETURN FALSE;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(TRIM(p_username))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- 8. STORAGE BUCKET & STORAGE RLS POLICIES
-- ==============================================================================
-- Create the private "scans" bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('scans', 'scans', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage Policy: Users can upload files ONLY to their own folder {user_id}/{filename}
DROP POLICY IF EXISTS "Users can upload their own scans" ON storage.objects;
CREATE POLICY "Users can upload their own scans"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'scans' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policy: Users can view/download their own scan photos
DROP POLICY IF EXISTS "Users can view their own scans" ON storage.objects;
CREATE POLICY "Users can view their own scans"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'scans' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policy: Users can delete their own scan photos
DROP POLICY IF EXISTS "Users can delete their own scans" ON storage.objects;
CREATE POLICY "Users can delete their own scans"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'scans' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==============================================================================
-- 9. COMMUNITY FEED (public_profiles, community_posts, likes, comments, follows, reports)
-- ==============================================================================

-- Public-safe profile view (never exposes private fields like email or rounded coordinates)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  COALESCE(NULLIF(username, ''), NULLIF(display_name, ''), 'Explorer') AS username,
  COALESCE(NULLIF(display_name, ''), NULLIF(username, ''), 'Explorer') AS display_name,
  COALESCE(avatar_url, '') AS avatar_url
FROM public.profiles
WHERE is_public IS NOT FALSE;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- User follows
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(follower_id, following_id),
  CHECK (follower_id <> following_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_follows'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_follows' AND column_name = 'follower_id'
    ) THEN
      ALTER TABLE public.user_follows
        ADD COLUMN follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_follows' AND column_name = 'user_id'
      ) THEN
        UPDATE public.user_follows SET follower_id = user_id WHERE follower_id IS NULL;
        ALTER TABLE public.user_follows ALTER COLUMN user_id DROP NOT NULL;
      END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_follows' AND column_name = 'following_id'
    ) THEN
      ALTER TABLE public.user_follows
        ADD COLUMN following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_follows' AND column_name = 'followed_id'
      ) THEN
        UPDATE public.user_follows SET following_id = followed_id WHERE following_id IS NULL;
        ALTER TABLE public.user_follows ALTER COLUMN followed_id DROP NOT NULL;
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_follows' AND column_name = 'target_id'
      ) THEN
        UPDATE public.user_follows SET following_id = target_id WHERE following_id IS NULL;
        ALTER TABLE public.user_follows ALTER COLUMN target_id DROP NOT NULL;
      END IF;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

-- Community posts
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  collection_item_id UUID REFERENCES public.collection_items(id) ON DELETE SET NULL,
  species_name TEXT NOT NULL,
  scientific_name TEXT DEFAULT '',
  caption TEXT NOT NULL CHECK (char_length(caption) <= 500),
  place_label TEXT DEFAULT '',
  photo_path TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'community_posts'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'community_posts' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.community_posts
      ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'community_posts' AND column_name = 'author_id'
    ) THEN
      UPDATE public.community_posts SET user_id = author_id WHERE user_id IS NULL;
      ALTER TABLE public.community_posts ALTER COLUMN author_id DROP NOT NULL;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'community_posts' AND column_name = 'owner_id'
    ) THEN
      UPDATE public.community_posts SET user_id = owner_id WHERE user_id IS NULL;
      ALTER TABLE public.community_posts ALTER COLUMN owner_id DROP NOT NULL;
    END IF;
  END IF;
END $$;

ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS collection_item_id UUID REFERENCES public.collection_items(id) ON DELETE SET NULL;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS species_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS scientific_name TEXT DEFAULT '';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS caption TEXT NOT NULL DEFAULT '';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS place_label TEXT DEFAULT '';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS photo_path TEXT NOT NULL DEFAULT '';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON public.community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_visibility ON public.community_posts(visibility);

-- Post likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);

-- Post comments
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 500),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON public.post_comments(created_at ASC);

-- Post reports
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_post_id ON public.reports(post_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);

-- Enable RLS on Community tables
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- user_follows policies
DROP POLICY IF EXISTS "User follows are viewable by authenticated users" ON public.user_follows;
CREATE POLICY "User follows are viewable by authenticated users"
  ON public.user_follows FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON public.user_follows;
CREATE POLICY "Users can follow others"
  ON public.user_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id AND follower_id <> following_id);

DROP POLICY IF EXISTS "Users can unfollow others" ON public.user_follows;
CREATE POLICY "Users can unfollow others"
  ON public.user_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- community_posts policies
DROP POLICY IF EXISTS "Community posts visibility policy" ON public.community_posts;
CREATE POLICY "Community posts visibility policy"
  ON public.community_posts FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR auth.uid() = user_id
    OR (
      visibility = 'followers'
      AND EXISTS (
        SELECT 1 FROM public.user_follows uf
        WHERE uf.follower_id = auth.uid() AND uf.following_id = community_posts.user_id
      )
    )
  );

DROP POLICY IF EXISTS "Users can create their own community posts" ON public.community_posts;
CREATE POLICY "Users can create their own community posts"
  ON public.community_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own community posts" ON public.community_posts;
CREATE POLICY "Users can delete their own community posts"
  ON public.community_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- post_likes policies
DROP POLICY IF EXISTS "Post likes are viewable by authenticated users" ON public.post_likes;
CREATE POLICY "Post likes are viewable by authenticated users"
  ON public.post_likes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
CREATE POLICY "Users can like posts"
  ON public.post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;
CREATE POLICY "Users can unlike posts"
  ON public.post_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- post_comments policies
DROP POLICY IF EXISTS "Post comments are viewable by authenticated users" ON public.post_comments;
CREATE POLICY "Post comments are viewable by authenticated users"
  ON public.post_comments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can add comments" ON public.post_comments;
CREATE POLICY "Users can add comments"
  ON public.post_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON public.post_comments;
CREATE POLICY "Users can delete own comments"
  ON public.post_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- reports policies
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can submit reports" ON public.reports;
CREATE POLICY "Users can submit reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Storage bucket 'posts' for shared community sightings
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Community post photos are publicly viewable" ON storage.objects;
CREATE POLICY "Community post photos are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "Users can upload their own post photos" ON storage.objects;
CREATE POLICY "Users can upload their own post photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'posts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own post photos" ON storage.objects;
CREATE POLICY "Users can delete their own post photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'posts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==============================================================================
-- 10. WEEKLY CHALLENGES & LEADERBOARD RPC
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  target INT NOT NULL DEFAULT 5 CHECK (target > 0),
  points INT NOT NULL DEFAULT 500 CHECK (points >= 0),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenges_window ON public.challenges(starts_at, ends_at);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Challenges are viewable by everyone" ON public.challenges;
CREATE POLICY "Challenges are viewable by everyone"
  ON public.challenges FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.leaderboard(
  p_since TIMESTAMPTZ DEFAULT '2000-01-01T00:00:00Z'::timestamptz,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  scans_count BIGINT,
  species_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY COUNT(*) DESC, COUNT(DISTINCT LOWER(ci.scientific_name)) DESC, MIN(ci.created_at) ASC
    ) AS rank,
    p.id AS user_id,
    COALESCE(NULLIF(p.username, ''), NULLIF(p.display_name, ''), 'Explorer') AS username,
    COALESCE(NULLIF(p.display_name, ''), NULLIF(p.username, ''), 'Explorer') AS display_name,
    COALESCE(p.avatar_url, '') AS avatar_url,
    COUNT(*)::BIGINT AS scans_count,
    COUNT(DISTINCT LOWER(ci.scientific_name))::BIGINT AS species_count
  FROM public.collection_items ci
  JOIN public.profiles p ON p.id = ci.owner_id
  WHERE p.is_public = true
    AND ci.created_at >= COALESCE(p_since, '2000-01-01T00:00:00Z'::timestamptz)
    AND (
      p_category IS NULL
      OR TRIM(p_category) = ''
      OR LOWER(ci.category) = LOWER(TRIM(p_category))
    )
  GROUP BY p.id, p.username, p.display_name, p.avatar_url
  ORDER BY rank ASC;
$$;

REVOKE ALL ON FUNCTION public.leaderboard(TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard(TIMESTAMPTZ, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- 11. SHARED COLLECTION (album_members, album_invites, shared_album_items, accept_invite)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.album_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(album_id, user_id)
);
ALTER TABLE public.album_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
CREATE INDEX IF NOT EXISTS idx_album_members_album_id ON public.album_members(album_id);
CREATE INDEX IF NOT EXISTS idx_album_members_user_id ON public.album_members(user_id);

CREATE TABLE IF NOT EXISTS public.album_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (TIMEZONE('utc'::text, NOW()) + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_album_invites_album_id ON public.album_invites(album_id);
CREATE INDEX IF NOT EXISTS idx_album_invites_code ON public.album_invites(code);

CREATE TABLE IF NOT EXISTS public.shared_album_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE NOT NULL,
  added_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  collection_item_id UUID REFERENCES public.collection_items(id) ON DELETE SET NULL,
  species_name TEXT NOT NULL,
  scientific_name TEXT DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.shared_album_items ADD COLUMN IF NOT EXISTS collection_item_id UUID REFERENCES public.collection_items(id) ON DELETE SET NULL;
ALTER TABLE public.shared_album_items ADD COLUMN IF NOT EXISTS scientific_name TEXT DEFAULT '';
ALTER TABLE public.shared_album_items ADD COLUMN IF NOT EXISTS photo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.shared_album_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shared_album_items_album_id ON public.shared_album_items(album_id);
CREATE INDEX IF NOT EXISTS idx_shared_album_items_added_by ON public.shared_album_items(added_by);

-- Automatically insert owner into album_members when an album is created
CREATE OR REPLACE FUNCTION public.handle_new_album_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.album_members (album_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (album_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_album_created_add_owner ON public.albums;
CREATE TRIGGER on_album_created_add_owner
  AFTER INSERT ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_album_member();

-- Non-recursive SECURITY DEFINER membership helpers for RLS
CREATE OR REPLACE FUNCTION public.is_album_owner(p_album_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.albums a
    WHERE a.id = p_album_id AND a.owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_album_member(p_album_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.albums a
    WHERE a.id = p_album_id AND a.owner_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.album_members am
    WHERE am.album_id = p_album_id AND am.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_album_editor_or_owner(p_album_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.albums a
    WHERE a.id = p_album_id AND a.owner_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.album_members am
    WHERE am.album_id = p_album_id
      AND am.user_id = p_user_id
      AND am.role IN ('owner', 'editor')
  );
$$;

-- Enable RLS on shared album tables
ALTER TABLE public.album_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_album_items ENABLE ROW LEVEL SECURITY;

-- Allow members to view shared albums in addition to owners
DROP POLICY IF EXISTS "Users can view own or shared albums" ON public.albums;
CREATE POLICY "Users can view own or shared albums"
  ON public.albums FOR SELECT
  TO authenticated
  USING (public.is_album_member(id, auth.uid()));

-- album_members policies
DROP POLICY IF EXISTS "Members can view album members" ON public.album_members;
CREATE POLICY "Members can view album members"
  ON public.album_members FOR SELECT
  TO authenticated
  USING (public.is_album_member(album_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can manage album members" ON public.album_members;
CREATE POLICY "Owners can manage album members"
  ON public.album_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_album_owner(album_id, auth.uid()));

DROP POLICY IF EXISTS "Members can leave or owners can remove members" ON public.album_members;
CREATE POLICY "Members can leave or owners can remove members"
  ON public.album_members FOR DELETE
  TO authenticated
  USING (
    (auth.uid() = user_id AND NOT public.is_album_owner(album_id, auth.uid()))
    OR (public.is_album_owner(album_id, auth.uid()) AND user_id <> auth.uid())
  );

-- album_invites policies
DROP POLICY IF EXISTS "Owners can view album invites" ON public.album_invites;
CREATE POLICY "Owners can view album invites"
  ON public.album_invites FOR SELECT
  TO authenticated
  USING (public.is_album_owner(album_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can create album invites" ON public.album_invites;
CREATE POLICY "Owners can create album invites"
  ON public.album_invites FOR INSERT
  TO authenticated
  WITH CHECK (public.is_album_owner(album_id, auth.uid()) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Owners can delete album invites" ON public.album_invites;
CREATE POLICY "Owners can delete album invites"
  ON public.album_invites FOR DELETE
  TO authenticated
  USING (public.is_album_owner(album_id, auth.uid()));

-- shared_album_items policies
DROP POLICY IF EXISTS "Members can view shared album items" ON public.shared_album_items;
CREATE POLICY "Members can view shared album items"
  ON public.shared_album_items FOR SELECT
  TO authenticated
  USING (public.is_album_member(album_id, auth.uid()));

DROP POLICY IF EXISTS "Owners and editors can add shared album items" ON public.shared_album_items;
CREATE POLICY "Owners and editors can add shared album items"
  ON public.shared_album_items FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = added_by
    AND public.is_album_editor_or_owner(album_id, auth.uid())
  );

DROP POLICY IF EXISTS "Editors remove own items or owners remove any item" ON public.shared_album_items;
CREATE POLICY "Editors remove own items or owners remove any item"
  ON public.shared_album_items FOR DELETE
  TO authenticated
  USING (
    auth.uid() = added_by
    OR public.is_album_owner(album_id, auth.uid())
  );

-- RPC: accept_invite(p_code TEXT) -> returns album_id UUID
CREATE OR REPLACE FUNCTION public.accept_invite(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_invite RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Please sign in to accept this invite.';
  END IF;

  IF p_code IS NULL OR TRIM(p_code) = '' THEN
    RAISE EXCEPTION 'Invite is invalid or expired';
  END IF;

  SELECT * INTO v_invite
  FROM public.album_invites
  WHERE code = TRIM(p_code)
    AND expires_at > TIMEZONE('utc'::text, NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite is invalid or expired';
  END IF;

  INSERT INTO public.album_members (album_id, user_id, role)
  VALUES (v_invite.album_id, v_user_id, v_invite.role)
  ON CONFLICT (album_id, user_id) DO UPDATE SET
    role = CASE
      WHEN public.album_members.role = 'owner' THEN 'owner'
      ELSE EXCLUDED.role
    END;

  RETURN v_invite.album_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite(TEXT) TO authenticated, service_role;

-- Refresh PostgREST schema cache so newly added columns are immediately visible
NOTIFY pgrst, 'reload schema';
