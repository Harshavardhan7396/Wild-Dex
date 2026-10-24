import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { EnrichedSpecimenScanResult } from './scannerService';
import { CURATED_SPECIES } from './speciesService';

export interface CollectionItem {
  id: string;
  userId: string; // alias of owner_id
  ownerId: string;
  speciesId: string;
  commonName: string; // mapped from species_name
  scientificName: string; // mapped from scientific_name
  category: string;
  confidence: number;
  photoUrl: string; // generated signed URL or fallback
  photoPath: string; // mapped from photo_path ({userId}/{filename})
  storagePath: string; // alias for photoPath for backward compatibility
  rarity: 'Common' | 'Rare' | 'Legendary';
  conservationStatus: string;
  albumId?: string | null;
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
    placeName?: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
}

// Backward-compatible alias
export type FirebaseCollectionItem = CollectionItem;

export interface Album {
  id: string;
  userId: string; // alias of owner_id
  ownerId: string;
  name: string;
  description?: string;
  coverPhotoUrl?: string;
  itemCount: number;
  createdAt: string;
  updatedAt?: string;
}

// Backward-compatible alias
export type FirebaseAlbum = Album;

/**
 * Determine rarity tier based on IUCN conservation status code
 */
export function deriveRarityTier(
  conservationStatus?: string
): 'Common' | 'Rare' | 'Legendary' {
  const code = (conservationStatus || '').toUpperCase().trim();
  if (code === 'CR' || code === 'EW' || code === 'EX' || code.includes('CRITICAL')) {
    return 'Legendary';
  }
  if (code === 'EN' || code === 'VU' || code === 'NT' || code.includes('ENDANGER') || code.includes('VULNERABLE')) {
    return 'Rare';
  }
  return 'Common';
}

/**
 * Compresses an image dataUrl to a maximum 1024px JPEG base64 string
 */
export async function compressImageToMax1024(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { width, height } = img;
      const maxDimension = 1024;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Helper to convert dataURL (base64) to Blob for upload
 */
function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Helper to generate a signed URL for a photo path in private 'scans' bucket
 */
export async function getSignedPhotoUrl(photoPath: string): Promise<string> {
  if (!photoPath) return '';
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://') || photoPath.startsWith('data:')) {
    return photoPath;
  }
  try {
    const { data, error } = await supabase.storage.from('scans').createSignedUrl(photoPath, 3600);
    if (error || !data?.signedUrl) {
      console.error('[Supabase Storage Error] Could not generate signed URL for path:', photoPath, error);
      return '';
    }
    return data.signedUrl;
  } catch (err) {
    console.error('[Supabase Storage Error] Exception in getSignedPhotoUrl:', err);
    return '';
  }
}

/**
 * Add specimen to user's Supabase collection and upload photo to 'scans' bucket
 */
