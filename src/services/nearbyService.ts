import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type NearbyCategory = 'reserve' | 'zoo' | 'shelter' | 'vet';

export interface NearbyPlace {
  id: string;
  name: string;
  typeLabel: string;
  category: NearbyCategory;
  lat: number;
  lng: number;
  distanceKm: number;
  website?: string;
  phone?: string;
}

export interface NominatimCityResult {
  place_id: number;
  display_name: string;
  lat: number;
  lng: number;
}

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

export const DEFAULT_NEARBY_RADIUS_KM = 10;
export const MAX_NEARBY_RADIUS_KM = 25;
export const OVERPASS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const OVERPASS_SERVER_TIMEOUT_MS = 12 * 1000; // 12 seconds per mirror
export const OVERPASS_TOTAL_TIMEOUT_MS = 25 * 1000; // 25 seconds total deadline
export const OVERPASS_TIMEOUT_MESSAGE =
  'This area is taking too long. Try a smaller radius or another filter.';

const CACHE_STORAGE_PREFIX = 'wilddex_nearby:v1:';
const ALL_CATEGORY_IDS: NearbyCategory[] = ['reserve', 'zoo', 'shelter', 'vet'];

const overpassCache = new Map<string, CacheEntry<NearbyPlace[]>>();

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;

let lastNominatimRequestAt = 0;

export function clampNearbyRadiusKm(radiusKm: number): number {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    return DEFAULT_NEARBY_RADIUS_KM;
  }
  return Math.min(MAX_NEARBY_RADIUS_KM, Math.max(1, radiusKm));
}

export function normalizeNearbyCategories(
  categories?: NearbyCategory[] | Set<NearbyCategory>
): NearbyCategory[] {
  if (!categories) return [...ALL_CATEGORY_IDS];
  const arr = Array.isArray(categories) ? categories : Array.from(categories);
  const valid = Array.from(
    new Set(arr.filter((c): c is NearbyCategory => ALL_CATEGORY_IDS.includes(c)))
  ).sort();
  return valid.length > 0 ? valid : [...ALL_CATEGORY_IDS];
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return '';
  if (km < 1) {
    return `${Math.max(50, Math.round(km * 1000))} m away`;
  }
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

function normalizeWebsite(raw?: string): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return `https://${trimmed}`;
  }
  return undefined;
}

function classifyOsmTags(tags: Record<string, string>): {
  category: NearbyCategory;
  typeLabel: string;
} | null {
  const leisure = tags.leisure;
  const boundary = tags.boundary;
  const tourism = tags.tourism;
  const amenity = tags.amenity;

  if (boundary === 'national_park') {
    return { category: 'reserve', typeLabel: 'National Park' };
  }
  if (leisure === 'nature_reserve') {
    return { category: 'reserve', typeLabel: 'Nature Reserve' };
  }
  if (boundary === 'protected_area') {
    return { category: 'reserve', typeLabel: 'Protected Area' };
  }
  if (tourism === 'aquarium') {
    return { category: 'zoo', typeLabel: 'Aquarium' };
  }
  if (tourism === 'zoo') {
    return { category: 'zoo', typeLabel: 'Zoo' };
  }
  if (amenity === 'animal_shelter') {
    return { category: 'shelter', typeLabel: 'Animal Shelter' };
  }
  if (amenity === 'animal_boarding') {
    return { category: 'shelter', typeLabel: 'Animal Boarding & Care' };
  }
  if (amenity === 'veterinary') {
    return { category: 'vet', typeLabel: 'Veterinary Clinic' };
  }
  return null;
}

function buildCacheKey(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  categories?: NearbyCategory[] | Set<NearbyCategory>;
}): string {
  const clampedRadius = clampNearbyRadiusKm(params.radiusKm);
  const cats = normalizeNearbyCategories(params.categories);
  return `${CACHE_STORAGE_PREFIX}${params.lat.toFixed(2)},${params.lng.toFixed(
    2
  )}:${clampedRadius}:${cats.join(',')}`;
}

