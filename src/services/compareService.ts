export type CompareFilterType = 'all' | 'Animalia' | 'Plantae' | 'Fungi' | 'Insecta' | 'Aves';

export type ConservationLabel = 'In Danger' | 'At Risk' | 'Common' | 'Not Listed';

export type CompareSpeciesCategory =
  | 'plant'
  | 'fungi'
  | 'bird'
  | 'insect'
  | 'toothed_animal'
  | 'other_animal';

export interface TaxonSearchItem {
  id: number;
  commonName: string;
  scientificName: string;
  photoUrl: string;
  iconicTaxon: string;
}

export interface CompareFacts {
  adultWeight: string;
  bodySize: string;
  whereItLives: string;
  teethAndBite: string;
  whatItEats: string;
  plantHeight: string;
  leavesAndFlowers: string;
  whereItGrows: string;
  uses: string;
}

export interface CompareSpeciesDetail {
  id: number;
  commonName: string;
  scientificName: string;
  photoUrl: string;
  iconicTaxon: string;
  categoryKind: CompareSpeciesCategory;
  kingdom: string;
  taxonomyLine: string;
  conservationLabel: ConservationLabel;
  conservationRawCode: string;
  observationsCount: number | null;
  wikipediaSummary: string;
  wikipediaUrl: string;
  facts: CompareFacts;
}

export const QUICK_PICKS = [
  { label: 'Lion', query: 'Panthera leo' },
  { label: 'Tiger', query: 'Panthera tigris' },
  { label: 'Leopard', query: 'Panthera pardus' },
  { label: 'Elephant', query: 'Loxodonta africana' },
  { label: 'Oak', query: 'Quercus' },
  { label: 'Rose', query: 'Rosa' },
  { label: 'Mango tree', query: 'Mangifera indica' },
] as const;

const searchCache = new Map<string, TaxonSearchItem[]>();
const quickPickIdCache = new Map<string, number>();
const detailCache = new Map<number, CompareSpeciesDetail>();

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitSentences(text: string): string[] {
  if (!text) return [];
  return text
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 18 && !s.startsWith('=='));
}

function pickMatchingSentences(
  sentences: string[],
  regex: RegExp,
  maxSentences = 2
): string {
  const matches: string[] = [];
  for (const s of sentences) {
    if (regex.test(s)) {
      const cleaned = s.replace(/==+[^=]+==+/g, '').trim();
      if (cleaned && !matches.includes(cleaned)) {
        matches.push(cleaned);
      }
      if (matches.length >= maxSentences) break;
    }
  }
  return matches.length > 0 ? matches.join(' ') : 'Not available';
}

function extractMeasuredPhrase(sentences: string[], regex: RegExp): string {
  const matched = pickMatchingSentences(sentences, regex, 1);
  return matched;
}

function mapConservationStatus(taxon: any): {
  label: ConservationLabel;
  code: string;
} {
  const statusObj =
    taxon?.conservation_status ||
    (Array.isArray(taxon?.conservation_statuses) ? taxon.conservation_statuses[0] : null);
  const rawCode = String(statusObj?.status || '').toUpperCase().trim();
  const statusName = String(statusObj?.status_name || '').toLowerCase();

  if (
    rawCode === 'CR' ||
    rawCode === 'EN' ||
    rawCode === 'EW' ||
    rawCode === 'EX' ||
    statusName.includes('endangered') ||
    statusName.includes('extinct')
  ) {
    return { label: 'In Danger', code: rawCode || 'EN' };
  }

  if (
    rawCode === 'VU' ||
    rawCode === 'NT' ||
    statusName.includes('vulnerable') ||
    statusName.includes('near threatened') ||
    statusName.includes('threatened')
  ) {
    return { label: 'At Risk', code: rawCode || 'VU' };
  }

  if (rawCode === 'LC' || statusName.includes('least concern')) {
    return { label: 'Common', code: rawCode || 'LC' };
  }

  return { label: 'Not Listed', code: rawCode || '' };
}

