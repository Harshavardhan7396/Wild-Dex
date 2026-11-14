import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type CommunityTab = 'circle' | 'nearby' | 'everyone';
export type PostVisibility = 'public' | 'followers';

export interface PublicAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface CommunityPost {
  id: string;
  userId: string;
  collectionItemId: string | null;
  speciesName: string;
  scientificName: string;
  caption: string;
  placeLabel: string;
  photoPath: string;
  photoUrl: string;
  visibility: PostVisibility;
  createdAt: string;
  author: PublicAuthor;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
  author: PublicAuthor;
}

export interface StoryCircle {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  latestPostId: string;
  latestPhotoUrl: string;
  latestSpeciesName: string;
  latestCaption: string;
  latestPlaceLabel: string;
  latestCreatedAt: string;
}

export interface AreaInfo {
  primaryLabel: string;
  tokens: string[];
}

export const COMMUNITY_PAGE_SIZE = 10;

const areaCache = new Map<string, AreaInfo>();

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please check your environment variables.');
  }
}

function isRelationshipMissingError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === 'PGRST200' ||
    msg.includes('could not find a relationship') ||
    msg.includes('schema cache')
  );
}

function normalizeAuthor(rawProfile: any, fallbackId: string): PublicAuthor {
  const profileObj = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
  const username =
    (typeof profileObj?.username === 'string' && profileObj.username.trim()) ||
    (typeof profileObj?.display_name === 'string' && profileObj.display_name.trim()) ||
    'Explorer';
  const displayName =
    (typeof profileObj?.display_name === 'string' && profileObj.display_name.trim()) ||
    username;
  const avatarUrl = typeof profileObj?.avatar_url === 'string' ? profileObj.avatar_url : '';

  return {
    id: profileObj?.id || fallbackId,
    username,
    displayName,
    avatarUrl,
  };
}

export function resolvePostPhotoUrl(photoPath: string): string {
  if (!photoPath) return '';
  if (
    photoPath.startsWith('http://') ||
    photoPath.startsWith('https://') ||
    photoPath.startsWith('data:')
  ) {
    return photoPath;
  }
  const { data } = supabase.storage.from('posts').getPublicUrl(photoPath);
  return data?.publicUrl || '';
}

export function formatRelativeTime(isoDate: string): string {
  if (!isoDate) return 'Just now';
  const dateMs = new Date(isoDate).getTime();
  if (Number.isNaN(dateMs)) return 'Just now';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - dateMs) / 1000));
  if (diffSeconds < 45) return 'Just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;

  return new Date(dateMs).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function containsExactCoordinates(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Detect GPS decimal coordinates like 45.5152, -122.6784 or DMS coordinates
  const decimalCoords = /-?\d{1,3}\.\d{3,}[\s,;/]+-?\d{1,3}\.\d{3,}/;
  const dmsCoords = /\d{1,3}°\s*\d{1,2}['′]/;
  return decimalCoords.test(trimmed) || dmsCoords.test(trimmed);
}

export async function resolveAreaInfo(lat: number, lng: number): Promise<AreaInfo> {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;
  const key = `${roundedLat.toFixed(2)},${roundedLng.toFixed(2)}`;

  const cached = areaCache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${roundedLat}&lon=${roundedLng}&zoom=10`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) {
      throw new Error(`Nominatim reverse error: ${res.status}`);
    }
    const json = await res.json();
    const addr = (json?.address || {}) as Record<string, string | undefined>;
    const locality =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.county ||
      '';
    const region = addr.state || addr.region || addr.province || '';
    const country = addr.country || '';

    const rawTokens = [locality, region, addr.county, country]
      .map((t) => (t ? t.trim() : ''))
      .filter((t) => t.length >= 2);
    const tokens = Array.from(new Set(rawTokens));

    const primaryLabel =
      locality && region
        ? `${locality}, ${region}`
        : locality || region || country || '';

    const info: AreaInfo = { primaryLabel, tokens };
    areaCache.set(key, info);
    return info;
  } catch (err) {
    console.warn('Could not reverse-geocode rounded home area:', err);
    const fallback: AreaInfo = { primaryLabel: '', tokens: [] };
    areaCache.set(key, fallback);
    return fallback;
  }
}

async function fetchPublicProfilesMap(userIds: string[]): Promise<Map<string, PublicAuthor>> {
  const map = new Map<string, PublicAuthor>();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return map;

  try {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', uniqueIds);

    if (error) {
      console.warn('public_profiles query warning:', error);
      return map;
    }

    for (const row of data || []) {
      const normalized = normalizeAuthor(row, row.id);
      map.set(row.id, normalized);
    }
  } catch (err) {
    console.warn('Error fetching public_profiles:', err);
  }
  return map;
}

function loadHtmlImage(src: string, crossOrigin?: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image element.'));
    img.src = src;
  });
}

export async function compressPostImageTo1280Jpeg(source: File | string): Promise<Blob> {
  const maxDimension = 1280;
  let objectUrlToRevoke: string | null = null;

  try {
    let img: HTMLImageElement;
    if (source instanceof File) {
      objectUrlToRevoke = URL.createObjectURL(source);
      img = await loadHtmlImage(objectUrlToRevoke);
    } else if (typeof source === 'string' && source.trim()) {
      try {
        img = await loadHtmlImage(source, source.startsWith('data:') ? undefined : 'anonymous');
      } catch {
        // Fallback: fetch as blob and create local object URL
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Could not load photo (${response.status}).`);
        }
        const rawBlob = await response.blob();
        objectUrlToRevoke = URL.createObjectURL(rawBlob);
        img = await loadHtmlImage(objectUrlToRevoke);
      }
    } else {
      throw new Error('Please choose a photo before posting.');
    }

    let { width, height } = img;
    if (!width || !height) {
      throw new Error('Selected photo has invalid dimensions.');
    }

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.max(1, Math.round((height * maxDimension) / width));
        width = maxDimension;
      } else {
        width = Math.max(1, Math.round((width * maxDimension) / height));
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is not available.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to encode compressed JPEG.'));
        },
        'image/jpeg',
        0.82
      );
    });

    return jpegBlob;
  } finally {
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }
}