function hydrateCachedList(
  list: NearbyPlace[],
  lat: number,
  lng: number
): NearbyPlace[] {
  return list
    .map((p) => ({
      ...p,
      distanceKm: haversineKm(lat, lng, p.lat, p.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Read 30-minute memory or localStorage cache for a rounded location, radius, and filters.
 */
export function getCachedNearbyPlaces(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  categories?: NearbyCategory[] | Set<NearbyCategory>;
}): NearbyPlace[] | null {
  const key = buildCacheKey(params);
  const now = Date.now();

  const memEntry = overpassCache.get(key);
  if (memEntry) {
    if (now - memEntry.timestamp < OVERPASS_CACHE_TTL_MS) {
      return hydrateCachedList(memEntry.data, params.lat, params.lng);
    }
    overpassCache.delete(key);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<NearbyPlace[]>;
        if (
          parsed &&
          typeof parsed.timestamp === 'number' &&
          Array.isArray(parsed.data) &&
          now - parsed.timestamp < OVERPASS_CACHE_TTL_MS
        ) {
          overpassCache.set(key, parsed);
          return hydrateCachedList(parsed.data, params.lat, params.lng);
        }
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage read/parse errors
    }
  }

  return null;
}

function setCachedNearbyPlaces(key: string, data: NearbyPlace[]): void {
  const entry: CacheEntry<NearbyPlace[]> = {
    timestamp: Date.now(),
    data,
  };
  overpassCache.set(key, entry);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // Evict older nearby cache entries if quota is full and retry once
      try {
        const keysToDelete: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(CACHE_STORAGE_PREFIX)) {
            keysToDelete.push(k);
          }
        }
        for (const k of keysToDelete.slice(0, Math.ceil(keysToDelete.length / 2))) {
          window.localStorage.removeItem(k);
        }
        window.localStorage.setItem(key, JSON.stringify(entry));
      } catch {
        // Ignore storage write failure
      }
    }
  }
}

function buildOverpassQuery(
  lat: number,
  lng: number,
  radiusKm: number,
  categories: NearbyCategory[]
): string {
  const clampedRadius = clampNearbyRadiusKm(radiusKm);
  const radiusMeters = Math.round(clampedRadius * 1000);
  const latStr = lat.toFixed(5);
  const lngStr = lng.toFixed(5);
  const around = `around:${radiusMeters},${latStr},${lngStr}`;

  const statements: string[] = [];
  if (categories.includes('reserve')) {
    statements.push(`  nwr(${around})["leisure"="nature_reserve"];`);
    statements.push(`  nwr(${around})["boundary"="protected_area"];`);
    statements.push(`  nwr(${around})["boundary"="national_park"];`);
  }
  if (categories.includes('zoo')) {
    statements.push(`  nwr(${around})["tourism"="zoo"];`);
    statements.push(`  nwr(${around})["tourism"="aquarium"];`);
  }
  if (categories.includes('shelter')) {
    statements.push(`  nwr(${around})["amenity"="animal_shelter"];`);
    statements.push(`  nwr(${around})["amenity"="animal_boarding"];`);
  }
  if (categories.includes('vet')) {
    statements.push(`  nwr(${around})["amenity"="veterinary"];`);
  }

  return `[out:json][timeout:20];
(
${statements.join('\n')}
);
out center 60;`;
}

