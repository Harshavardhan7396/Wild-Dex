import { FavoriteSpeciesItem } from '../contexts/AuthContext';
import { EnrichedSpecimenScanResult } from './scannerService';
import { SpecimenScanResult } from '../config/scannerPrompt';

export interface ForYouSpeciesItem {
  taxonId: number;
  commonName: string;
  scientificName: string;
  photoUrl: string;
  iconicTaxonName: string;
  category: SpecimenScanResult['category'];
  observationCount: number;
  conservationCode: 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';
  isEndangered: boolean;
  seenNearYou: boolean;
  relationLabel?: string;
}

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

interface AncestorInfo {
  genusId?: number;
  genusName?: string;
  familyId?: number;
  familyName?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory cache
const speciesCountsCache = new Map<string, CacheEntry<ForYouSpeciesItem[]>>();
const similarFavoritesCache = new Map<string, CacheEntry<ForYouSpeciesItem[]>>();
const taxonAncestorCache = new Map<string, AncestorInfo>();
const parentTaxaCache = new Map<string, any[]>();

export const INTEREST_TO_ICONIC_TAXA: Record<string, string[]> = {
  mammals: ['Mammalia'],
  birds: ['Aves'],
  reptiles: ['Reptilia'],
  insects: ['Insecta'],
  'marine life': ['Actinopterygii', 'Mollusca'],
  plants: ['Plantae'],
  trees: ['Plantae'],
  fungi: ['Fungi'],
  pets: ['Mammalia', 'Aves'],
  'farm animals': ['Mammalia', 'Aves'],
  crops: ['Plantae'],
};

export function mapInterestsToIconicTaxa(interests: string[]): string[] {
  const set = new Set<string>();
  for (const raw of interests) {
    const key = raw.trim().toLowerCase();
    const mapped = INTEREST_TO_ICONIC_TAXA[key];
    if (mapped) {
      for (const t of mapped) set.add(t);
    }
  }
  return Array.from(set);
}

function mapIconicTaxonToCategory(taxonName?: string): SpecimenScanResult['category'] {
  const t = (taxonName || '').toLowerCase();
  if (t.includes('mammalia')) return 'mammals';
  if (t.includes('aves')) return 'birds';
  if (t.includes('reptilia')) return 'reptiles';
  if (t.includes('amphibia')) return 'amphibians';
  if (t.includes('insecta') || t.includes('arachnida')) return 'insects';
  if (t.includes('actinopterygii') || t.includes('mollusca')) return 'marine';
  if (t.includes('plantae')) return 'plants';
  if (t.includes('fungi')) return 'fungi';
  return 'other';
}

function parseConservationStatus(taxon: any): {
  code: ForYouSpeciesItem['conservationCode'];
  isEndangered: boolean;
} {
  const cs = taxon?.conservation_status;
  const statuses: any[] = Array.isArray(taxon?.conservation_statuses)
    ? taxon.conservation_statuses
    : [];

  const candidates = [cs, ...statuses].filter(Boolean);
  let bestCode: ForYouSpeciesItem['conservationCode'] = 'LC';
  let endangered = Boolean(taxon?.threatened);

  for (const entry of candidates) {
    const statusStr = String(entry?.status || entry?.status_name || '').toUpperCase().trim();
    const iucnNum = typeof entry?.iucn === 'number' ? entry.iucn : 0;

    if (
      statusStr === 'CR' ||
      statusStr.includes('CRITICALLY') ||
      iucnNum >= 50
    ) {
      bestCode = iucnNum === 60 ? 'EW' : iucnNum === 70 ? 'EX' : 'CR';
      endangered = true;
      break;
    }
    if (
      statusStr === 'EN' ||
      statusStr === 'E' ||
      (statusStr.includes('ENDANGERED') && !statusStr.includes('CRITICALLY')) ||
      iucnNum === 40
    ) {
      bestCode = 'EN';
      endangered = true;
    } else if (
      statusStr === 'VU' ||
      statusStr === 'T' ||
      statusStr.includes('VULNERABLE') ||
      statusStr.includes('THREATENED') ||
      iucnNum === 30
    ) {
      if (bestCode === 'LC' || bestCode === 'NT') bestCode = 'VU';
      endangered = true;
    } else if (statusStr === 'NT' || statusStr.includes('NEAR THREATENED') || iucnNum === 20) {
      if (bestCode === 'LC') bestCode = 'NT';
    }
  }

  return { code: bestCode, isEndangered: endangered };
}

function mapTaxonToCard(
  taxon: any,
  observationCount: number,
  seenNearYou: boolean,
  relationLabel?: string
): ForYouSpeciesItem {
  const { code, isEndangered } = parseConservationStatus(taxon);
  const photoUrl =
    taxon?.default_photo?.medium_url ||
    taxon?.default_photo?.square_url ||
    taxon?.default_photo?.url ||
    '';

  return {
    taxonId: Number(taxon?.id || 0),
    commonName: taxon?.preferred_common_name || taxon?.english_common_name || taxon?.name || 'Unknown species',
    scientificName: taxon?.name || '',
    photoUrl,
    iconicTaxonName: taxon?.iconic_taxon_name || '',
    category: mapIconicTaxonToCategory(taxon?.iconic_taxon_name),
    observationCount: Number(observationCount || taxon?.observations_count || 0),
    conservationCode: code,
    isEndangered,
    seenNearYou: isEndangered ? false : seenNearYou,
    relationLabel,
  };
}

/**
 * Fetch personalized "For You" species using iNaturalist species_counts API.
 * Uses rounded home location (50km radius) when available, otherwise fetches worldwide popular species.
 */
export async function fetchForYouSpecies(params: {
  interests: string[];
  lat: number | null;
  lng: number | null;
  hasLocation: boolean;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}): Promise<ForYouSpeciesItem[]> {
  const { interests, lat, lng, hasLocation, forceRefresh = false, signal } = params;
  const iconicTaxa = mapInterestsToIconicTaxa(interests);
  const useLocation = Boolean(hasLocation && lat !== null && lng !== null);
  const roundedLat = useLocation && lat !== null ? Math.round(lat * 100) / 100 : null;
  const roundedLng = useLocation && lng !== null ? Math.round(lng * 100) / 100 : null;

  const cacheKey = `${useLocation ? `${roundedLat},${roundedLng}` : 'world'}|${iconicTaxa.join(',')}`;
  if (!forceRefresh) {
    const cached = speciesCountsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const queryParams = new URLSearchParams({
    locale: 'en',
    per_page: '12',
  });

  if (useLocation && roundedLat !== null && roundedLng !== null) {
    queryParams.set('lat', String(roundedLat));
    queryParams.set('lng', String(roundedLng));
    queryParams.set('radius', '50');
  }

  if (iconicTaxa.length > 0) {
    queryParams.set('iconic_taxa', iconicTaxa.join(','));
  }

  const url = `https://api.inaturalist.org/v1/observations/species_counts?${queryParams.toString()}`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`Could not load recommendations (${res.status})`);
    }
    const json = await res.json();
    const results = Array.isArray(json?.results) ? json.results : [];
    const items: ForYouSpeciesItem[] = results
      .filter((r: any) => r?.taxon?.id && r?.taxon?.name)
      .map((r: any) => mapTaxonToCard(r.taxon, Number(r.count || 0), useLocation));