function classifySpeciesCategory(taxon: any): {
  categoryKind: CompareSpeciesCategory;
  kingdom: string;
  taxonomyLine: string;
} {
  const iconic = String(taxon?.iconic_taxon_name || '');
  const ancestors: any[] = Array.isArray(taxon?.ancestors) ? taxon.ancestors : [];
  const ancestorNames = new Set(ancestors.map((a) => String(a?.name || '')));

  const kingdom =
    ancestors.find((a) => a.rank === 'kingdom')?.name ||
    (iconic === 'Plantae'
      ? 'Plantae'
      : iconic === 'Fungi'
      ? 'Fungi'
      : 'Animalia');

  const className = ancestors.find((a) => a.rank === 'class')?.name || '';
  const familyName = ancestors.find((a) => a.rank === 'family')?.name || '';
  const taxonomyParts = [kingdom, className, familyName].filter(Boolean);
  const taxonomyLine = taxonomyParts.join(' • ') || iconic || 'Species';

  if (iconic === 'Plantae' || kingdom === 'Plantae' || ancestorNames.has('Plantae')) {
    return { categoryKind: 'plant', kingdom: 'Plantae', taxonomyLine };
  }
  if (iconic === 'Fungi' || kingdom === 'Fungi' || ancestorNames.has('Fungi')) {
    return { categoryKind: 'fungi', kingdom: 'Fungi', taxonomyLine };
  }
  if (iconic === 'Aves' || className === 'Aves' || ancestorNames.has('Aves')) {
    return { categoryKind: 'bird', kingdom: 'Animalia', taxonomyLine };
  }
  if (
    iconic === 'Insecta' ||
    iconic === 'Arachnida' ||
    className === 'Insecta' ||
    ancestorNames.has('Insecta')
  ) {
    return { categoryKind: 'insect', kingdom: 'Animalia', taxonomyLine };
  }
  if (
    iconic === 'Mammalia' ||
    iconic === 'Reptilia' ||
    iconic === 'Amphibia' ||
    iconic === 'Actinopterygii' ||
    ancestorNames.has('Chordata')
  ) {
    return { categoryKind: 'toothed_animal', kingdom: 'Animalia', taxonomyLine };
  }

  return { categoryKind: 'other_animal', kingdom, taxonomyLine };
}

export async function searchTaxaForCompare(
  query: string,
  filter: CompareFilterType = 'all'
): Promise<TaxonSearchItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const cacheKey = `${filter}:${cleanQuery.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      q: cleanQuery,
      per_page: '15',
      locale: 'en',
    });
    if (filter !== 'all') {
      params.set('iconic_taxa', filter);
    }

    const res = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Search failed (HTTP ${res.status}).`);
    }

    const json = await res.json();
    const results: any[] = Array.isArray(json?.results) ? json.results : [];

    const mapped: TaxonSearchItem[] = results
      .filter((t) => t && t.id && t.name)
      .map((t) => ({
        id: Number(t.id),
        commonName: t.preferred_common_name || t.english_common_name || t.name,
        scientificName: t.name,
        photoUrl:
          t.default_photo?.medium_url ||
          t.default_photo?.url ||
          t.default_photo?.square_url ||
          '',
        iconicTaxon: t.iconic_taxon_name || '',
      }));

    searchCache.set(cacheKey, mapped);
    return mapped;
  } catch (err: any) {
    console.error('iNaturalist autocomplete error:', err);
    throw new Error(err?.message || 'Could not search species right now.');
  }
}

export async function resolveQuickPickTaxonId(query: string): Promise<number> {
  const key = query.trim().toLowerCase();
  const cached = quickPickIdCache.get(key);
  if (cached) return cached;

  const results = await searchTaxaForCompare(query, 'all');
  if (results.length === 0) {
    throw new Error(`Could not find "${query}" on iNaturalist.`);
  }
  const withPhoto = results.find((r) => Boolean(r.photoUrl)) || results[0];
  quickPickIdCache.set(key, withPhoto.id);
  return withPhoto.id;
}

