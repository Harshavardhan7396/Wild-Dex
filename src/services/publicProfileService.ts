import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  fetchFollowingIds,
  toggleFollowUser,
} from './communityService';
import { getSignedPhotoUrl } from './supabaseCollectionService';
import { CURATED_SPECIES } from './speciesService';

export interface PublicProfileData {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  isPublic: boolean;
  speciesFound: number;
  scansCount: number;
  followersCount: number;
  followingCount: number;
}

export interface PersonSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isPublic: boolean;
}

export interface PublicUserPost {
  id: string;
  userId: string;
  speciesName: string;
  scientificName: string;
  caption: string;
  photoUrl: string;
  createdAt: string;
}

export interface PublicCollectionItem {
  id: string;
  speciesName: string;
  scientificName: string;
  category: string;
  photoUrl: string;
  createdAt: string;
}

function normalizeCount(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolvePostPhotoUrl(photoPath: string): string {
  const clean = (photoPath || '').trim();
  if (!clean) return '';
  if (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('data:')
  ) {
    return clean;
  }
  try {
    const { data } = supabase.storage.from('posts').getPublicUrl(clean);
    if (data?.publicUrl) return data.publicUrl;
  } catch {}
  return '';
}

function findSpeciesFallbackPhoto(speciesName: string, scientificName: string): string {
  const matched = CURATED_SPECIES.find(
    (c) =>
      (scientificName && c.scientificName.toLowerCase() === scientificName.toLowerCase()) ||
      (speciesName && c.commonName.toLowerCase() === speciesName.toLowerCase())
  );
  return matched?.photoUrl || '';
}

async function fetchFollowCountsFallback(
  targetUserId: string
): Promise<{ followers: number; following: number }> {
  try {
    const [followersRes, followingRes] = await Promise.all([
      supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', targetUserId),
      supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', targetUserId),
    ]);

    return {
      followers: typeof followersRes.count === 'number' ? followersRes.count : 0,
      following: typeof followingRes.count === 'number' ? followingRes.count : 0,
    };
  } catch {
    return { followers: 0, following: 0 };
  }
}

/**
 * Fetch a user's profile via supabase.rpc('get_profile', { p_username }).
 * Returns null if username does not exist.
 */
export async function getProfileByUsername(
  username: string
): Promise<PublicProfileData | null> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const cleanUsername = decodeURIComponent(username || '').trim();
  if (!cleanUsername) return null;

  try {
    const { data, error } = await supabase.rpc('get_profile', {
      p_username: cleanUsername,
    });

    if (error) {
      throw new Error(error.message || 'Could not load profile.');
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || (!row.id && !row.user_id && !row.username)) {
      return null;
    }

    const userId = String(row.id || row.user_id || '');
    const resolvedUsername = String(
      row.username || row.display_name || cleanUsername
    );
    const resolvedDisplayName = String(
      row.display_name || row.username || resolvedUsername
    );
    const isPublic = row.is_public !== false;

    const rawSpecies =
      normalizeCount(row.species_found) ??
      normalizeCount(row.species_count) ??
      0;
    const rawScans =
      normalizeCount(row.scans_count) ?? normalizeCount(row.scans) ?? 0;

    let followersCount =
      normalizeCount(row.followers_count) ?? normalizeCount(row.followers);
    let followingCount =
      normalizeCount(row.following_count) ?? normalizeCount(row.following);

    if (
      isPublic &&
      userId &&
      (followersCount === null || followingCount === null)
    ) {
      const counts = await fetchFollowCountsFallback(userId);
      if (followersCount === null) followersCount = counts.followers;
      if (followingCount === null) followingCount = counts.following;
    }

    return {
      id: userId,
      username: resolvedUsername,
      displayName: resolvedDisplayName,
      avatarUrl: String(row.avatar_url || ''),
      bio: String(row.bio || ''),
      isPublic,
      speciesFound: rawSpecies,
      scansCount: rawScans,
      followersCount: followersCount ?? 0,
      followingCount: followingCount ?? 0,
    };
  } catch (err: any) {
    console.error('Error calling get_profile:', err);
    throw err instanceof Error ? err : new Error('Could not load profile.');
  }
}

/**
 * Search people via supabase.rpc('search_people', { p_q }).
 */