export async function addSpecimenToSupabase(params: {
  userId: string;
  scanResult: EnrichedSpecimenScanResult;
  photoDataUrl: string;
  albumId?: string;
  notes?: string;
  includeLocation?: boolean;
}): Promise<CollectionItem> {
  const {
    userId,
    scanResult,
    photoDataUrl,
    albumId = 'default',
    includeLocation = false,
  } = params;

  if (!isSupabaseConfigured) {
    const configErr = new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.');
    console.error('[Supabase Configuration Error]:', configErr);
    throw configErr;
  }

  // Derive active session user ID to guarantee matching auth.uid() in Supabase RLS
  let authUserId = userId;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      authUserId = session.user.id;
    }
  } catch (authErr) {
    console.warn('[Supabase Auth Warning] Error getting session in addSpecimenToSupabase:', authErr);
  }

  // 1. Generate valid RFC4122 UUID for item
  const itemId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  const photoFilename = `${itemId}.jpg`;
  const photoPath = `${authUserId}/${photoFilename}`;

  // 2. Compress photo to max 1024px before storage upload
  const compressedBase64 = await compressImageToMax1024(photoDataUrl);
  const blob = dataURLtoBlob(compressedBase64);

  // 3. Upload to Supabase Storage 'scans' bucket at {user_id}/{filename}
  let signedUrl = compressedBase64;
  try {
    const { error: uploadError } = await supabase.storage
      .from('scans')
      .upload(photoPath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Supabase Storage Upload Error]:', uploadError);
    } else {
      const generated = await getSignedPhotoUrl(photoPath);
      if (generated) signedUrl = generated;
    }
  } catch (err) {
    console.error('[Supabase Storage Upload Exception]:', err);
  }

  // 4. Obtain location coordinates if permitted
  let lat: number | null = null;
  let lng: number | null = null;
  if (includeLocation && typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 4000,
          maximumAge: 60000,
        });
      });
      let rawLat = pos.coords.latitude;
      let rawLng = pos.coords.longitude;

      // Security requirement: Do not store exact locations of endangered species publicly
      const isEndangered =
        scanResult.safetyFlags?.endangered ||
        deriveRarityTier(scanResult.conservationStatusCode) === 'Legendary';
      if (isEndangered) {
        // Obfuscate / round to ~10km (approx 0.1 degree)
        lat = parseFloat(rawLat.toFixed(1));
        lng = parseFloat(rawLng.toFixed(1));
      } else {
        lat = parseFloat(rawLat.toFixed(5));
        lng = parseFloat(rawLng.toFixed(5));
      }
    } catch (locErr) {
      console.info('Location skipped or unavailable:', locErr);
    }
  }

  // 5. Derive rarity
  const rarity = deriveRarityTier(scanResult.conservationStatusCode);

  // Prepare database record for collection_items table
  const validAlbumId = albumId && albumId !== 'default' && albumId !== 'all' ? albumId : null;

  const dbRow = {
    id: itemId,
    owner_id: authUserId,
    album_id: validAlbumId,
    species_name: scanResult.commonName,
    scientific_name: scanResult.scientificName,
    category: scanResult.category || 'other',
    confidence: scanResult.confidence || 0.95,
    rarity: rarity,
    photo_path: photoPath,
    lat,
    lng,
    created_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from('collection_items')
    .insert([dbRow]);

  if (insertError) {
    console.error('[Supabase Insert Error]: Failed to insert collection_item to Supabase:', insertError);
    throw new Error(insertError.message || 'Could not save specimen to collection.');
  }

  const newItem: CollectionItem = {
    id: itemId,
    userId: authUserId,
    ownerId: authUserId,
    speciesId: scanResult.scientificName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    commonName: scanResult.commonName,
    scientificName: scanResult.scientificName,
    category: scanResult.category,
    confidence: scanResult.confidence,
    photoUrl: signedUrl,
    photoPath,
    storagePath: photoPath,
    rarity,
    conservationStatus: scanResult.conservationStatusCode || 'LC',
    albumId: validAlbumId || 'default',
    notes: params.notes || '',
    location:
      lat !== null && lng !== null
        ? {
            latitude: lat,
            longitude: lng,
            placeName: 'Field Observation Coordinates',
          }
        : null,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.created_at,
  };

  // Dispatch refresh events across the application so collection views refresh without reload
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wilddex:collection_updated', { detail: newItem }));
    window.dispatchEvent(new CustomEvent('wilddex:item_saved', { detail: newItem }));
  }

  return newItem;
}

// Backward-compatible alias
export const addSpecimenToFirebase = addSpecimenToSupabase;

/**
 * Fetch all items in user's collection from collection_items
 */