    speciesCountsCache.set(cacheKey, { timestamp: Date.now(), data: items });
    return items;
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    console.error('fetchForYouSpecies error:', err);
    throw new Error(err?.message || 'Could not load personalized species suggestions.');
  }
}

async function fetchTaxonAncestors(
  fav: FavoriteSpeciesItem,
  signal?: AbortSignal
): Promise<AncestorInfo> {
  const key = fav.id > 0 ? `id:${fav.id}` : `name:${fav.scientificName.toLowerCase()}`;
  const cached = taxonAncestorCache.get(key);
  if (cached) return cached;

  const url =
    fav.id > 0
      ? `https://api.inaturalist.org/v1/taxa/${fav.id}?locale=en`
      : `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(
          fav.scientificName || fav.commonName
        )}&rank=species&locale=en&per_page=1`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to look up taxonomy (${res.status})`);
  }
  const json = await res.json();
  const taxon = Array.isArray(json?.results) ? json.results[0] : null;
  if (!taxon) {
    return {};
  }

  const ancestors: any[] = Array.isArray(taxon.ancestors) ? taxon.ancestors : [];
  const genus = ancestors.find((a) => a?.rank === 'genus');
  const family = ancestors.find((a) => a?.rank === 'family');

  const info: AncestorInfo = {
    genusId: genus?.id ? Number(genus.id) : taxon.rank === 'species' && taxon.parent_id ? Number(taxon.parent_id) : undefined,
    genusName: genus?.name,
    familyId: family?.id ? Number(family.id) : undefined,
    familyName: family?.name,
  };

  taxonAncestorCache.set(key, info);
  return info;
}

async function fetchSpeciesUnderParentTaxon(
  parentTaxonId: number,
  forceRefresh: boolean,
  signal?: AbortSignal
): Promise<any[]> {
  const key = `parent:${parentTaxonId}`;
  if (!forceRefresh && parentTaxaCache.has(key)) {
    return parentTaxaCache.get(key) || [];
  }

  const url = `https://api.inaturalist.org/v1/taxa?taxon_id=${parentTaxonId}&rank=species&is_active=true&locale=en&per_page=6`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Could not load similar taxa (${res.status})`);
  }
  const json = await res.json();
  const results = Array.isArray(json?.results) ? json.results : [];
  parentTaxaCache.set(key, results);
  return results;
}