export async function searchPeople(query: string): Promise<PersonSearchResult[]> {
  if (!isSupabaseConfigured) return [];
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const { data, error } = await supabase.rpc('search_people', {
      p_q: trimmed,
    });

    if (error) {
      throw new Error(error.message || 'Could not search people.');
    }

    if (!Array.isArray(data)) return [];

    return data
      .filter((row: any) => Boolean(row && (row.username || row.display_name)))
      .map((row: any) => ({
        id: String(row.id || row.user_id || ''),
        username: String(row.username || row.display_name || 'Explorer'),
        displayName: String(row.display_name || row.username || 'Explorer'),
        avatarUrl: String(row.avatar_url || ''),
        isPublic: row.is_public !== false,
      }));
  } catch (err: any) {
    console.error('Error calling search_people:', err);
    throw err instanceof Error ? err : new Error('Could not search people.');
  }
}

/**
 * Fetch a user's public community_posts (newest first).
 * Never exposes location data.
 */
export async function fetchPublicUserPosts(
  targetUserId: string
): Promise<PublicUserPost[]> {
  if (!isSupabaseConfigured || !targetUserId) return [];

  try {
    let rows: any[] | null = null;
    const primaryRes = await supabase
      .from('community_posts')
      .select('id, user_id, species_name, scientific_name, caption, photo_path, created_at')
      .eq('user_id', targetUserId)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(50);

    if (primaryRes.error) {
      const msg = (primaryRes.error.message || '').toLowerCase();
      if (msg.includes('user_id') && msg.includes('does not exist')) {
        const fallbackRes = await supabase
          .from('community_posts')
          .select('id, author_id, species_name, scientific_name, caption, photo_path, created_at')
          .eq('author_id', targetUserId)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(50);
        if (fallbackRes.error) throw fallbackRes.error;
        rows = fallbackRes.data || [];
      } else {
        throw primaryRes.error;
      }
    } else {
      rows = primaryRes.data || [];
    }

    const hydrated = await Promise.all(
      (rows || []).map(async (row: any) => {
        const rawPath = String(row.photo_path || '');
        let photoUrl = resolvePostPhotoUrl(rawPath);
        if (!photoUrl && rawPath) {
          try {
            photoUrl = await getSignedPhotoUrl(rawPath);
          } catch {}
        }
        return {
          id: String(row.id),
          userId: String(row.user_id || row.author_id || targetUserId),
          speciesName: String(row.species_name || 'Wild Discovery'),
          scientificName: String(row.scientific_name || ''),
          caption: String(row.caption || ''),
          photoUrl,
          createdAt: String(row.created_at || ''),
        };
      })
    );

    return hydrated;
  } catch (err: any) {
    console.error('Error fetching public user posts:', err);
    throw new Error(err?.message || 'Could not load posts.');
  }
}

/**
 * Fetch a public user's collection_items (photo + species name only, NEVER locations).
 */
export async function fetchPublicUserCollection(
  targetUserId: string
): Promise<PublicCollectionItem[]> {
  if (!isSupabaseConfigured || !targetUserId) return [];

  try {
    const { data, error } = await supabase
      .from('collection_items')
      .select('id, species_name, scientific_name, category, photo_path, created_at')
      .eq('owner_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(error.message || 'Could not load collection.');
    }

    if (!data || data.length === 0) return [];

    const items = await Promise.all(
      data.map(async (row: any) => {
        let photoUrl = '';
        if (row.photo_path) {
          try {
            photoUrl = await getSignedPhotoUrl(String(row.photo_path));
          } catch {}
        }
        if (!photoUrl) {
          photoUrl = findSpeciesFallbackPhoto(
            String(row.species_name || ''),
            String(row.scientific_name || '')
          );
        }

        return {
          id: String(row.id),
          speciesName: String(row.species_name || 'Unknown Species'),
          scientificName: String(row.scientific_name || ''),
          category: String(row.category || ''),
          photoUrl,
          createdAt: String(row.created_at || ''),
        };
      })
    );

    return items;
  } catch (err: any) {
    console.error('Error fetching public user collection:', err);
    throw err instanceof Error ? err : new Error('Could not load collection.');
  }
}

/**
 * Check whether currentUserId is following targetUserId using user_follows.
 */
export async function fetchIsFollowingUser(
  currentUserId: string,
  targetUserId: string
): Promise<boolean> {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return false;
  }
  try {
    const followingIds = await fetchFollowingIds(currentUserId);
    return followingIds.includes(targetUserId);
  } catch (err) {
    console.error('Error checking follow status:', err);
    return false;
  }
}

export { toggleFollowUser };
