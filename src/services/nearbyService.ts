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

const OVERPASS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const overpassCache = new Map<string, CacheEntry<NearbyPlace[]>>();
const inFlightRequests = new Map<string, Promise<NearbyPlace[]>>();

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

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

function buildBoundingBox(lat: number, lng: number, radiusKm: number): string {
  const latDelta = radiusKm / 111.32;
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const lngDelta = radiusKm / (111.32 * cosLat);

  const south = Math.max(-85, lat - latDelta).toFixed(4);
  const north = Math.min(85, lat + latDelta).toFixed(4);
  const west = Math.max(-180, lng - lngDelta).toFixed(4);
  const east = Math.min(180, lng + lngDelta).toFixed(4);
  return `${south},${west},${north},${east}`;
}

export async function fetchNearbyWildlifePlaces(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}): Promise<NearbyPlace[]> {
  const { lat, lng, radiusKm, forceRefresh = false, signal } = params;
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}:${radiusKm}`;

  if (!forceRefresh) {
    const cached = overpassCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < OVERPASS_CACHE_TTL_MS) {
      return cached.data.map((p) => ({
        ...p,
        distanceKm: haversineKm(lat, lng, p.lat, p.lng),
      }));
    }

    const existingPromise = inFlightRequests.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }
  }

  const bbox = buildBoundingBox(lat, lng, radiusKm);
  const query = `
[out:json][timeout:18][bbox:${bbox}];
(
  nwr["leisure"="nature_reserve"];
  nwr["boundary"="protected_area"];
  nwr["boundary"="national_park"];
  nwr["tourism"="zoo"];
  nwr["tourism"="aquarium"];
  nwr["amenity"="animal_shelter"];
  nwr["amenity"="veterinary"];
  nwr["amenity"="animal_boarding"];
);
out center tags 200;
`.trim();

  const runFetch = async (): Promise<NearbyPlace[]> => {
    let elements: any[] | null = null;
    let lastError: Error | null = null;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const attemptController = new AbortController();
      const timeoutId = setTimeout(() => attemptController.abort(), 18000);
      const onParentAbort = () => attemptController.abort();
      signal?.addEventListener('abort', onParentAbort, { once: true });

      try {
        // Simple GET request avoids CORS preflight OPTIONS and works cleanly across Overpass mirrors
        const url = `${endpoint}?data=${encodeURIComponent(query)}`;
        const res = await fetch(url, { signal: attemptController.signal });

        if (!res.ok) {
          if (res.status === 429) {
            lastError = new Error(
              'Map search is busy right now. Please wait a moment and tap Retry.'
            );
          } else if (res.status === 504) {
            lastError = new Error(
              'Search took too long for this area. Try a smaller radius or tap Retry.'
            );
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
        if (err?.name === 'AbortError') {
          lastError = new Error(
            'Search timed out for this area. Try a smaller radius or tap Retry.'
          );
        } else {
          lastError = new Error(
            'Could not reach OpenStreetMap right now. Please wait a moment and tap Retry.'
          );
        }
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onParentAbort);
      }
    }

    if (elements === null) {
      const finalError =
        lastError ||
        new Error('Could not reach OpenStreetMap right now. Please wait a moment and tap Retry.');
      console.warn('Overpass lookup failed across mirrors:', finalError.message);
      throw finalError;
    }

    const seenIds = new Set<string>();
    const places: NearbyPlace[] = [];

    for (const el of elements) {
      const tags: Record<string, string> = el?.tags || {};
      const classified = classifyOsmTags(tags);
      if (!classified) continue;

      const elLat = typeof el.lat === 'number' ? el.lat : el?.center?.lat;
      const elLng = typeof el.lon === 'number' ? el.lon : el?.center?.lon;
      if (typeof elLat !== 'number' || typeof elLng !== 'number') continue;

      const distanceKm = haversineKm(lat, lng, elLat, elLng);
      if (distanceKm > radiusKm * 1.15) continue;

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
    }

    places.sort((a, b) => a.distanceKm - b.distanceKm);
    overpassCache.set(cacheKey, { timestamp: Date.now(), data: places });
    return places;
  };

  const promise = runFetch().finally(() => {
    inFlightRequests.delete(cacheKey);
  });

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

export async function searchCityNominatim(
  query: string,
  signal?: AbortSignal
): Promise<NominatimCityResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      trimmed
    )}&limit=5`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`City search failed (${res.status}).`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
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