export async function uploadPostPhoto(userId: string, source: File | string): Promise<{ photoPath: string; photoUrl: string }> {
  ensureSupabaseConfigured();
  try {
    const compressedBlob = await compressPostImageTo1280Jpeg(source);
    const photoPath = `${userId}/${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from('posts')
      .upload(photoPath, compressedBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      throw new Error(error.message || 'Could not upload photo to storage.');
    }

    return {
      photoPath,
      photoUrl: resolvePostPhotoUrl(photoPath),
    };
  } catch (err: any) {
    console.error('Error uploading post photo:', err);
    throw new Error(err?.message || 'Could not upload photo.');
  }
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  ensureSupabaseConfigured();
  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (error) {
      throw new Error(error.message || 'Could not load followed users.');
    }

    return (data || []).map((row: any) => row.following_id).filter(Boolean);
  } catch (err: any) {
    console.error('Error fetching following ids:', err);
    throw new Error(err?.message || 'Could not load followed users.');
  }
}

export async function toggleFollowUser(params: {
  followerId: string;
  followingId: string;
  currentlyFollowing: boolean;
}): Promise<boolean> {
  ensureSupabaseConfigured();
  const { followerId, followingId, currentlyFollowing } = params;
  if (followerId === followingId) return false;

  try {
    if (currentlyFollowing) {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);

      if (error) throw new Error(error.message || 'Could not unfollow user.');
      return false;
    } else {
      const { error } = await supabase
        .from('user_follows')
        .insert([{ follower_id: followerId, following_id: followingId }]);

      if (error) throw new Error(error.message || 'Could not follow user.');
      return true;
    }
  } catch (err: any) {
    console.error('Error toggling follow:', err);
    throw new Error(err?.message || 'Could not update follow status.');
  }
}

async function hydratePosts(rawRows: any[], currentUserId: string): Promise<CommunityPost[]> {
  if (!rawRows || rawRows.length === 0) return [];

  const postIds = rawRows.map((r) => r.id).filter(Boolean);
  const missingProfileUserIds: string[] = [];

  for (const row of rawRows) {
    if (!row.public_profiles && row.user_id) {
      missingProfileUserIds.push(row.user_id);
    }
  }

  const [fallbackProfiles, likesRes, commentsRes] = await Promise.all([
    missingProfileUserIds.length > 0
      ? fetchPublicProfilesMap(missingProfileUserIds)
      : Promise.resolve(new Map<string, PublicAuthor>()),
    supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
    supabase.from('post_comments').select('post_id').in('post_id', postIds),
  ]);

  if (likesRes.error) {
    console.warn('Error loading post_likes:', likesRes.error);
  }
  if (commentsRes.error) {
    console.warn('Error loading post_comments counts:', commentsRes.error);
  }

  const likesCountMap = new Map<string, number>();
  const likedByMeSet = new Set<string>();
  for (const like of likesRes.data || []) {
    likesCountMap.set(like.post_id, (likesCountMap.get(like.post_id) || 0) + 1);
    if (like.user_id === currentUserId) {
      likedByMeSet.add(like.post_id);
    }
  }

  const commentsCountMap = new Map<string, number>();
  for (const comment of commentsRes.data || []) {
    commentsCountMap.set(comment.post_id, (commentsCountMap.get(comment.post_id) || 0) + 1);
  }

  return rawRows.map((row) => {
    const joinedProfile = row.public_profiles || fallbackProfiles.get(row.user_id);
    const author = normalizeAuthor(joinedProfile, row.user_id);
    const photoPath = row.photo_path || '';

    return {
      id: row.id,
      userId: row.user_id,
      collectionItemId: row.collection_item_id || null,
      speciesName: row.species_name || 'Nature Discovery',
      scientificName: row.scientific_name || '',
      caption: row.caption || '',
      placeLabel: row.place_label || '',
      photoPath,
      photoUrl: resolvePostPhotoUrl(photoPath),
      visibility: row.visibility === 'followers' ? 'followers' : 'public',
      createdAt: row.created_at,
      author,
      likesCount: likesCountMap.get(row.id) || 0,
      commentsCount: commentsCountMap.get(row.id) || 0,
      isLiked: likedByMeSet.has(row.id),
    };
  });
}

function applyCommunityFilters(
  query: any,
  tab: CommunityTab,
  userId: string,
  followingIds: string[],
  areaTokens: string[]
) {
  if (tab === 'circle') {
    const circleIds = Array.from(new Set([userId, ...followingIds]));
    return query.in('user_id', circleIds);
  }

  if (tab === 'nearby') {
    const cleanTokens = areaTokens
      .map((t) => t.replace(/[%_,()"]/g, '').trim())
      .filter((t) => t.length >= 2);

    const publicQuery = query.eq('visibility', 'public');
    if (cleanTokens.length === 0) {
      return publicQuery;
    }
    const orExpr = cleanTokens.map((t) => `place_label.ilike.%${t}%`).join(',');
    return publicQuery.or(orExpr);
  }

  // 'everyone'
  return query.eq('visibility', 'public');
}

export async function fetchCommunityPosts(params: {
  tab: CommunityTab;
  userId: string;
  followingIds: string[];
  areaTokens: string[];
  page: number;
  pageSize?: number;
}): Promise<{ posts: CommunityPost[]; hasMore: boolean }> {
  ensureSupabaseConfigured();
  const {
    tab,
    userId,
    followingIds,
    areaTokens,
    page,
    pageSize = COMMUNITY_PAGE_SIZE,
  } = params;

  if (tab === 'nearby' && areaTokens.length === 0) {
    return { posts: [], hasMore: false };
  }

  const from = page * pageSize;
  const to = from + pageSize; // fetch 1 extra item to check hasMore

  try {
    let query = supabase
      .from('community_posts')
      .select('*, public_profiles(id, username, display_name, avatar_url)')
      .order('created_at', { ascending: false })
      .range(from, to);

    query = applyCommunityFilters(query, tab, userId, followingIds, areaTokens);

    let { data, error } = await query;

    if (error && isRelationshipMissingError(error)) {
      let fallbackQuery = supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      fallbackQuery = applyCommunityFilters(
        fallbackQuery,
        tab,
        userId,
        followingIds,
        areaTokens
      );
      const fallbackRes = await fallbackQuery;
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      throw new Error(error.message || 'Failed to load community posts.');
    }

    const rows = data || [];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const posts = await hydratePosts(pageRows, userId);

    return { posts, hasMore };
  } catch (err: any) {
    console.error('Error fetching community posts:', err);
    throw new Error(err?.message || 'Failed to load community posts.');
  }
}

export async function fetchFollowedStories24h(followingIds: string[]): Promise<StoryCircle[]> {
  ensureSupabaseConfigured();
  if (!followingIds || followingIds.length === 0) {
    return [];
  }

  try {
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let { data, error } = await supabase
      .from('community_posts')
      .select('*, public_profiles(id, username, display_name, avatar_url)')
      .in('user_id', followingIds)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error && isRelationshipMissingError(error)) {
      const fallbackRes = await supabase
        .from('community_posts')
        .select('*')
        .in('user_id', followingIds)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(50);
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      throw new Error(error.message || 'Could not load recent stories.');
    }

    const rows = data || [];
    if (rows.length === 0) return [];

    const missingIds = rows
      .filter((r: any) => !r.public_profiles && r.user_id)
      .map((r: any) => r.user_id);
    const fallbackProfiles =
      missingIds.length > 0
        ? await fetchPublicProfilesMap(missingIds)
        : new Map<string, PublicAuthor>();

    const seenUsers = new Set<string>();
    const stories: StoryCircle[] = [];

    for (const row of rows) {
      if (!row.user_id || seenUsers.has(row.user_id)) continue;
      seenUsers.add(row.user_id);

      const author = normalizeAuthor(
        row.public_profiles || fallbackProfiles.get(row.user_id),
        row.user_id
      );

      stories.push({
        userId: row.user_id,
        username: author.username,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
        latestPostId: row.id,
        latestPhotoUrl: resolvePostPhotoUrl(row.photo_path || ''),
        latestSpeciesName: row.species_name || 'Discovery',
        latestCaption: row.caption || '',
        latestPlaceLabel: row.place_label || '',
        latestCreatedAt: row.created_at,
      });
    }

    return stories;
  } catch (err: any) {
    console.error('Error fetching 24h stories:', err);
    return [];
  }
}

export async function createCommunityPost(params: {
  userId: string;
  collectionItemId?: string | null;
  speciesName: string;
  scientificName?: string;
  caption: string;
  placeLabel: string;
  photoSource: File | string;
  visibility: PostVisibility;
}): Promise<CommunityPost> {
  ensureSupabaseConfigured();
  const {
    userId,
    collectionItemId = null,
    speciesName,
    scientificName = '',
    caption,
    placeLabel,
    photoSource,
    visibility,
  } = params;

  const cleanCaption = caption.trim();
  const cleanSpecies = speciesName.trim();
  const cleanPlace = placeLabel.trim();

  if (!cleanSpecies) {
    throw new Error('Please enter a species or animal name.');
  }
  if (cleanCaption.length > 500) {
    throw new Error('Caption must be 500 characters or fewer.');
  }
  if (containsExactCoordinates(cleanPlace)) {
    throw new Error('Please enter a general place name (like a city or park), never exact coordinates.');
  }

  try {
    const { photoPath } = await uploadPostPhoto(userId, photoSource);

    const insertRow = {
      user_id: userId,
      collection_item_id: collectionItemId,
      species_name: cleanSpecies,
      scientific_name: scientificName.trim(),
      caption: cleanCaption,
      place_label: cleanPlace,
      photo_path: photoPath,
      visibility,
    };

    const { data, error } = await supabase
      .from('community_posts')
      .insert([insertRow])
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to publish post.');
    }

    const hydrated = await hydratePosts([data], userId);
    return hydrated[0];
  } catch (err: any) {
    console.error('Error creating community post:', err);
    throw new Error(err?.message || 'Could not publish your post.');
  }
}

export async function deleteCommunityPost(params: {
  userId: string;
  postId: string;
  photoPath?: string;
}): Promise<void> {
  ensureSupabaseConfigured();
  const { userId, postId, photoPath } = params;

  try {
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message || 'Could not delete post.');
    }

    if (
      photoPath &&
      !photoPath.startsWith('http://') &&
      !photoPath.startsWith('https://') &&
      !photoPath.startsWith('data:')
    ) {
      try {
        await supabase.storage.from('posts').remove([photoPath]);
      } catch (storageErr) {
        console.warn('Could not clean up post photo:', storageErr);
      }
    }
  } catch (err: any) {
    console.error('Error deleting community post:', err);
    throw new Error(err?.message || 'Could not delete post.');
  }
}

export async function togglePostLike(params: {
  postId: string;
  userId: string;
  currentlyLiked: boolean;
}): Promise<boolean> {
  ensureSupabaseConfigured();
  const { postId, userId, currentlyLiked } = params;

  try {
    if (currentlyLiked) {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) throw new Error(error.message || 'Could not remove like.');
      return false;
    } else {
      const { error } = await supabase
        .from('post_likes')
        .insert([{ post_id: postId, user_id: userId }]);

      if (error) throw new Error(error.message || 'Could not like post.');
      return true;
    }
  } catch (err: any) {
    console.error('Error toggling post like:', err);
    throw new Error(err?.message || 'Could not update like.');
  }
}

export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  ensureSupabaseConfigured();
  try {
    let { data, error } = await supabase
      .from('post_comments')
      .select('*, public_profiles(id, username, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error && isRelationshipMissingError(error)) {
      const fallbackRes = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      throw new Error(error.message || 'Could not load comments.');
    }

    const rows = data || [];
    const missingUserIds = rows
      .filter((r: any) => !r.public_profiles && r.user_id)
      .map((r: any) => r.user_id);
    const fallbackProfiles =
      missingUserIds.length > 0
        ? await fetchPublicProfilesMap(missingUserIds)
        : new Map<string, PublicAuthor>();

    return rows.map((row: any) => ({
      id: row.id,
      postId: row.post_id,
      userId: row.user_id,
      body: row.body,
      createdAt: row.created_at,
      author: normalizeAuthor(
        row.public_profiles || fallbackProfiles.get(row.user_id),
        row.user_id
      ),
    }));
  } catch (err: any) {
    console.error('Error fetching comments:', err);
    throw new Error(err?.message || 'Could not load comments.');
  }
}

export async function addPostComment(params: {
  postId: string;
  userId: string;
  body: string;
  fallbackAuthor?: PublicAuthor;
}): Promise<PostComment> {
  ensureSupabaseConfigured();
  const { postId, userId, body, fallbackAuthor } = params;
  const cleanBody = body.trim();
  if (!cleanBody) {
    throw new Error('Please write a comment before sending.');
  }
  if (cleanBody.length > 500) {
    throw new Error('Comment must be 500 characters or fewer.');
  }

  try {
    const { data, error } = await supabase
      .from('post_comments')
      .insert([{ post_id: postId, user_id: userId, body: cleanBody }])
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not post comment.');
    }

    const profilesMap = await fetchPublicProfilesMap([userId]);
    const author =
      profilesMap.get(userId) ||
      fallbackAuthor || {
        id: userId,
        username: 'Explorer',
        displayName: 'Explorer',
        avatarUrl: '',
      };

    return {
      id: data.id,
      postId: data.post_id,
      userId: data.user_id,
      body: data.body,
      createdAt: data.created_at,
      author,
    };
  } catch (err: any) {
    console.error('Error adding comment:', err);
    throw new Error(err?.message || 'Could not post comment.');
  }
}

export async function deletePostComment(params: {
  commentId: string;
  userId: string;
}): Promise<void> {
  ensureSupabaseConfigured();
  const { commentId, userId } = params;
  try {
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message || 'Could not delete comment.');
    }
  } catch (err: any) {
    console.error('Error deleting comment:', err);
    throw new Error(err?.message || 'Could not delete comment.');
  }
}

export async function reportCommunityPost(params: {
  postId: string;
  reporterId: string;
  reason: string;
}): Promise<void> {
  ensureSupabaseConfigured();
  const { postId, reporterId, reason } = params;
  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw new Error('Please choose a reason for reporting.');
  }

  try {
    const { error } = await supabase.from('reports').insert([
      {
        post_id: postId,
        reporter_id: reporterId,
        reason: cleanReason,
      },
    ]);

    if (error) {
      throw new Error(error.message || 'Could not submit report.');
    }
  } catch (err: any) {
    console.error('Error submitting report:', err);
    throw new Error(err?.message || 'Could not submit report.');
  }
}
