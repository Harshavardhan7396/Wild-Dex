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

type AuthorColumn = 'user_id' | 'author_id' | 'owner_id' | 'creator_id';
const AUTHOR_COL_CANDIDATES: AuthorColumn[] = [
  'user_id',
  'author_id',
  'owner_id',
  'creator_id',
];

let cachedPostAuthorCol: AuthorColumn | null = null;
let cachedCommentAuthorCol: AuthorColumn | null = null;

function isMissingColumnError(error: any, colName?: string): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  const isColErr =
    code === '42703' ||
    code === 'PGRST204' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the');
  if (!isColErr) return false;
  if (!colName) return true;
  return msg.includes(colName.toLowerCase());
}

function extractMissingColumnName(error: any): string | null {
  const msg = String(error?.message || '');
  const pgrstMatch = msg.match(/['"]([a-zA-Z0-9_]+)['"]\s+column/i);
  if (pgrstMatch?.[1]) return pgrstMatch[1];
  const pgMatch = msg.match(/column\s+(?:[a-zA-Z0-9_]+\.)?["']?([a-zA-Z0-9_]+)["']?\s+does not exist/i);
  if (pgMatch?.[1]) return pgMatch[1];
  const relMatch = msg.match(/column\s+["']?([a-zA-Z0-9_]+)["']?\s+of relation/i);
  if (relMatch?.[1]) return relMatch[1];
  return null;
}

function extractAuthorId(row: any): string {
  return (
    row?.user_id ||
    row?.author_id ||
    row?.owner_id ||
    row?.creator_id ||
    ''
  );
}

async function detectTableAuthorColumn(
  table: 'community_posts' | 'post_comments',
  forceReprobe = false
): Promise<AuthorColumn> {
  const current = table === 'community_posts' ? cachedPostAuthorCol : cachedCommentAuthorCol;
  if (current && !forceReprobe) {
    return current;
  }

  for (const col of AUTHOR_COL_CANDIDATES) {
    const { error } = await supabase.from(table).select(col).limit(1);
    if (!error) {
      if (table === 'community_posts') cachedPostAuthorCol = col;
      else cachedCommentAuthorCol = col;
      return col;
    }
    if (!isMissingColumnError(error, col)) {
      break;
    }
  }

  const fallback: AuthorColumn = 'user_id';
  if (table === 'community_posts') cachedPostAuthorCol = fallback;
  else cachedCommentAuthorCol = fallback;
  return fallback;
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

export async function resolveAreaInfo(_lat: number, _lng: number): Promise<AreaInfo> {
  return { primaryLabel: '', tokens: [] };
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

type FollowTable = 'user_follows' | 'follows';
const FOLLOW_TABLE_CANDIDATES: FollowTable[] = ['user_follows', 'follows'];
const FOLLOWER_COL_CANDIDATES = ['follower_id', 'user_id'] as const;
const FOLLOWING_COL_CANDIDATES = [
  'following_id',
  'followed_id',
  'following_user_id',
  'target_id',
  'followee_id',
] as const;

interface FollowConfig {
  table: FollowTable;
  followerCol: string;
  followingCol: string;
}

let cachedFollowConfig: FollowConfig | null = null;

function isMissingRelationOrColumnError(error: any): boolean {
  if (!error) return false;
  if (isMissingColumnError(error)) return true;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

async function detectFollowConfig(forceReprobe = false): Promise<FollowConfig> {
  if (cachedFollowConfig && !forceReprobe) {
    return cachedFollowConfig;
  }

  for (const table of FOLLOW_TABLE_CANDIDATES) {
    for (const followerCol of FOLLOWER_COL_CANDIDATES) {
      for (const followingCol of FOLLOWING_COL_CANDIDATES) {
        const { error } = await supabase
          .from(table)
          .select(`${followerCol}, ${followingCol}`)
          .limit(1);

        if (!error) {
          cachedFollowConfig = { table, followerCol, followingCol };
          return cachedFollowConfig;
        }

        const msg = String(error.message || '').toLowerCase();
        const code = String(error.code || '');
        if (code === '42P01' || code === 'PGRST205' || msg.includes(table)) {
          // Table itself doesn't exist, skip remaining column checks for this table
          break;
        }
        if (!isMissingColumnError(error)) {
          // Non-schema error (e.g. RLS/network) — abort probing
          cachedFollowConfig = {
            table: 'user_follows',
            followerCol: 'follower_id',
            followingCol: 'following_id',
          };
          return cachedFollowConfig;
        }
      }
    }
  }

  cachedFollowConfig = {
    table: 'user_follows',
    followerCol: 'follower_id',
    followingCol: 'following_id',
  };
  return cachedFollowConfig;
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  ensureSupabaseConfigured();
  try {
    const activeConfig: FollowConfig = cachedFollowConfig || {
      table: 'user_follows',
      followerCol: 'follower_id',
      followingCol: 'following_id',
    };

    let { data, error } = await supabase
      .from(activeConfig.table)
      .select(activeConfig.followingCol)
      .eq(activeConfig.followerCol, userId);

    let usedConfig = activeConfig;

    if (error && isMissingRelationOrColumnError(error)) {
      const detected = await detectFollowConfig(true);
      if (
        detected.table !== activeConfig.table ||
        detected.followerCol !== activeConfig.followerCol ||
        detected.followingCol !== activeConfig.followingCol
      ) {
        const retryRes = await supabase
          .from(detected.table)
          .select(detected.followingCol)
          .eq(detected.followerCol, userId);
        data = retryRes.data;
        error = retryRes.error;
        usedConfig = detected;
      }
    }

    if (error) {
      if (isMissingRelationOrColumnError(error)) {
        console.warn('Follow table/column unavailable, defaulting to empty following list:', error.message);
        return [];
      }
      throw new Error(error.message || 'Could not load followed users.');
    }

    return (data || [])
      .map((row: any) => row?.[usedConfig.followingCol] || row?.following_id || row?.followed_id)
      .filter(Boolean);
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

  const runToggle = async (cfg: FollowConfig) => {
    if (currentlyFollowing) {
      return supabase
        .from(cfg.table)
        .delete()
        .eq(cfg.followerCol, followerId)
        .eq(cfg.followingCol, followingId);
    }
    return supabase
      .from(cfg.table)
      .insert([{ [cfg.followerCol]: followerId, [cfg.followingCol]: followingId }]);
  };

  try {
    const activeConfig: FollowConfig = cachedFollowConfig || {
      table: 'user_follows',
      followerCol: 'follower_id',
      followingCol: 'following_id',
    };

    let { error } = await runToggle(activeConfig);

    if (error && isMissingRelationOrColumnError(error)) {
      const detected = await detectFollowConfig(true);
      if (
        detected.table !== activeConfig.table ||
        detected.followerCol !== activeConfig.followerCol ||
        detected.followingCol !== activeConfig.followingCol
      ) {
        const retryRes = await runToggle(detected);
        error = retryRes.error;
      }
    }

    if (error) {
      throw new Error(
        error.message || (currentlyFollowing ? 'Could not unfollow user.' : 'Could not follow user.')
      );
    }

    return !currentlyFollowing;
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
    const postAuthorId = extractAuthorId(row);
    if (!row.public_profiles && postAuthorId) {
      missingProfileUserIds.push(postAuthorId);
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
    const postAuthorId = extractAuthorId(row);
    const joinedProfile = row.public_profiles || fallbackProfiles.get(postAuthorId);
    const author = normalizeAuthor(joinedProfile, postAuthorId);
    const photoPath = row.photo_path || row.photo_url || '';

    return {
      id: row.id,
      userId: postAuthorId,
      collectionItemId: row.collection_item_id || null,
      speciesName: row.species_name || row.species || 'Nature Discovery',
      scientificName: row.scientific_name || '',
      caption: row.caption || '',
      placeLabel: row.place_label || row.location_label || row.location || '',
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
  areaTokens: string[],
  authorCol: AuthorColumn,
  options?: { skipVisibility?: boolean; skipPlaceLabel?: boolean }
) {
  if (tab === 'circle') {
    const circleIds = Array.from(new Set([userId, ...followingIds]));
    return query.in(authorCol, circleIds);
  }

  if (tab === 'nearby') {
    const cleanTokens = areaTokens
      .map((t) => t.replace(/[%_,()"]/g, '').trim())
      .filter((t) => t.length >= 2);

    const publicQuery = options?.skipVisibility ? query : query.eq('visibility', 'public');
    if (cleanTokens.length === 0 || options?.skipPlaceLabel) {
      return publicQuery;
    }
    const orExpr = cleanTokens.map((t) => `place_label.ilike.%${t}%`).join(',');
    return publicQuery.or(orExpr);
  }

  // 'everyone'
  return options?.skipVisibility ? query : query.eq('visibility', 'public');
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

  const runPostsQuery = async (
    authorCol: AuthorColumn,
    options?: { skipVisibility?: boolean; skipPlaceLabel?: boolean }
  ) => {
    let query = supabase
      .from('community_posts')
      .select('*, public_profiles(id, username, display_name, avatar_url)')
      .order('created_at', { ascending: false })
      .range(from, to);

    query = applyCommunityFilters(query, tab, userId, followingIds, areaTokens, authorCol, options);

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
        areaTokens,
        authorCol,
        options
      );
      const fallbackRes = await fallbackQuery;
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    return { data, error };
  };

  try {
    let activeCol: AuthorColumn = cachedPostAuthorCol || 'user_id';
    const filterOpts = { skipVisibility: false, skipPlaceLabel: false };
    let { data, error } = await runPostsQuery(activeCol, filterOpts);

    for (let attempt = 0; attempt < 3 && error && isMissingColumnError(error); attempt++) {
      const missingCol = extractMissingColumnName(error);
      if (missingCol === 'visibility' && !filterOpts.skipVisibility) {
        filterOpts.skipVisibility = true;
      } else if (missingCol === 'place_label' && !filterOpts.skipPlaceLabel) {
        filterOpts.skipPlaceLabel = true;
      } else {
        const detectedCol = await detectTableAuthorColumn('community_posts', true);
        if (detectedCol !== activeCol) {
          activeCol = detectedCol;
        } else {
          break;
        }
      }
      const retryRes = await runPostsQuery(activeCol, filterOpts);
      data = retryRes.data;
      error = retryRes.error;
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

  const runStoriesQuery = async (authorCol: AuthorColumn, sinceIso: string) => {
    let { data, error } = await supabase
      .from('community_posts')
      .select('*, public_profiles(id, username, display_name, avatar_url)')
      .in(authorCol, followingIds)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error && isRelationshipMissingError(error)) {
      const fallbackRes = await supabase
        .from('community_posts')
        .select('*')
        .in(authorCol, followingIds)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(50);
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    return { data, error };
  };

  try {
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const initialCol = cachedPostAuthorCol || 'user_id';
    let { data, error } = await runStoriesQuery(initialCol, sinceIso);

    if (error && isMissingColumnError(error)) {
      const detectedCol = await detectTableAuthorColumn('community_posts', true);
      if (detectedCol !== initialCol) {
        const retryRes = await runStoriesQuery(detectedCol, sinceIso);
        data = retryRes.data;
        error = retryRes.error;
      }
    }

    if (error) {
      throw new Error(error.message || 'Could not load recent stories.');
    }

    const rows = data || [];
    if (rows.length === 0) return [];

    const missingIds = rows
      .filter((r: any) => !r.public_profiles && extractAuthorId(r))
      .map((r: any) => extractAuthorId(r));
    const fallbackProfiles =
      missingIds.length > 0
        ? await fetchPublicProfilesMap(missingIds)
        : new Map<string, PublicAuthor>();

    const seenUsers = new Set<string>();
    const stories: StoryCircle[] = [];

    for (const row of rows) {
      const postAuthorId = extractAuthorId(row);
      if (!postAuthorId || seenUsers.has(postAuthorId)) continue;
      seenUsers.add(postAuthorId);

      const author = normalizeAuthor(
        row.public_profiles || fallbackProfiles.get(postAuthorId),
        postAuthorId
      );

      stories.push({
        userId: postAuthorId,
        username: author.username,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
        latestPostId: row.id,
        latestPhotoUrl: resolvePostPhotoUrl(row.photo_path || row.photo_url || ''),
        latestSpeciesName: row.species_name || row.species || 'Discovery',
        latestCaption: row.caption || '',
        latestPlaceLabel: row.place_label || row.location_label || row.location || '',
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
    const { photoPath, photoUrl } = await uploadPostPhoto(userId, photoSource);

    let activeAuthorCol: AuthorColumn = cachedPostAuthorCol || 'user_id';
    const insertPayload: Record<string, any> = {
      [activeAuthorCol]: userId,
      collection_item_id: collectionItemId,
      species_name: cleanSpecies,
      scientific_name: scientificName.trim(),
      caption: cleanCaption,
      place_label: cleanPlace,
      photo_path: photoPath,
      visibility,
    };

    const strippedCols = new Set<string>();
    let data: any = null;
    let error: any = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await supabase
        .from('community_posts')
        .insert([insertPayload])
        .select('*')
        .single();

      data = res.data;
      error = res.error;

      if (!error) break;

      if (isMissingColumnError(error)) {
        const missingCol = extractMissingColumnName(error);

        if (missingCol === activeAuthorCol) {
          delete insertPayload[activeAuthorCol];
          strippedCols.add(activeAuthorCol);
          const detectedCol = await detectTableAuthorColumn('community_posts', true);
          activeAuthorCol = detectedCol;
          if (!strippedCols.has(detectedCol)) {
            insertPayload[detectedCol] = userId;
            continue;
          }
        }

        if (missingCol === 'photo_path') {
          delete insertPayload.photo_path;
          strippedCols.add('photo_path');
          if (!strippedCols.has('photo_url')) {
            insertPayload.photo_url = photoUrl || photoPath;
            continue;
          }
        }

        if (missingCol === 'place_label') {
          delete insertPayload.place_label;
          strippedCols.add('place_label');
          if (!strippedCols.has('location')) {
            insertPayload.location = cleanPlace;
            continue;
          }
        }

        if (missingCol && missingCol in insertPayload) {
          delete insertPayload[missingCol];
          strippedCols.add(missingCol);
          continue;
        }
      }

      // Handle pre-existing tables with alternate NOT NULL columns (e.g. author_id or photo_url)
      if (String(error.code || '') === '23502') {
        const msgLower = String(error.message || '').toLowerCase();
        const extraAuthorCol = AUTHOR_COL_CANDIDATES.find(
          (c) => msgLower.includes(c) && !(c in insertPayload)
        );
        if (extraAuthorCol) {
          insertPayload[extraAuthorCol] = userId;
          continue;
        }
        if (msgLower.includes('photo_url') && !('photo_url' in insertPayload)) {
          insertPayload.photo_url = photoUrl || photoPath;
          continue;
        }
      }

      break;
    }

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
    const initialCol = cachedPostAuthorCol || 'user_id';
    let { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq(initialCol, userId);

    if (error && isMissingColumnError(error)) {
      const detectedCol = await detectTableAuthorColumn('community_posts', true);
      if (detectedCol !== initialCol) {
        const retryRes = await supabase
          .from('community_posts')
          .delete()
          .eq('id', postId)
          .eq(detectedCol, userId);
        error = retryRes.error;
      }
    }

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
      .filter((r: any) => !r.public_profiles && extractAuthorId(r))
      .map((r: any) => extractAuthorId(r));
    const fallbackProfiles =
      missingUserIds.length > 0
        ? await fetchPublicProfilesMap(missingUserIds)
        : new Map<string, PublicAuthor>();

    return rows.map((row: any) => {
      const commentAuthorId = extractAuthorId(row);
      return {
        id: row.id,
        postId: row.post_id,
        userId: commentAuthorId,
        body: row.body,
        createdAt: row.created_at,
        author: normalizeAuthor(
          row.public_profiles || fallbackProfiles.get(commentAuthorId),
          commentAuthorId
        ),
      };
    });
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
    const initialCol = cachedCommentAuthorCol || 'user_id';
    let { data, error } = await supabase
      .from('post_comments')
      .insert([{ post_id: postId, [initialCol]: userId, body: cleanBody }])
      .select('*')
      .single();

    if (error && isMissingColumnError(error)) {
      const detectedCol = await detectTableAuthorColumn('post_comments', true);
      if (detectedCol !== initialCol) {
        const retryRes = await supabase
          .from('post_comments')
          .insert([{ post_id: postId, [detectedCol]: userId, body: cleanBody }])
          .select('*')
          .single();
        data = retryRes.data;
        error = retryRes.error;
      }
    }

    if (error || !data) {
      throw new Error(error?.message || 'Could not post comment.');
    }

    const profilesMap = await fetchPublicProfilesMap([userId]);
    const commentAuthorId = extractAuthorId(data) || userId;
    const author =
      profilesMap.get(commentAuthorId) ||
      fallbackAuthor || {
        id: commentAuthorId,
        username: 'Explorer',
        displayName: 'Explorer',
        avatarUrl: '',
      };

    return {
      id: data.id,
      postId: data.post_id,
      userId: commentAuthorId,
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
    const initialCol = cachedCommentAuthorCol || 'user_id';
    let { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId)
      .eq(initialCol, userId);

    if (error && isMissingColumnError(error)) {
      const detectedCol = await detectTableAuthorColumn('post_comments', true);
      if (detectedCol !== initialCol) {
        const retryRes = await supabase
          .from('post_comments')
          .delete()
          .eq('id', commentId)
          .eq(detectedCol, userId);
        error = retryRes.error;
      }
    }

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