async function fetchWikipediaSummaryAndExtract(
  wikiTitle: string
): Promise<{ summary: string; extractText: string; wikiUrl: string }> {
  const encodedTitle = encodeURIComponent(wikiTitle.replace(/\s+/g, '_'));
  let summary = '';
  let wikiUrl = `https://en.wikipedia.org/wiki/${encodedTitle}`;
  let extractText = '';

  const [summaryRes, extractRes] = await Promise.allSettled([
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`),
    fetch(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exchars=5500&titles=${encodeURIComponent(
        wikiTitle
      )}&redirects=1&format=json&origin=*`
    ),
  ]);

  if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
    try {
      const json = await summaryRes.value.json();
      if (typeof json?.extract === 'string' && json.extract.trim()) {
        summary = json.extract.trim();
      }
      if (typeof json?.content_urls?.desktop?.page === 'string') {
        wikiUrl = json.content_urls.desktop.page;
      }
    } catch {}
  }

  if (extractRes.status === 'fulfilled' && extractRes.value.ok) {
    try {
      const json = await extractRes.value.json();
      const pages = json?.query?.pages;
      if (pages && typeof pages === 'object') {
        const firstPage = Object.values(pages)[0] as any;
        if (typeof firstPage?.extract === 'string') {
          extractText = firstPage.extract;
        }
      }
    } catch {}
  }

  return { summary, extractText, wikiUrl };
}

function buildRealFacts(
  fullText: string,
  wikiSummary: string,
  categoryKind: CompareSpeciesCategory
): CompareFacts {
  const sentences = splitSentences(`${wikiSummary} ${fullText}`);

  const adultWeight = extractMeasuredPhrase(
    sentences,
    /\b(weigh|weighs|weight|mass|body mass)\b.*\b(\d+(?:[.,–-]\d+)?\s*(?:kg|kilograms?|g\b|grams?|lb|pounds?|tonnes?|tons?))\b|\b(\d+(?:[.,–-]\d+)?\s*(?:kg|kilograms?|lb|pounds?|tonnes?|tons?))\b.*\b(weigh|weight|mass|average|adult|male|female)\b/i
  );

  const bodySize = extractMeasuredPhrase(
    sentences,
    /\b(length|long|wingspan|body size|shoulder height|snout|head-and-body)\b.*\b(\d+(?:[.,–-]\d+)?\s*(?:cm|centimetres?|centimeters?|m\b|metres?|meters?|mm|ft|feet|in\b|inches?))\b|\b(\d+(?:[.,–-]\d+)?\s*(?:cm|m\b|metres?|meters?|ft|feet|inches?))\b.*\b(long|length|wingspan|tall|height)\b/i
  );

  const whereItLives = pickMatchingSentences(
    sentences,
    /\b(native to|found in|inhabits?|lives in|habitat|range|endemic to|distributed|forests?|savanna|grassland|wetlands?|rivers?|oceans?|reefs?|deserts?|mountains?|tropical|temperate)\b/i,
    2
  );

  const teethAndBite =
    categoryKind === 'plant' || categoryKind === 'fungi' || categoryKind === 'bird' || categoryKind === 'insect'
      ? 'Not available'
      : pickMatchingSentences(
          sentences,
          /\b(bite|psi|canine|canines|teeth|tooth|jaw|jaws|fangs?|tusk|tusks|molars?|dentition|beak|mandibles?)\b/i,
          2
        );

  const whatItEats =
    categoryKind === 'plant' || categoryKind === 'fungi'
      ? 'Not available'
      : pickMatchingSentences(
          sentences,
          /\b(diet|eats?|feeds? on|prey|carnivore|herbivore|omnivore|insectivore|hunts?|forages?|nectar|pollen|foliage|grazes?)\b/i,
          2
        );

  const plantHeight = extractMeasuredPhrase(
    sentences,
    /\b(grows? to|height|tall|reaches?|canopy|trunk|shrub|tree)\b.*\b(\d+(?:[.,–-]\d+)?\s*(?:m\b|metres?|meters?|cm|ft|feet))\b|\b(\d+(?:[.,–-]\d+)?\s*(?:m\b|metres?|meters?|ft|feet))\b.*\b(tall|high|height)\b/i
  );

  const leavesAndFlowers = pickMatchingSentences(
    sentences,
    /\b(leaf|leaves|foliage|flower|flowers|bloom|blossom|petal|petals|sepal|frond|needle|needles|deciduous|evergreen|inflorescence|fronds?)\b/i,
    2
  );

  const whereItGrows = pickMatchingSentences(
    sentences,
    /\b(native to|grows? in|cultivated in|soil|sunlight|shade|climate|tropical|temperate|woodland|forests?|meadows?|found in|habitat|wetlands?)\b/i,
    2
  );

  const uses = pickMatchingSentences(
    sentences,
    /\b(used for|uses?|edible|culinary|medicinal|medicine|timber|wood|ornamental|cultivated for|grown as|fruit|tea|oil|perfume|fiber|fibre|dye)\b/i,
    2
  );

  return {
    adultWeight,
    bodySize,
    whereItLives,
    teethAndBite,
    whatItEats,
    plantHeight,
    leavesAndFlowers,
    whereItGrows,
    uses,
  };
}