export async function fetchNearbyWildlifePlaces(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  categories?: NearbyCategory[] | Set<NearbyCategory>;
  forceRefresh?: boolean;
  skipCacheRead?: boolean;
  signal?: AbortSignal;
}): Promise<NearbyPlace[]> {
  const {
    lat,
    lng,
    radiusKm,
    categories,
    forceRefresh = false,
    skipCacheRead = false,
    signal,
  } = params;

  const clampedRadius = clampNearbyRadiusKm(radiusKm);
  const activeCategories = normalizeNearbyCategories(categories);
  const cacheKey = buildCacheKey({
    lat,
    lng,
    radiusKm: clampedRadius,
    categories: activeCategories,
  });

  if (!forceRefresh && !skipCacheRead) {
    const cached = getCachedNearbyPlaces({
      lat,
      lng,
      radiusKm: clampedRadius,
      categories: activeCategories,
    });
    if (cached) {
      return cached;
    }
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const query = buildOverpassQuery(lat, lng, clampedRadius, activeCategories);
  const startedAt = Date.now();
  let totalTimedOut = false;

  let activeAttemptController: AbortController | null = null;
  const totalTimeoutId = setTimeout(() => {
    totalTimedOut = true;
    activeAttemptController?.abort();
  }, OVERPASS_TOTAL_TIMEOUT_MS);

  try {
    let elements: any[] | null = null;
    let lastError: Error | null = null;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      if (totalTimedOut) {
        throw new Error(OVERPASS_TIMEOUT_MESSAGE);
      }

      const elapsedMs = Date.now() - startedAt;
      const remainingTotalMs = OVERPASS_TOTAL_TIMEOUT_MS - elapsedMs;
      if (remainingTotalMs <= 200) {
        totalTimedOut = true;
        throw new Error(OVERPASS_TIMEOUT_MESSAGE);
      }

      const attemptController = new AbortController();
      activeAttemptController = attemptController;
      let attemptTimedOut = false;

      const perServerMs = Math.min(OVERPASS_SERVER_TIMEOUT_MS, remainingTotalMs);
      const serverTimeoutId = setTimeout(() => {
        attemptTimedOut = true;
        attemptController.abort();
      }, perServerMs);

      const onParentAbort = () => attemptController.abort();
      signal?.addEventListener('abort', onParentAbort, { once: true });

      try {
        const url = `${endpoint}?data=${encodeURIComponent(query)}`;
        const res = await fetch(url, { signal: attemptController.signal });

        if (!res.ok) {
          if (res.status === 429) {
            lastError = new Error(
              'Map search is busy right now. Please wait a moment and tap Retry.'
            );
          } else if (res.status === 504) {
            lastError = new Error(OVERPASS_TIMEOUT_MESSAGE);
          } else {
            lastError = new Error(`Could not load nearby places (${res.status}).`);
          }
          continue;
        }

        const json = await res.json();
        elements = Array.isArray(json?.elements) ? json.elements : [];
        break;
      } catch (err: any) {
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        if (totalTimedOut) {
          throw new Error(OVERPASS_TIMEOUT_MESSAGE);
        }
        if (attemptTimedOut || err?.name === 'AbortError') {
          lastError = new Error(OVERPASS_TIMEOUT_MESSAGE);
          continue;
        }
        lastError = new Error(
          'Could not reach OpenStreetMap right now. Please wait a moment and tap Retry.'
        );
      } finally {
        clearTimeout(serverTimeoutId);
        signal?.removeEventListener('abort', onParentAbort);
        if (activeAttemptController === attemptController) {
          activeAttemptController = null;
        }
      }
    }

    if (elements === null) {
      if (totalTimedOut) {
        throw new Error(OVERPASS_TIMEOUT_MESSAGE);
      }
      const finalError =
        lastError ||
        new Error(
          'Could not reach OpenStreetMap right now. Please wait a moment and tap Retry.'
        );
      console.warn('Overpass lookup failed across mirrors:', finalError.message);
      throw finalError;
    }

    const seenIds = new Set<string>();
    const activeCatSet = new Set<NearbyCategory>(activeCategories);
    const places: NearbyPlace[] = [];

    for (const el of elements) {
      const tags: Record<string, string> = el?.tags || {};
      const classified = classifyOsmTags(tags);
      if (!classified || !activeCatSet.has(classified.category)) continue;

      const elLat = typeof el.lat === 'number' ? el.lat : el?.center?.lat;
      const elLng = typeof el.lon === 'number' ? el.lon : el?.center?.lon;
      if (typeof elLat !== 'number' || typeof elLng !== 'number') continue;

      const distanceKm = haversineKm(lat, lng, elLat, elLng);
      if (distanceKm > clampedRadius * 1.15) continue;

      const uniqueId = `${el.type || 'node'}-${el.id}`;
      if (seenIds.has(uniqueId)) continue;
      seenIds.add(uniqueId);

      const rawName = tags.name || tags['name:en'] || tags.official_name || '';
      const name = rawName.trim() || classified.typeLabel;
      const website = normalizeWebsite(
        tags.website || tags['contact:website'] || tags.url
      );
      const phone = (tags.phone || tags['contact:phone'] || '').trim() || undefined;

      places.push({
        id: uniqueId,
        name,
        typeLabel: classified.typeLabel,
        category: classified.category,
        lat: elLat,
        lng: elLng,
        distanceKm,
        website,
        phone,
      });

      if (places.length >= 60) break;
    }

    places.sort((a, b) => a.distanceKm - b.distanceKm);
    setCachedNearbyPlaces(cacheKey, places);
    return places;
  } finally {
    clearTimeout(totalTimeoutId);
  }
}

async function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Search cities using Nominatim with 1 req/sec rate limit, limit=1, and polite headers.
 */