/**
 * Fetch "Similar to your favorites": for each favorite species, fetch species
 * from the same genus or family using the iNaturalist taxa API.
 */
export async function fetchSimilarToFavorites(params: {
  favorites: FavoriteSpeciesItem[];
  forceRefresh?: boolean;
  signal?: AbortSignal;
}): Promise<ForYouSpeciesItem[]> {
  const { favorites, forceRefresh = false, signal } = params;
  if (!favorites || favorites.length === 0) return [];

  const cacheKey = favorites
    .map((f) => `${f.id}:${f.scientificName.toLowerCase()}`)
    .sort()
    .join('|');

  if (!forceRefresh) {
    const cached = similarFavoritesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const favoriteIds = new Set(favorites.map((f) => f.id).filter((id) => id > 0));
  const favoriteSciNames = new Set(favorites.map((f) => f.scientificName.toLowerCase()));

  const collected: ForYouSpeciesItem[] = [];
  const seenTaxonIds = new Set<number>();
  let successfulFavoriteCount = 0;
  let lastError: Error | null = null;

  const targetFavorites = favorites.slice(0, 6);

  const settled = await Promise.allSettled(
    targetFavorites.map(async (fav) => {
      const ancestors = await fetchTaxonAncestors(fav, signal);
      let candidates: any[] = [];
      let usedRank: 'genus' | 'family' = 'genus';

      if (ancestors.genusId) {
        candidates = await fetchSpeciesUnderParentTaxon(ancestors.genusId, forceRefresh, signal);
        candidates = candidates.filter(
          (t) =>
            !favoriteIds.has(Number(t?.id)) &&
            !favoriteSciNames.has(String(t?.name || '').toLowerCase())
        );
      }

      if (candidates.length === 0 && ancestors.familyId) {
        usedRank = 'family';
        candidates = await fetchSpeciesUnderParentTaxon(ancestors.familyId, forceRefresh, signal);
        candidates = candidates.filter(
          (t) =>
            !favoriteIds.has(Number(t?.id)) &&
            !favoriteSciNames.has(String(t?.name || '').toLowerCase())
        );
      }

      return candidates.slice(0, 3).map((t) =>
        mapTaxonToCard(
          t,
          Number(t?.observations_count || 0),
          false,
          `Same ${usedRank} as ${fav.commonName}`
        )
      );
    })
  );

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      successfulFavoriteCount += 1;
      for (const card of outcome.value) {
        if (card.taxonId > 0 && !seenTaxonIds.has(card.taxonId)) {
          seenTaxonIds.add(card.taxonId);
          collected.push(card);
        }
      }
    } else {
      if (outcome.reason?.name === 'AbortError') {
        throw outcome.reason;
      }
      lastError = outcome.reason instanceof Error ? outcome.reason : new Error('Network error');
    }
  }

  if (successfulFavoriteCount === 0 && lastError) {
    console.error('fetchSimilarToFavorites error:', lastError);
    throw new Error(lastError.message || 'Could not load similar species right now.');
  }

  similarFavoritesCache.set(cacheKey, { timestamp: Date.now(), data: collected });
  return collected;
}

export function buildScanResultFromForYou(item: ForYouSpeciesItem): EnrichedSpecimenScanResult {
  return {
    commonName: item.commonName,
    scientificName: item.scientificName,
    category: item.category,
    confidence: 1,
    notASpecies: false,
    taxonomicRank: 'species',
    reasoning: 'Added from WildDex personalized iNaturalist species recommendations.',
    safetyFlags: {
      venomous: false,
      toxic: false,
      endangered: item.isEndangered,
      invasive: false,
      harmless: true,
    },
    top3AlternateMatches: [],
    quickFacts: {
      habitat: 'Natural habitat',
      diet: 'Varies by species',
      lifespan: 'Varies in the wild',
      size: 'Typical adult range',
    },
    enrichedPhotos: item.photoUrl ? [item.photoUrl] : [],
    iNatObservationsCount: item.observationCount,
    iNatTaxonId: item.taxonId,
    conservationStatusCode: item.conservationCode,
  };
}

export function generateFallbackSpecimenDataUrl(commonName: string, scientificName: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#2d4b37';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e2efe6';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(commonName.slice(0, 28), canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = 'italic 18px sans-serif';
    ctx.fillStyle = '#b9d6c2';
    ctx.fillText(scientificName.slice(0, 32), canvas.width / 2, canvas.height / 2 + 24);
  }
  return canvas.toDataURL('image/jpeg', 0.85);
}
