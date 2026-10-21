import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../config/firebase';
import { EnrichedSpecimenScanResult } from './scannerService';

export interface FirebaseCollectionItem {
  id: string;
  userId: string;
  speciesId: string;
  commonName: string;
  scientificName: string;
  category: string;
  confidence: number;
  photoUrl: string;
  storagePath: string;
  rarity: 'Common' | 'Rare' | 'Legendary';
  conservationStatus: string;
  albumId: string;
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
    placeName?: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
}

export interface FirebaseAlbum {
  id: string;
  userId: string;
  name: string;
  description?: string;
  coverPhotoUrl?: string;
  itemCount: number;
  createdAt: string;
  updatedAt?: string;
}

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
 * Compresses an image dataUrl or image element to a maximum 1024px JPEG base64 string
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
 * Add specimen to user's Firestore collection and upload photo to Cloud Storage
 */
export async function addSpecimenToFirebase(params: {
  userId: string;
  scanResult: EnrichedSpecimenScanResult;
  photoDataUrl: string;
  albumId?: string;
  notes?: string;
  includeLocation?: boolean;
}): Promise<FirebaseCollectionItem> {
  const {
    userId,
    scanResult,
    photoDataUrl,
    albumId = 'default',
    notes = '',
    includeLocation = false,
  } = params;

  const itemId = `specimen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const storagePath = `users/${userId}/specimens/${itemId}.jpg`;

  // 1. Compress photo to max 1024px before storage upload
  const compressedBase64 = await compressImageToMax1024(photoDataUrl);

  // 2. Upload to Cloud Storage
  let storageUrl = photoDataUrl;
  try {
    const storageRef = ref(storage, storagePath);
    await uploadString(storageRef, compressedBase64, 'data_url', {
      contentType: 'image/jpeg',
      customMetadata: {
        userId,
        species: scanResult.scientificName,
        commonName: scanResult.commonName,
      },
    });
    storageUrl = await getDownloadURL(storageRef);
  } catch (err) {
    console.warn('Storage upload encountered an issue, storing image reference:', err);
    storageUrl = compressedBase64;
  }

  // 3. Obtain location coordinates if permitted
  let locationData: FirebaseCollectionItem['location'] = null;
  if (includeLocation && typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 4000,
          maximumAge: 60000,
        });
      });
      locationData = {
        latitude: parseFloat(pos.coords.latitude.toFixed(5)),
        longitude: parseFloat(pos.coords.longitude.toFixed(5)),
        placeName: 'Field Observation Coordinates',
      };
    } catch (locErr) {
      console.info('Location skipped or unavailable:', locErr);
    }
  }

  // 4. Derive rarity
  const rarity = deriveRarityTier(scanResult.conservationStatusCode);

  const matchedSpeciesId =
    scanResult.matchedSpeciesId ||
    scanResult.scientificName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const newItem: FirebaseCollectionItem = {
    id: itemId,
    userId,
    speciesId: matchedSpeciesId,
    commonName: scanResult.commonName,
    scientificName: scanResult.scientificName,
    category: scanResult.category,
    confidence: scanResult.confidence,
    photoUrl: storageUrl,
    storagePath,
    rarity,
    conservationStatus: scanResult.conservationStatusCode || 'LC',
    albumId,
    notes,
    location: locationData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 5. Save to Firestore: users/{userId}/collection/{itemId}
  const itemPath = `users/${userId}/collection/${itemId}`;
  try {
    const docRef = doc(db, 'users', userId, 'collection', itemId);
    await setDoc(docRef, {
      ...newItem,
      serverTimestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, itemPath);
  }

  // 6. Ensure default album exists in top-level albums/{albumId}
  try {
    await ensureDefaultAlbum(userId);
  } catch {}

  return newItem;
}

/**
 * Ensures the user has at least a default album in albums/{albumId}
 */
export async function ensureDefaultAlbum(userId: string): Promise<void> {
  const defaultAlbumId = `album-${userId}-default`;
  const albumPath = `albums/${defaultAlbumId}`;
  try {
    const albumRef = doc(db, 'albums', defaultAlbumId);
    await setDoc(
      albumRef,
      {
        id: defaultAlbumId,
        userId,
        name: 'General Field Dex',
        description: 'Default field observation journal',
        itemCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, albumPath);
  }
}

/**
 * Fetch all specimens in user's collection: users/{userId}/collection
 */
export async function getFirebaseUserCollection(
  userId: string
): Promise<FirebaseCollectionItem[]> {
  const collectionPath = `users/${userId}/collection`;
  try {
    const colRef = collection(db, 'users', userId, 'collection');
    const snapshot = await getDocs(colRef);
    const items: FirebaseCollectionItem[] = [];
    snapshot.forEach((docSnap) => {
      items.push(docSnap.data() as FirebaseCollectionItem);
    });
    // Sort recently cataloged first
    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionPath);
  }
}

/**
 * Real-time listener for user's collection
 */
export function subscribeToFirebaseUserCollection(
  userId: string,
  onUpdate: (items: FirebaseCollectionItem[]) => void,
  onError?: (error: any) => void
): () => void {
  const collectionPath = `users/${userId}/collection`;
  const colRef = collection(db, 'users', userId, 'collection');

  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: FirebaseCollectionItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as FirebaseCollectionItem);
      });
      items.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onUpdate(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  );
}

/**
 * Delete a specimen from user's collection and Storage
 */
export async function deleteSpecimenFromFirebase(
  userId: string,
  itemId: string,
  storagePath?: string
): Promise<void> {
  const path = `users/${userId}/collection/${itemId}`;
  try {
    const docRef = doc(db, 'users', userId, 'collection', itemId);
    await deleteDoc(docRef);

    // Remove photo from storage if present
    if (storagePath) {
      try {
        const fileRef = ref(storage, storagePath);
        await deleteObject(fileRef);
      } catch (err) {
        console.warn('Could not delete storage file:', err);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Move specimen to another album
 */
export async function moveSpecimenToAlbum(
  userId: string,
  itemId: string,
  targetAlbumId: string
): Promise<void> {
  const path = `users/${userId}/collection/${itemId}`;
  try {
    const docRef = doc(db, 'users', userId, 'collection', itemId);
    await updateDoc(docRef, {
      albumId: targetAlbumId,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Get user albums from top-level albums collection
 */
export async function getFirebaseUserAlbums(userId: string): Promise<FirebaseAlbum[]> {
  const albumsPath = 'albums';
  try {
    const albumsRef = collection(db, 'albums');
    const q = query(albumsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const albums: FirebaseAlbum[] = [];
    snapshot.forEach((docSnap) => {
      albums.push(docSnap.data() as FirebaseAlbum);
    });
    return albums;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, albumsPath);
  }
}

/**
 * Subscribe to user albums in real-time
 */
export function subscribeToFirebaseUserAlbums(
  userId: string,
  onUpdate: (albums: FirebaseAlbum[]) => void,
  onError?: (error: any) => void
): () => void {
  const albumsPath = 'albums';
  const albumsRef = collection(db, 'albums');
  const q = query(albumsRef, where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const albums: FirebaseAlbum[] = [];
      snapshot.forEach((docSnap) => {
        albums.push(docSnap.data() as FirebaseAlbum);
      });
      onUpdate(albums);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, albumsPath);
    }
  );
}

/**
 * Create a new album
 */
export async function createFirebaseAlbum(params: {
  userId: string;
  name: string;
  description?: string;
  coverPhotoUrl?: string;
}): Promise<FirebaseAlbum> {
  const { userId, name, description = '', coverPhotoUrl = '' } = params;
  const albumId = `album-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const albumPath = `albums/${albumId}`;

  const newAlbum: FirebaseAlbum = {
    id: albumId,
    userId,
    name,
    description,
    coverPhotoUrl,
    itemCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const albumRef = doc(db, 'albums', albumId);
    await setDoc(albumRef, {
      ...newAlbum,
      serverCreatedAt: serverTimestamp(),
    });
    return newAlbum;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, albumPath);
  }
}

/**
 * Delete an album and optionally reassign its specimens
 */
export async function deleteFirebaseAlbum(
  userId: string,
  albumId: string
): Promise<void> {
  const albumPath = `albums/${albumId}`;
  try {
    const albumRef = doc(db, 'albums', albumId);
    await deleteDoc(albumRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, albumPath);
  }
}