export async function fetchCompareTaxonById(
  idOrQuery: string | number
): Promise<CompareSpeciesDetail> {
  let numericId = Number(idOrQuery);

  if (!Number.isFinite(numericId) || numericId <= 0) {
    const cleanQuery = String(idOrQuery || '').replace(/[-_]+/g, ' ').trim();
    if (!cleanQuery) {
      throw new Error('Missing species identifier.');
    }
    numericId = await resolveQuickPickTaxonId(cleanQuery);
  }

  const cached = detailCache.get(numericId);
  if (cached) return cached;

  try {
    const res = await fetch(`https://api.inaturalist.org/v1/taxa/${numericId}`);
    if (!res.ok) {
      throw new Error(`Could not load species details (HTTP ${res.status}).`);
    }

    const json = await res.json();
    const taxon = Array.isArray(json?.results) ? json.results[0] : null;
    if (!taxon) {
      throw new Error('Species not found on iNaturalist.');
    }

    const commonName =
      taxon.preferred_common_name || taxon.english_common_name || taxon.name || 'Unknown Species';
    const scientificName = taxon.name || commonName;

    let wikiTitle = scientificName;
    if (typeof taxon.wikipedia_url === 'string' && taxon.wikipedia_url.includes('/wiki/')) {
      const slug = taxon.wikipedia_url.split('/wiki/')[1]?.split('#')[0];
      if (slug) {
        wikiTitle = decodeURIComponent(slug);
      }
    }

    const wiki = await fetchWikipediaSummaryAndExtract(wikiTitle);
    const fallbackSummary =
      typeof taxon.wikipedia_summary === 'string' ? stripHtml(taxon.wikipedia_summary) : '';
    const wikipediaSummary = wiki.summary || fallbackSummary || 'Not available';

    const { categoryKind, kingdom, taxonomyLine } = classifySpeciesCategory(taxon);
    const conservation = mapConservationStatus(taxon);

    const photoUrl =
      taxon.default_photo?.medium_url ||
      taxon.default_photo?.large_url ||
      taxon.default_photo?.url ||
      taxon.taxon_photos?.[0]?.photo?.medium_url ||
      '';

    const facts = buildRealFacts(
      wiki.extractText,
      wikipediaSummary === 'Not available' ? '' : wikipediaSummary,
      categoryKind
    );

    const detail: CompareSpeciesDetail = {
      id: Number(taxon.id),
      commonName,
      scientificName,
      photoUrl,
      iconicTaxon: taxon.iconic_taxon_name || kingdom,
      categoryKind,
      kingdom,
      taxonomyLine,
      conservationLabel: conservation.label,
      conservationRawCode: conservation.code,
      observationsCount:
        typeof taxon.observations_count === 'number' ? taxon.observations_count : null,
      wikipediaSummary,
      wikipediaUrl: taxon.wikipedia_url || wiki.wikiUrl,
      facts,
    };

    detailCache.set(numericId, detail);
    return detail;
  } catch (err: any) {
    console.error('Error loading compare taxon:', err);
    throw new Error(err?.message || 'Could not load species details.');
  }
}