export async function searchCityNominatim(
  query: string,
  signal?: AbortSignal
): Promise<NominatimCityResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // Enforce max 1 request per second
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < 1000) {
    await waitWithAbort(1000 - elapsed, signal);
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  lastNominatimRequestAt = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      trimmed
    )}&limit=1`;
    const res = await fetch(url, {
      signal,
      referrerPolicy: 'strict-origin-when-cross-origin',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
    });
    if (!res.ok) {
      throw new Error(`City search failed (${res.status}).`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .slice(0, 1)
      .map((item: any): NominatimCityResult | null => {
        const lat = Number(item?.lat);
        const lng = Number(item?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          place_id: Number(item.place_id),
          display_name: String(item.display_name || ''),
          lat,
          lng,
        };
      })
      .filter((x): x is NominatimCityResult => x !== null);
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    console.warn('Nominatim search warning:', err?.message || err);
    throw new Error('Could not search cities right now. Please try again.');
  }
}

// ==============================================================================
// Web Search ("Search the web for more places" via Supabase Edge Function `nearby`)
// ==============================================================================

export interface WebNearbyPlace {
  name: string;
  type: string;
  whatYouCanSee: string;
  distanceHint: string;
  website?: string;
}

export interface WebNearbySource {
  title: string;
  url: string;
}

export interface WebNearbyResult {
  city: string;
  places: WebNearbyPlace[];
  sources: WebNearbySource[];
}

export const WEB_NEARBY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const WEB_NEARBY_TIMEOUT_MS = 45 * 1000; // 45 seconds
export const WEB_NEARBY_COOLDOWN_MS = 10 * 1000; // 10 seconds
export const WEB_NEARBY_429_BLOCK_MS = 30 * 60 * 1000; // 30 minutes
export const WEB_NEARBY_DAILY_LIMIT_MESSAGE =
  'Web search is at its daily limit. Showing places from OpenStreetMap instead';

const WEB_NEARBY_CACHE_PREFIX = 'wilddex_nearby_web:v1:';
const WEB_NEARBY_BLOCK_PREFIX = 'wilddex_nearby_web_block:v1:';
const webNearbyBlockedUntilMap = new Map<string, number>();
let lastWebNearbyRequestAt = 0;

export class WebNearbyRateLimitError extends Error {
  status = 429;
  isRateLimited = true;
  constructor(message = WEB_NEARBY_DAILY_LIMIT_MESSAGE) {
    super(message);
    this.name = 'WebNearbyRateLimitError';
  }
}

function normalizeCityCacheKey(city: string): string {
  return `${WEB_NEARBY_CACHE_PREFIX}${city.trim().toLowerCase()}`;
}

function normalizeCityBlockKey(city: string): string {
  return `${WEB_NEARBY_BLOCK_PREFIX}${city.trim().toLowerCase()}`;
}

export function isWebNearbyCityBlocked(city: string): boolean {
  const trimmed = city.trim().toLowerCase();
  if (!trimmed) return false;

  const now = Date.now();
  const memUntil = webNearbyBlockedUntilMap.get(trimmed);
  if (typeof memUntil === 'number') {
    if (now < memUntil) return true;
    webNearbyBlockedUntilMap.delete(trimmed);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    const key = normalizeCityBlockKey(trimmed);
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { blockedUntil?: number };
        if (typeof parsed?.blockedUntil === 'number' && now < parsed.blockedUntil) {
          webNearbyBlockedUntilMap.set(trimmed, parsed.blockedUntil);
          return true;
        }
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage read errors
    }
  }

  return false;
}

function blockWebNearbyForCity(city: string): void {
  const trimmed = city.trim().toLowerCase();
  if (!trimmed) return;
  const blockedUntil = Date.now() + WEB_NEARBY_429_BLOCK_MS;
  webNearbyBlockedUntilMap.set(trimmed, blockedUntil);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        normalizeCityBlockKey(trimmed),
        JSON.stringify({ blockedUntil })
      );
    } catch {
      // Ignore storage write errors
    }
  }
}

export function getWebNearbyCooldownRemainingSeconds(): number {
  if (!lastWebNearbyRequestAt) return 0;
  const remainingMs = WEB_NEARBY_COOLDOWN_MS - (Date.now() - lastWebNearbyRequestAt);
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export function getCachedWebNearbyPlaces(city: string): WebNearbyResult | null {
  const trimmed = city.trim();
  if (!trimmed || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const key = normalizeCityCacheKey(trimmed);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<WebNearbyResult>;
    if (
      parsed &&
      typeof parsed.timestamp === 'number' &&
      parsed.data &&
      Array.isArray(parsed.data.places) &&
      Date.now() - parsed.timestamp < WEB_NEARBY_CACHE_TTL_MS
    ) {
      return parsed.data;
    }
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage read/parse errors
  }

  return null;
}

function setCachedWebNearbyPlaces(city: string, data: WebNearbyResult): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const key = normalizeCityCacheKey(city);
  const entry: CacheEntry<WebNearbyResult> = {
    timestamp: Date.now(),
    data,
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore storage write errors
  }
}

function normalizeWebUrl(raw?: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw.trim();
  if (!cleaned) return undefined;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (cleaned.includes('.') && !cleaned.includes(' ')) {
    return `https://${cleaned}`;
  }
  return undefined;
}

