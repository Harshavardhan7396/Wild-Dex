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
 * Compresses an image source (dataUrl or HTTP URL) to a max 1024px JPEG Blob
 */
export async function compressImageToJpegBlob(sourceUrl: string, maxDimension = 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!sourceUrl) {
      reject(new Error('No image provided to compress.'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let { width, height } = img;
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
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to create canvas 2D context for image compression.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to convert canvas to JPEG blob.'));
            }
          },
          'image/jpeg',
          0.85
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      // Fallback: If remote URL blocked by CORS, try direct fetch as Blob
      if (sourceUrl.startsWith('http')) {
        fetch(sourceUrl)
          .then((res) => {
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            return res.blob();
          })
          .then((blob) => resolve(blob))
          .catch((fetchErr) => {
            console.error('Fetch image fallback failed:', fetchErr);
            reject(new Error('Could not load specimen image for compression.'));
          });
      } else if (sourceUrl.startsWith('data:')) {
        try {
          resolve(dataURLtoBlob(sourceUrl));
        } catch (base64Err) {
          reject(new Error('Invalid image base64 data format.'));
        }
      } else {
        reject(new Error('Unable to read specimen image file.'));
      }
    };

    img.src = sourceUrl;
  });
}

/**
 * Helper to convert dataURL (base64) to Blob for upload
 */
function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1] || arr[0]);
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

  // 1. Authenticate with Supabase directly
  let authUserId = userId;
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Please sign in to save');
    }
    authUserId = user.id;
  } catch (authErr: any) {
    console.error('[Supabase Auth Error]:', authErr);
    throw new Error(authErr?.message || 'Please sign in to save');
  }

  // Generate UUID for row ID and timestamp for filename
  const itemId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

  // Step (b) path requirement: {user_id}/{timestamp}.jpg
  const timestamp = Date.now();
  const photoPath = `${authUserId}/${timestamp}.jpg`;

  // Step (a): Compress the image to 1024px JPEG
  let jpegBlob: Blob;
  try {
    jpegBlob = await compressImageToJpegBlob(photoDataUrl, 1024);
  } catch (compressErr: any) {
    console.error('[Compression Error]: Failed to compress image to 1024px JPEG:', compressErr);
    throw new Error(compressErr?.message || 'Failed to compress image to 1024px JPEG');
  }

  // Step (b): Upload to the "scans" bucket at {user_id}/{timestamp}.jpg
  try {
    const { error: uploadError } = await supabase.storage
      .from('scans')
      .upload(photoPath, jpegBlob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Supabase Storage Upload Error]:', uploadError);
      throw new Error(uploadError.message || 'Failed to upload photo to scans bucket');
    }
  } catch (storageErr: any) {
    console.error('[Supabase Storage Exception]:', storageErr);
    throw storageErr;
  }

  // Step (c): Insert into collection_items with owner_id = user.id
  let signedUrl = '';
  try {
    const generated = await getSignedPhotoUrl(photoPath);
    if (generated) signedUrl = generated;
  } catch {}

  // Obtain location coordinates if permitted
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
      lat = parseFloat(pos.coords.latitude.toFixed(5));
      lng = parseFloat(pos.coords.longitude.toFixed(5));
    } catch (locErr) {
      console.info('Location skipped or unavailable:', locErr);
    }
  }

  const rarity = deriveRarityTier(scanResult.conservationStatusCode);
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

  try {
    const { error: insertError } = await supabase
      .from('collection_items')
      .insert([dbRow]);

    if (insertError) {
      console.error('[Supabase Insert Error]: Failed to insert collection_item to Supabase:', insertError);
      throw new Error(insertError.message || 'Failed to insert row into collection_items');
    }
  } catch (dbErr: any) {
    console.error('[Supabase Insert Exception]:', dbErr);
    throw dbErr;
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
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        authUserId = user.id;
      }
    } catch (authErr) {
      console.warn('[Supabase Auth Warning] Error retrieving user in getSupabaseUserCollection:', authErr);
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
