import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  fetchFollowingIds,
  toggleFollowUser,
} from './communityService';
import { getSignedPhotoUrl } from './supabaseCollectionService';
import { CURATED_SPECIES } from './speciesService';

export type FollowListKind = 'followers' | 'following';

export interface FollowListUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  iFollow: boolean;
  followsMe: boolean;
}

export interface UserRelationship {
  iFollow: boolean;
  followsMe: boolean;
  isBlocked: boolean;
}

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
 * Fetch exact followers & following counts from user_follows for a userId.
 */
export async function fetchUserFollowCounts(
  targetUserId: string
): Promise<{ followersCount: number; followingCount: number }> {
  if (!isSupabaseConfigured || !targetUserId) {
    return { followersCount: 0, followingCount: 0 };
  }
  try {
    const counts = await fetchFollowCountsFallback(targetUserId);
    return {
      followersCount: counts.followers,
      followingCount: counts.following,
    };
  } catch (err) {
    console.error('Error fetching user follow counts:', err);
    return { followersCount: 0, followingCount: 0 };
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
 * Fetch followers or following list via supabase.rpc('follow_list', { p_user, p_kind }).
 */
export async function fetchFollowList(params: {
  targetUserId: string;
  kind: FollowListKind;
  currentUserId?: string;
}): Promise<FollowListUser[]> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { targetUserId, kind, currentUserId } = params;
  if (!targetUserId) return [];

  try {
    const { data, error } = await supabase.rpc('follow_list', {
      p_user: targetUserId,
      p_kind: kind,
    });

    if (error) {
      throw new Error(error.message || 'Could not load list.');
    }

    const rows = Array.isArray(data) ? data : [];
    const needsViewerRelationshipHydration =
      Boolean(currentUserId) &&
      rows.some(
        (r: any) =>
          (r?.i_follow === undefined && r?.is_following === undefined) ||
          (r?.follows_me === undefined && r?.is_follower === undefined)
      );

    let viewerFollowingSet = new Set<string>();
    let viewerFollowersSet = new Set<string>();

    if (needsViewerRelationshipHydration && currentUserId) {
      try {
        const [myFollowingIds, myFollowersRes] = await Promise.all([
          fetchFollowingIds(currentUserId),
          supabase
            .from('user_follows')
            .select('follower_id')
            .eq('following_id', currentUserId),
        ]);
        viewerFollowingSet = new Set(myFollowingIds);
        viewerFollowersSet = new Set(
          (myFollowersRes.data || [])
            .map((r: any) => String(r?.follower_id || ''))
            .filter(Boolean)
        );
      } catch (hydrateErr) {
        console.warn('Could not hydrate viewer follow flags:', hydrateErr);
      }
    }

    return rows
      .filter((row: any) => Boolean(row && (row.id || row.user_id || row.username)))
      .map((row: any) => {
        const id = String(row.id || row.user_id || '');
        const resolvedUsername = String(
          row.username || row.display_name || 'Explorer'
        );
        const resolvedDisplayName = String(
          row.display_name || row.username || resolvedUsername
        );

        const rawIFollow = row.i_follow ?? row.is_following ?? row.following;
        const rawFollowsMe = row.follows_me ?? row.is_follower;

        const iFollow =
          typeof rawIFollow === 'boolean'
            ? rawIFollow
            : viewerFollowingSet.has(id);

        const followsMe =
          typeof rawFollowsMe === 'boolean'
            ? rawFollowsMe
            : (kind === 'followers' && Boolean(currentUserId) && targetUserId === currentUserId) ||
              viewerFollowersSet.has(id);

        return {
          id,
          username: resolvedUsername,
          displayName: resolvedDisplayName,
          avatarUrl: String(row.avatar_url || ''),
          iFollow,
          followsMe,
        };
      });
  } catch (err: any) {
    console.error('Error calling follow_list:', err);
    throw err instanceof Error ? err : new Error('Could not load list.');
  }
}

/**
 * Remove a follower from the current user's followers via supabase.rpc('remove_follower', { p_user }).
 */
export async function removeFollower(followerUserId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }
  if (!followerUserId) {
    throw new Error('Invalid user.');
  }

  try {
    const { error } = await supabase.rpc('remove_follower', {
      p_user: followerUserId,
    });

    if (error) {
      throw new Error(error.message || 'Could not remove follower.');
    }
  } catch (err: any) {
    console.error('Error calling remove_follower:', err);
    throw err instanceof Error ? err : new Error('Could not remove follower.');
  }
}

/**
 * Fetch mutual relationship between current user and target user via supabase.rpc('relationship', { p_user }).
 */
export async function fetchRelationship(
  targetUserId: string
): Promise<UserRelationship> {
  if (!isSupabaseConfigured || !targetUserId) {
    return { iFollow: false, followsMe: false, isBlocked: false };
  }

  try {
    const { data, error } = await supabase.rpc('relationship', {
      p_user: targetUserId,
    });

    if (error) {
      throw new Error(error.message || 'Could not load relationship.');
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') {
      return { iFollow: false, followsMe: false, isBlocked: false };
    }

    return {
      iFollow: Boolean(row.i_follow ?? row.is_following),
      followsMe: Boolean(row.follows_me ?? row.is_follower),
      isBlocked: Boolean(row.is_blocked ?? row.blocked_by_me ?? row.blocked),
    };
  } catch (err: any) {
    console.error('Error calling relationship:', err);
    throw err instanceof Error ? err : new Error('Could not load relationship.');
  }
}

/**
 * Block a user via supabase.rpc('block_user', { p_user }).
 */
export async function blockUser(targetUserId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }
  if (!targetUserId) {
    throw new Error('Invalid user.');
  }

  try {
    const { error } = await supabase.rpc('block_user', {
      p_user: targetUserId,
    });

    if (error) {
      throw new Error(error.message || 'Could not block user.');
    }
  } catch (err: any) {
    console.error('Error calling block_user:', err);
    throw err instanceof Error ? err : new Error('Could not block user.');
  }
}

/**
 * Report a user by inserting into reports with reported_user.
 */
export async function reportUser(params: {
  reportedUserId: string;
  reporterId: string;
  reason: string;
}): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }
  const { reportedUserId, reporterId, reason } = params;
  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw new Error('Please choose a reason for reporting.');
  }

  try {
    const { error } = await supabase.from('reports').insert([
      {
        reported_user: reportedUserId,
        reporter_id: reporterId,
        reason: cleanReason,
      },
    ]);

    if (error) {
      throw new Error(error.message || 'Could not submit report.');
    }
  } catch (err: any) {
    console.error('Error reporting user:', err);
    throw err instanceof Error ? err : new Error('Could not submit report.');
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
