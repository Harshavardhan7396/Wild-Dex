import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface FavoriteSpeciesItem {
  id: number;
  commonName: string;
  scientificName: string;
  photoUrl?: string;
}

export interface UserPrivateData {
  userId: string;
  interests: string[];
  favoriteSpecies: FavoriteSpeciesItem[];
  onboardingDone: boolean;
  locationConsent: boolean;
  homeLat: number | null;
  homeLng: number | null;
  homeLabel: string;
}

export interface SaveUserPrivatePayload {
  interests: string[];
  favoriteSpecies: FavoriteSpeciesItem[];
  onboardingDone: boolean;
  locationConsent: boolean;
  homeLat: number | null;
  homeLng: number | null;
  homeLabel?: string;
}

const USER_PRIVATE_COLUMNS =
  'user_id, interests, favorite_species, onboarding_done, location_consent, home_lat, home_lng, home_label';

export function roundCoordTo2Decimals(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

export function parseFavoriteSpeciesList(raw: unknown): FavoriteSpeciesItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): FavoriteSpeciesItem | null => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const id = typeof obj.id === 'number' ? obj.id : Number(obj.id);
      const commonName =
        typeof obj.commonName === 'string'
          ? obj.commonName
          : typeof obj.common_name === 'string'
          ? obj.common_name
          : typeof obj.name === 'string'
          ? obj.name
          : '';
      const scientificName =
        typeof obj.scientificName === 'string'
          ? obj.scientificName
          : typeof obj.scientific_name === 'string'
          ? obj.scientific_name
          : '';
      if (!commonName && !scientificName) return null;
      return {
        id: Number.isFinite(id) ? id : 0,
        commonName: commonName || scientificName,
        scientificName: scientificName || commonName,
        photoUrl:
          typeof obj.photoUrl === 'string'
            ? obj.photoUrl
            : typeof obj.photo_url === 'string'
            ? obj.photo_url
            : undefined,
      };
    })
    .filter((x): x is FavoriteSpeciesItem => x !== null);
}

/**
 * Fetches ONLY the currently signed-in user's user_private row.
 * Never requests any other user's row.
 */
export async function fetchMyUserPrivate(): Promise<UserPrivateData | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    const signedInUserId = userRes?.user?.id;
    if (authErr || !signedInUserId) {
      return null;
    }

    const { data, error } = await supabase
      .from('user_private')
      .select(USER_PRIVATE_COLUMNS)
      .eq('user_id', signedInUserId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('Error querying user_private table:', error);
      return null;
    }

    if (!data) {
      return {
        userId: signedInUserId,
        interests: [],
        favoriteSpecies: [],
        onboardingDone: false,
        locationConsent: false,
        homeLat: null,
        homeLng: null,
        homeLabel: '',
      };
    }

    const locationConsent = Boolean(data.location_consent);
    const homeLat = locationConsent ? roundCoordTo2Decimals(data.home_lat) : null;
    const homeLng = locationConsent ? roundCoordTo2Decimals(data.home_lng) : null;

    return {
      userId: data.user_id,
      interests: Array.isArray(data.interests)
        ? data.interests.filter((x: unknown): x is string => typeof x === 'string')
        : [],
      favoriteSpecies: parseFavoriteSpeciesList(data.favorite_species),
      onboardingDone: data.onboarding_done === true,
      locationConsent,
      homeLat,
      homeLng,
      homeLabel:
        locationConsent && typeof data.home_label === 'string' ? data.home_label.trim() : '',
    };
  } catch (err) {
    console.error('Exception reading user_private:', err);
    return null;
  }
}

/**
 * Upserts ONLY the currently signed-in user's user_private row on user_id.
 * Rounds home_lat and home_lng to 2 decimals (~1 km).
 */
export async function upsertMyUserPrivate(
  payload: SaveUserPrivatePayload
): Promise<UserPrivateData> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please check your environment settings.');
  }

  const { data: userRes, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userRes?.user) {
    throw new Error('Please sign in to save your preferences.');
  }

  const signedInUserId = userRes.user.id;
  const roundedLat = payload.locationConsent ? roundCoordTo2Decimals(payload.homeLat) : null;
  const roundedLng = payload.locationConsent ? roundCoordTo2Decimals(payload.homeLng) : null;
  const cleanLabel = payload.locationConsent ? (payload.homeLabel || '').trim() : '';

  const row = {
    user_id: signedInUserId,
    interests: payload.interests,
    favorite_species: payload.favoriteSpecies,
    onboarding_done: payload.onboardingDone,
    location_consent: payload.locationConsent,
    home_lat: roundedLat,
    home_lng: roundedLng,
    home_label: cleanLabel,
  };

  const { error } = await supabase
    .from('user_private')
    .upsert([row], { onConflict: 'user_id' });

  if (error) {
    console.error('Supabase upsert user_private error:', error);
    throw new Error(error.message || 'Could not save your preferences.');
  }

  return {
    userId: signedInUserId,
    interests: payload.interests,
    favoriteSpecies: payload.favoriteSpecies,
    onboardingDone: payload.onboardingDone,
    locationConsent: payload.locationConsent,
    homeLat: roundedLat,
    homeLng: roundedLng,
    homeLabel: cleanLabel,
  };
}