export async function getSupabaseUserCollection(userId?: string): Promise<CollectionItem[]> {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase Collection] Supabase is not configured yet. Returning empty list.');
    return [];
  }
  try {
    // Derive active session user ID to ensure exact match with auth.uid() in Supabase RLS
    let authUserId = userId;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        authUserId = session.user.id;
      }
    } catch (authErr) {
      console.warn('[Supabase Auth Warning] Error retrieving session in getSupabaseUserCollection:', authErr);
    }

    if (!authUserId) {
      console.warn('[Supabase Query Warning] No authenticated user ID available for collection query.');
      return [];
    }

    const { data, error } = await supabase
      .from('collection_items')
      .select('*')
      .eq('owner_id', authUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase Query Error] Failed to fetch collection_items from Supabase:', error);
      throw error;
    }

    if (!data || data.length === 0) return [];

    // Resolve signed URLs for all items and ensure failed photos never hide items
    const items: CollectionItem[] = await Promise.all(
      data.map(async (row: any) => {
        let photoUrl = '';
        if (row.photo_path) {
          try {
            photoUrl = await getSignedPhotoUrl(row.photo_path);
          } catch (photoErr) {
            console.error('[Supabase Storage Error] Exception getting signed photo URL for row:', row.photo_path, photoErr);
          }
        }

        // Rule 4: If signed URL creation failed or path is unreachable, provide reliable fallback
        // so that a failed photo NEVER hides the item
        if (!photoUrl) {
          const matchedCurated = CURATED_SPECIES.find(
            (c) =>
              c.scientificName.toLowerCase() === row.scientific_name?.toLowerCase() ||
              c.commonName.toLowerCase() === row.species_name?.toLowerCase()
          );
          photoUrl =
            matchedCurated?.photoUrl ||
            'https://lh3.googleusercontent.com/aida-public/AB6AXuDTp4wz_G-5zP2-JqUf7VbLzK1E9B12sQ3_X6t8M9nO0pQrStUvWxYz';
        }

        return {
          id: row.id,
          userId: row.owner_id,
          ownerId: row.owner_id,
          speciesId: row.scientific_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          commonName: row.species_name,
          scientificName: row.scientific_name,
          category: row.category,
          confidence: row.confidence,
          photoUrl: photoUrl,
          photoPath: row.photo_path,
          storagePath: row.photo_path,
          rarity: (row.rarity as 'Common' | 'Rare' | 'Legendary') || 'Common',
          conservationStatus: row.rarity === 'Legendary' ? 'CR' : row.rarity === 'Rare' ? 'EN' : 'LC',
          albumId: row.album_id || 'default',
          location:
            row.lat != null && row.lng != null
              ? {
                  latitude: row.lat,
                  longitude: row.lng,
                  placeName: 'Field Observation Coordinates',
                }
              : null,
          createdAt: row.created_at,
          updatedAt: row.created_at,
        };
      })
    );

    return items;
  } catch (err) {
    console.error('[Supabase Collection Error] getSupabaseUserCollection failed:', err);
    throw err;
  }
}

// Backward-compatible alias
export const getFirebaseUserCollection = getSupabaseUserCollection;

/**
 * Real-time listener for user's collection
 */
