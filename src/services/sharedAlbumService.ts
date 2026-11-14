import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CollectionItem, getSignedPhotoUrl } from './supabaseCollectionService';

export type AlbumRole = 'owner' | 'editor' | 'viewer';
export type InviteRole = 'editor' | 'viewer';

export interface PublicMemberProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface SharedAlbumSummary {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  createdAt: string;
  myRole: AlbumRole;
  memberCount: number;
  itemCount: number;
}

export interface AlbumMember {
  id: string;
  albumId: string;
  userId: string;
  role: AlbumRole;
  createdAt: string;
  profile: PublicMemberProfile;
}

export interface SharedAlbumItem {
  id: string;
  albumId: string;
  addedBy: string;
  collectionItemId: string | null;
  speciesName: string;
  scientificName: string;
  photoUrl: string;
  createdAt: string;
  addedByName: string;
}

export interface AlbumDetailData {
  album: SharedAlbumSummary;
  members: AlbumMember[];
  items: SharedAlbumItem[];
}

export interface AlbumInviteResult {
  id: string;
  code: string;
  role: InviteRole;
  inviteUrl: string;
  expiresAt: string;
}

function ensureConfigured() {
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

function normalizeRole(raw: unknown): AlbumRole {
  const val = String(raw || '').toLowerCase();
  if (val === 'owner') return 'owner';
  if (val === 'editor') return 'editor';
  return 'viewer';
}

function normalizeProfile(raw: any, fallbackId: string): PublicMemberProfile {
  const obj = Array.isArray(raw) ? raw[0] : raw;
  const username =
    (typeof obj?.username === 'string' && obj.username.trim()) ||
    (typeof obj?.display_name === 'string' && obj.display_name.trim()) ||
    'Explorer';
  const displayName =
    (typeof obj?.display_name === 'string' && obj.display_name.trim()) ||
    username;
  const avatarUrl = typeof obj?.avatar_url === 'string' ? obj.avatar_url : '';

  return {
    id: obj?.id || fallbackId,
    username,
    displayName,
    avatarUrl,
  };
}

async function fetchPublicProfilesMap(userIds: string[]): Promise<Map<string, PublicMemberProfile>> {
  const map = new Map<string, PublicMemberProfile>();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return map;

  try {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', uniqueIds);

    if (error) {
      console.warn('public_profiles lookup warning:', error);
      return map;
    }

    for (const row of data || []) {
      map.set(row.id, normalizeProfile(row, row.id));
    }
  } catch (err) {
    console.warn('Error fetching public_profiles:', err);
  }
  return map;
}

function generateInviteCode(length = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let code = '';
  for (let i = 0; i < length; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

export async function fetchMyAndSharedAlbums(userId: string): Promise<SharedAlbumSummary[]> {
  ensureConfigured();

  try {
    const [ownedRes, memberRes] = await Promise.all([
      supabase
        .from('albums')
        .select('id, owner_id, name, description, created_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('album_members')
        .select('album_id, role')
        .eq('user_id', userId),
    ]);

    if (ownedRes.error) {
      throw new Error(ownedRes.error.message || 'Could not load your albums.');
    }
    if (memberRes.error) {
      throw new Error(memberRes.error.message || 'Could not load shared albums.');
    }

    const albumMap = new Map<string, SharedAlbumSummary>();
    const roleByAlbumId = new Map<string, AlbumRole>();

    for (const m of memberRes.data || []) {
      if (m.album_id) {
        roleByAlbumId.set(m.album_id, normalizeRole(m.role));
      }
    }

    for (const row of ownedRes.data || []) {
      albumMap.set(row.id, {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        description: row.description || '',
        createdAt: row.created_at,
        myRole: 'owner',
        memberCount: 1,
        itemCount: 0,
      });
    }

    const sharedIds = Array.from(roleByAlbumId.keys()).filter((id) => !albumMap.has(id));
    if (sharedIds.length > 0) {
      const { data: sharedRows, error: sharedErr } = await supabase
        .from('albums')
        .select('id, owner_id, name, description, created_at')
        .in('id', sharedIds);

      if (sharedErr) {
        throw new Error(sharedErr.message || 'Could not load shared album details.');
      }

      for (const row of sharedRows || []) {
        albumMap.set(row.id, {
          id: row.id,
          ownerId: row.owner_id,
          name: row.name,
          description: row.description || '',
          createdAt: row.created_at,
          myRole: row.owner_id === userId ? 'owner' : roleByAlbumId.get(row.id) || 'viewer',
          memberCount: 1,
          itemCount: 0,
        });
      }
    }

    const allIds = Array.from(albumMap.keys());
    if (allIds.length > 0) {
      const [membersCountRes, itemsCountRes] = await Promise.all([
        supabase.from('album_members').select('album_id').in('album_id', allIds),
        supabase.from('shared_album_items').select('album_id').in('album_id', allIds),
      ]);

      if (!membersCountRes.error && membersCountRes.data) {
        const countMap = new Map<string, number>();
        for (const r of membersCountRes.data) {
          countMap.set(r.album_id, (countMap.get(r.album_id) || 0) + 1);
        }
        for (const [id, summary] of albumMap.entries()) {
          const cnt = countMap.get(id);
          if (typeof cnt === 'number' && cnt > 0) {
            summary.memberCount = cnt;
          }
        }
      }

      if (!itemsCountRes.error && itemsCountRes.data) {
        const countMap = new Map<string, number>();
        for (const r of itemsCountRes.data) {
          countMap.set(r.album_id, (countMap.get(r.album_id) || 0) + 1);
        }
        for (const [id, summary] of albumMap.entries()) {
          summary.itemCount = countMap.get(id) || 0;
        }
      }
    }

    return Array.from(albumMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err: any) {
    console.error('Error fetching albums:', err);
    throw new Error(err?.message || 'Could not load albums.');
  }
}

export async function createSharedAlbum(params: {
  userId: string;
  name: string;
  description: string;
}): Promise<SharedAlbumSummary> {
  ensureConfigured();
  const cleanName = params.name.trim();
  const cleanDesc = params.description.trim();

  if (!cleanName) {
    throw new Error('Please enter an album name.');
  }

  try {
    const { data, error } = await supabase
      .from('albums')
      .insert([
        {
          owner_id: params.userId,
          name: cleanName,
          description: cleanDesc,
        },
      ])
      .select('id, owner_id, name, description, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not create shared album.');
    }

    // Ensure owner is in album_members (trigger also does this, ignore duplicate/RLS error)
    try {
      await supabase
        .from('album_members')
        .upsert(
          [{ album_id: data.id, user_id: params.userId, role: 'owner' }],
          { onConflict: 'album_id,user_id', ignoreDuplicates: true }
        );
    } catch {
      // Trigger handles insertion automatically
    }

    return {
      id: data.id,
      ownerId: data.owner_id,
      name: data.name,
      description: data.description || '',
      createdAt: data.created_at,
      myRole: 'owner',
      memberCount: 1,
      itemCount: 0,
    };
  } catch (err: any) {
    console.error('Error creating shared album:', err);
    throw new Error(err?.message || 'Could not create shared album.');
  }
}

export async function fetchAlbumDetail(
  albumId: string,
  currentUserId: string
): Promise<AlbumDetailData> {
  ensureConfigured();

  try {
    const albumRes = await supabase
      .from('albums')
      .select('id, owner_id, name, description, created_at')
      .eq('id', albumId)
      .maybeSingle();

    if (albumRes.error) {
      throw new Error(albumRes.error.message || 'Could not load album.');
    }
    if (!albumRes.data) {
      throw new Error('Album not found or you do not have access.');
    }

    const albumRow = albumRes.data;

    // Fetch album_members joined with public_profiles (with PGRST200 fallback)
    let membersData: any[] = [];
    let membersQuery = await supabase
      .from('album_members')
      .select('id, album_id, user_id, role, created_at, public_profiles(id, username, display_name, avatar_url)')
      .eq('album_id', albumId)
      .order('created_at', { ascending: true });

    if (membersQuery.error && isRelationshipMissingError(membersQuery.error)) {
      const fallback = await supabase
        .from('album_members')
        .select('id, album_id, user_id, role, created_at')
        .eq('album_id', albumId)
        .order('created_at', { ascending: true });
      if (fallback.error) {
        throw new Error(fallback.error.message || 'Could not load album members.');
      }
      membersData = fallback.data || [];
    } else if (membersQuery.error) {
      throw new Error(membersQuery.error.message || 'Could not load album members.');
    } else {
      membersData = membersQuery.data || [];
    }

    // Fetch shared items
    const itemsRes = await supabase
      .from('shared_album_items')
      .select('id, album_id, added_by, collection_item_id, species_name, scientific_name, photo_url, created_at')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false });

    if (itemsRes.error) {
      throw new Error(itemsRes.error.message || 'Could not load shared items.');
    }
    const rawItems = itemsRes.data || [];

    // Collect user IDs needing public_profiles lookup
    const idsNeedingProfile = new Set<string>();
    if (!membersData.some((m) => m.user_id === albumRow.owner_id)) {
      idsNeedingProfile.add(albumRow.owner_id);
    }
    for (const m of membersData) {
      if (!m.public_profiles && m.user_id) {
        idsNeedingProfile.add(m.user_id);
      }
    }
    for (const item of rawItems) {
      if (item.added_by) {
        idsNeedingProfile.add(item.added_by);
      }
    }

    const profilesMap = await fetchPublicProfilesMap(Array.from(idsNeedingProfile));

    const members: AlbumMember[] = membersData.map((m) => {
      const profile = m.public_profiles
        ? normalizeProfile(m.public_profiles, m.user_id)
        : profilesMap.get(m.user_id) || normalizeProfile(null, m.user_id);
      profilesMap.set(m.user_id, profile);

      return {
        id: m.id,
        albumId: m.album_id,
        userId: m.user_id,
        role: m.user_id === albumRow.owner_id ? 'owner' : normalizeRole(m.role),
        createdAt: m.created_at,
        profile,
      };
    });

    // Ensure album owner always appears in member list
    if (!members.some((m) => m.userId === albumRow.owner_id)) {
      const ownerProfile =
        profilesMap.get(albumRow.owner_id) || normalizeProfile(null, albumRow.owner_id);
      members.unshift({
        id: `owner-${albumRow.owner_id}`,
        albumId: albumRow.id,
        userId: albumRow.owner_id,
        role: 'owner',
        createdAt: albumRow.created_at,
        profile: ownerProfile,
      });
    }

    // Sort Owner first, then Editors, then Viewers
    const roleOrder: Record<AlbumRole, number> = { owner: 0, editor: 1, viewer: 2 };
    members.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

    const myMembership = members.find((m) => m.userId === currentUserId);
    const myRole: AlbumRole =
      albumRow.owner_id === currentUserId ? 'owner' : myMembership?.role || 'viewer';

    const items: SharedAlbumItem[] = rawItems.map((row) => {
      const adder = profilesMap.get(row.added_by);
      return {
        id: row.id,
        albumId: row.album_id,
        addedBy: row.added_by,
        collectionItemId: row.collection_item_id || null,
        speciesName: row.species_name || 'Nature Discovery',
        scientificName: row.scientific_name || '',
        photoUrl: row.photo_url || '',
        createdAt: row.created_at,
        addedByName: adder?.username || adder?.displayName || 'Member',
      };
    });

    return {
      album: {
        id: albumRow.id,
        ownerId: albumRow.owner_id,
        name: albumRow.name,
        description: albumRow.description || '',
        createdAt: albumRow.created_at,
        myRole,
        memberCount: members.length,
        itemCount: items.length,
      },
      members,
      items,
    };
  } catch (err: any) {
    console.error('Error loading album details:', err);
    throw new Error(err?.message || 'Could not load album details.');
  }
}

export async function createAlbumInvite(params: {
  albumId: string;
  userId: string;
  role: InviteRole;
}): Promise<AlbumInviteResult> {
  ensureConfigured();
  const { albumId, userId, role } = params;
  const code = generateInviteCode(10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from('album_invites')
      .insert([
        {
          album_id: albumId,
          created_by: userId,
          role,
          code,
          expires_at: expiresAt,
        },
      ])
      .select('id, code, role, expires_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not create invite link.');
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      id: data.id,
      code: data.code,
      role: data.role === 'editor' ? 'editor' : 'viewer',
      inviteUrl: `${origin}/#/join/${data.code}`,
      expiresAt: data.expires_at,
    };
  } catch (err: any) {
    console.error('Error creating album invite:', err);
    throw new Error(err?.message || 'Could not create invite link.');
  }
}

export async function acceptAlbumInvite(code: string): Promise<string> {
  ensureConfigured();
  const cleanCode = code.trim();
  if (!cleanCode) {
    throw new Error('Invite is invalid or expired');
  }

  try {
    const { data, error } = await supabase.rpc('accept_invite', {
      p_code: cleanCode,
    });

    if (error || !data) {
      throw new Error('Invite is invalid or expired');
    }

    return String(data);
  } catch (err: any) {
    console.error('Error accepting invite:', err);
    throw new Error('Invite is invalid or expired');
  }
}

export async function addCollectionItemToSharedAlbum(params: {
  albumId: string;
  userId: string;
  collectionItem: CollectionItem;
}): Promise<SharedAlbumItem> {
  ensureConfigured();
  const { albumId, userId, collectionItem } = params;

  try {
    // Generate a 7-day signed photo URL from private 'scans' bucket if photoPath is a storage path
    let signedOrPublicPhotoUrl = collectionItem.photoUrl || '';
    if (
      collectionItem.photoPath &&
      !collectionItem.photoPath.startsWith('http://') &&
      !collectionItem.photoPath.startsWith('https://') &&
      !collectionItem.photoPath.startsWith('data:')
    ) {
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('scans')
        .createSignedUrl(collectionItem.photoPath, 60 * 60 * 24 * 7);

      if (!signedErr && signedData?.signedUrl) {
        signedOrPublicPhotoUrl = signedData.signedUrl;
      } else {
        const fallbackUrl = await getSignedPhotoUrl(collectionItem.photoPath);
        if (fallbackUrl) signedOrPublicPhotoUrl = fallbackUrl;
      }
    }

    const { data, error } = await supabase
      .from('shared_album_items')
      .insert([
        {
          album_id: albumId,
          added_by: userId,
          collection_item_id: collectionItem.id,
          species_name: collectionItem.commonName,
          scientific_name: collectionItem.scientificName || '',
          photo_url: signedOrPublicPhotoUrl,
        },
      ])
      .select('id, album_id, added_by, collection_item_id, species_name, scientific_name, photo_url, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not add item to album.');
    }

    const profiles = await fetchPublicProfilesMap([userId]);
    const adder = profiles.get(userId);

    return {
      id: data.id,
      albumId: data.album_id,
      addedBy: data.added_by,
      collectionItemId: data.collection_item_id || null,
      speciesName: data.species_name,
      scientificName: data.scientific_name || '',
      photoUrl: data.photo_url || '',
      createdAt: data.created_at,
      addedByName: adder?.username || adder?.displayName || 'You',
    };
  } catch (err: any) {
    console.error('Error adding collection item to shared album:', err);
    throw new Error(err?.message || 'Could not add item to shared album.');
  }
}

export async function removeSharedAlbumItem(itemId: string): Promise<void> {
  ensureConfigured();
  try {
    const { error } = await supabase
      .from('shared_album_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      throw new Error(error.message || 'Could not remove item from album.');
    }
  } catch (err: any) {
    console.error('Error removing shared album item:', err);
    throw new Error(err?.message || 'Could not remove item.');
  }
}

export async function removeOrLeaveAlbumMember(params: {
  albumId: string;
  memberUserId: string;
}): Promise<void> {
  ensureConfigured();
  const { albumId, memberUserId } = params;
  try {
    const { error } = await supabase
      .from('album_members')
      .delete()
      .eq('album_id', albumId)
      .eq('user_id', memberUserId);

    if (error) {
      throw new Error(error.message || 'Could not update album membership.');
    }
  } catch (err: any) {
    console.error('Error removing/leaving album member:', err);
    throw new Error(err?.message || 'Could not update album membership.');
  }
}