export async function searchMorePlacesOnWeb(params: {
  city: string;
  forceRefresh?: boolean;
}): Promise<WebNearbyResult> {
  const city = params.city.trim();
  if (!city) {
    throw new Error('Select or search a city first.');
  }

  if (isWebNearbyCityBlocked(city)) {
    throw new WebNearbyRateLimitError();
  }

  if (!params.forceRefresh) {
    const cached = getCachedWebNearbyPlaces(city);
    if (cached) {
      return cached;
    }
  }

  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const waitSeconds = getWebNearbyCooldownRemainingSeconds();
  if (waitSeconds > 0) {
    throw new Error(
      `Please wait ${waitSeconds}s before searching the web again.`
    );
  }

  lastWebNearbyRequestAt = Date.now();

  const abortController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, WEB_NEARBY_TIMEOUT_MS);

  try {
    const invokeResult: any = await supabase.functions.invoke('nearby', {
      body: { city },
      timeout: WEB_NEARBY_TIMEOUT_MS,
      signal: abortController.signal,
    } as any);

    const { data, error } = invokeResult || {};

    if (error || data?.error) {
      const statusCode: number | undefined =
        error?.context?.status ?? error?.status ?? data?.status;

      let parsedErr: any = null;
      if (error?.context && typeof error.context.json === 'function') {
        try {
          parsedErr = await error.context.json();
        } catch {
          if (typeof error.context.text === 'function') {
            try {
              const text = await error.context.text();
              parsedErr = JSON.parse(text);
            } catch {
              // Ignore secondary parse error
            }
          }
        }
      } else if (data?.error) {
        parsedErr = data;
      }

      const extractedMessage =
        (parsedErr &&
          typeof parsedErr === 'object' &&
          (parsedErr.error || parsedErr.message)) ||
        (typeof parsedErr === 'string' && parsedErr) ||
        (typeof data?.error === 'string' && data.error) ||
        error?.message ||
        'Web search failed. Please try again.';

      const is429 =
        statusCode === 429 ||
        parsedErr?.status === 429 ||
        String(extractedMessage).includes('429');

      if (is429) {
        blockWebNearbyForCity(city);
        throw new WebNearbyRateLimitError();
      }

      throw new Error(String(extractedMessage));
    }

    const rawPlaces: any[] = Array.isArray(data?.places)
      ? data.places
      : Array.isArray(data?.results)
      ? data.results
      : [];

    const places: WebNearbyPlace[] = rawPlaces
      .filter((p) => p && (p.name || p.title))
      .map((p) => {
        const whatRaw =
          p.whatYouCanSee ??
          p.what_you_can_see ??
          p.wildlife ??
          p.species ??
          p.highlights ??
          p.description ??
          '';
        const whatYouCanSee = Array.isArray(whatRaw)
          ? whatRaw.filter(Boolean).join(', ')
          : String(whatRaw || '').trim();

        return {
          name: String(p.name || p.title).trim(),
          type: String(p.type || p.category || p.typeLabel || 'Wildlife Place').trim(),
          whatYouCanSee,
          distanceHint: String(
            p.distanceHint || p.distance_hint || p.distance || ''
          ).trim(),
          website: normalizeWebUrl(p.website || p.url || p.link),
        };
      });

    const rawSources: any[] = Array.isArray(data?.sources)
      ? data.sources
      : Array.isArray(data?.citations)
      ? data.citations
      : [];

    const seenSourceUrls = new Set<string>();
    const sources: WebNearbySource[] = [];

    for (const s of rawSources) {
      if (typeof s === 'string') {
        const url = normalizeWebUrl(s);
        if (url && !seenSourceUrls.has(url)) {
          seenSourceUrls.add(url);
          sources.push({ title: url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0], url });
        }
      } else if (s && typeof s === 'object') {
        const url = normalizeWebUrl(s.url || s.uri || s.link);
        if (url && !seenSourceUrls.has(url)) {
          seenSourceUrls.add(url);
          const fallbackHost = url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0];
          sources.push({
            title: String(s.title || s.name || fallbackHost).trim() || fallbackHost,
            url,
          });
        }
      }
    }

    const result: WebNearbyResult = {
      city,
      places,
      sources,
    };

    setCachedWebNearbyPlaces(city, result);
    return result;
  } catch (err: any) {
    if (err instanceof WebNearbyRateLimitError) {
      throw err;
    }
    if (timedOut || err?.name === 'AbortError') {
      throw new Error('Web search timed out after 45 seconds. Please try again.');
    }
    throw err instanceof Error ? err : new Error('Web search failed. Please try again.');
  } finally {
    clearTimeout(timeoutId);
  }
}