export function subscribeToSupabaseUserCollection(
  userId: string,
  onUpdate: (items: CollectionItem[]) => void,
  onError?: (error: any) => void
): () => void {
  let isMounted = true;

  const loadData = async () => {
    try {
      const items = await getSupabaseUserCollection(userId);
      if (isMounted) onUpdate(items);
    } catch (err) {
      if (onError && isMounted) onError(err);
    }
  };

  // Initial load
  loadData();

  if (!isSupabaseConfigured) {
    return () => {
      isMounted = false;
    };
  }

  // Subscribe to changes on collection_items for this user
  const channel = supabase
    .channel(`collection_items_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'collection_items',
        filter: `owner_id=eq.${userId}`,
      },
      () => {
        loadData();
      }
    )
    .subscribe();

  return () => {
    isMounted = false;
    supabase.removeChannel(channel);
  };
}

// Backward-compatible alias
export const subscribeToFirebaseUserCollection = subscribeToSupabaseUserCollection;

/**
 * Delete a specimen from collection_items and Storage
 */
export async function deleteSpecimenFromSupabase(
  userId: string,
  itemId: string,
  storagePath?: string
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    // 1. Delete record from collection_items
    const { error: dbError } = await supabase
      .from('collection_items')
      .delete()
      .eq('id', itemId)
      .eq('owner_id', userId);

    if (dbError) {
      console.error('Failed to delete collection item from DB:', dbError);
      throw dbError;
    }

    // 2. Delete file from Storage if photoPath / storagePath provided
    if (storagePath) {
      try {
        await supabase.storage.from('scans').remove([storagePath]);
      } catch (storageErr) {
        console.warn('Could not delete storage file:', storageErr);
      }
    }
  } catch (err) {
    console.error('Error deleting specimen:', err);
    throw err;
  }
}

// Backward-compatible alias
export const deleteSpecimenFromFirebase = deleteSpecimenFromSupabase;

/**
 * Move specimen to another album
 */
export async function moveSpecimenToAlbum(
  userId: string,
  itemId: string,
  targetAlbumId: string
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const validAlbumId = targetAlbumId && targetAlbumId !== 'default' ? targetAlbumId : null;

    const { error } = await supabase
      .from('collection_items')
      .update({ album_id: validAlbumId })
      .eq('id', itemId)
      .eq('owner_id', userId);

    if (error) {
      console.error('Failed to move item to album:', error);
      throw error;
    }
  } catch (err) {
    console.error('Error moving specimen to album:', err);
    throw err;
  }
}

/**
 * Fetch user albums from albums table
 */
export async function getSupabaseUserAlbums(userId: string): Promise<Album[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch albums:', error);
      throw error;
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      userId: row.owner_id,
      ownerId: row.owner_id,
      name: row.name,
      description: '',
      itemCount: 0,
      createdAt: row.created_at,
      updatedAt: row.created_at,
    }));
  } catch (err) {
    console.error('getSupabaseUserAlbums error:', err);
    throw err;
  }
}

// Backward-compatible alias
export const getFirebaseUserAlbums = getSupabaseUserAlbums;

/**
 * Subscribe to user albums
 */
export function subscribeToSupabaseUserAlbums(
  userId: string,
  onUpdate: (albums: Album[]) => void,
  onError?: (error: any) => void
): () => void {
  let isMounted = true;

  const loadAlbums = async () => {
    try {
      const albums = await getSupabaseUserAlbums(userId);
      if (isMounted) onUpdate(albums);
    } catch (err) {
      if (onError && isMounted) onError(err);
    }
  };

  loadAlbums();

  if (!isSupabaseConfigured) {
    return () => {
      isMounted = false;
    };
  }

  const channel = supabase
    .channel(`albums_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'albums',
        filter: `owner_id=eq.${userId}`,
      },
      () => {
        loadAlbums();
      }
    )
    .subscribe();

  return () => {
    isMounted = false;
    supabase.removeChannel(channel);
  };
}

// Backward-compatible alias
export const subscribeToFirebaseUserAlbums = subscribeToSupabaseUserAlbums;

/**
 * Create a new album
 */
export async function createSupabaseAlbum(params: {
  userId: string;
  name: string;
  description?: string;
  coverPhotoUrl?: string;
}): Promise<Album> {
  const { userId, name } = params;
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('albums')
    .insert([
      {
        owner_id: userId,
        name: name.trim(),
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to create album:', error);
    throw new Error(error?.message || 'Could not create album.');
  }

  return {
    id: data.id,
    userId: data.owner_id,
    ownerId: data.owner_id,
    name: data.name,
    itemCount: 0,
    createdAt: data.created_at,
  };
}

// Backward-compatible alias
export const createFirebaseAlbum = createSupabaseAlbum;

/**
 * Delete an album
 */
export async function deleteSupabaseAlbum(
  userId: string,
  albumId: string
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase
      .from('albums')
      .delete()
      .eq('id', albumId)
      .eq('owner_id', userId);

    if (error) {
      console.error('Failed to delete album:', error);
      throw error;
    }
  } catch (err) {
    console.error('Error deleting album:', err);
    throw err;
  }
}

// Backward-compatible alias
export const deleteFirebaseAlbum = deleteSupabaseAlbum;

/**
 * Ensure default album (no-op in relational schema as album_id can be NULL for default)
 */
export async function ensureDefaultAlbum(_userId: string): Promise<void> {
  // In Supabase, items without a specific custom album have album_id = null (All Saved Items).
  return Promise.resolve();
}
