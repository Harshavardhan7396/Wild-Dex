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
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Unique case-insensitive index for usernames
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);

-- 3. ALBUMS TABLE
CREATE TABLE IF NOT EXISTS public.albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

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
