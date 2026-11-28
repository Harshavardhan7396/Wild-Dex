import type { SpecimenScanResult } from '../config/scannerPrompt';
import type { SpeciesRarity, TaxonomySource, VerificationStatus } from '../types/wilddex2';

export interface ServerScanVerificationResult {
  scanVerificationId: string | null;
  speciesKey: string;
  commonName: string;
  scientificName: string;
  category: SpecimenScanResult['category'];
  iNatTaxonId: number | null;
  iucnStatus: string;
  serverRarity: SpeciesRarity;
  taxonomySource: TaxonomySource;
  verificationStatus: VerificationStatus;
  isTaxonomyConfirmed: boolean;
}

const TRUSTED_SEED_TAXA: Record<
  string,
  { iNatTaxonId: number; iucnStatus: string; category: SpecimenScanResult['category'] }
> = {
  'danaus plexippus': { iNatTaxonId: 48662, iucnStatus: 'LC', category: 'insects' },
  'ailurus fulgens': { iNatTaxonId: 41655, iucnStatus: 'EN', category: 'mammals' },
  'amanita muscaria': { iNatTaxonId: 48715, iucnStatus: 'LC', category: 'fungi' },
  'apis mellifera': { iNatTaxonId: 47219, iucnStatus: 'LC', category: 'insects' },
  'canis lupus': { iNatTaxonId: 42048, iucnStatus: 'LC', category: 'mammals' },
  'enhydra lutris': { iNatTaxonId: 41860, iucnStatus: 'EN', category: 'marine' },
  'nucifraga columbiana': { iNatTaxonId: 8319, iucnStatus: 'LC', category: 'birds' },
  'panthera leo': { iNatTaxonId: 41964, iucnStatus: 'VU', category: 'mammals' },
  'crotalus atrox': { iNatTaxonId: 30750, iucnStatus: 'LC', category: 'reptiles' },
  'asclepias syriaca': { iNatTaxonId: 47911, iucnStatus: 'LC', category: 'plants' },
};

export function normalizeSpeciesKey(scientificName?: string, commonName?: string): string {
  const raw = (scientificName && scientificName.trim()) || commonName || '';
  return raw.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 180);
}

export function deriveRarityFromIucn(iucnStatus?: string): SpeciesRarity {
  const code = (iucnStatus || '').toUpperCase().trim();
  if (code === 'CR' || code === 'EW' || code === 'EX') return 'legendary';
  if (code === 'EN' || code === 'VU') return 'rare';
  if (code === 'NT') return 'uncommon';
  return 'common';
}

function mapInatIconicTaxonToCategory(
  iconic?: string,
  fallback?: SpecimenScanResult['category']
): SpecimenScanResult['category'] {
  const val = (iconic || '').toLowerCase();
  if (val === 'mammalia') return 'mammals';
  if (val === 'aves') return 'birds';
  if (val === 'reptilia') return 'reptiles';
  if (val === 'amphibia') return 'amphibians';
  if (val === 'insecta' || val === 'arachnida') return 'insects';
  if (val === 'actinopterygii' || val === 'mollusca') return 'marine';
  if (val === 'plantae') return 'plants';
  if (val === 'fungi') return 'fungi';
  return fallback || 'other';
}

function parseIucnCode(statusName?: string, statusCode?: string): string {
  const rawCode = (statusCode || '').toUpperCase().trim();
  if (['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'NE'].includes(rawCode)) {
    return rawCode;
  }
  const rawName = (statusName || '').toUpperCase();
  if (rawName.includes('CRITICAL')) return 'CR';
  if (rawName.includes('EXTINCT IN THE WILD')) return 'EW';
  if (rawName.includes('EXTINCT')) return 'EX';
  if (rawName.includes('ENDANGER')) return 'EN';
  if (rawName.includes('VULNERABLE')) return 'VU';
  if (rawName.includes('NEAR')) return 'NT';
  if (rawName.includes('LEAST')) return 'LC';
  return 'NE';
}

/**
 * Verifies a Gemini specimen scan server-side against trusted taxonomy data and iNaturalist,
 * derives server-authoritative rarity & IUCN conservation status (never from client payloads),
 * and issues a single-use attestation in `public.scan_verifications` when SUPABASE_SERVICE_ROLE_KEY is set.
 */
export async function verifyAndIssueScanAttestation(params: {
  userId: string | null;
  scan: SpecimenScanResult;
}): Promise<ServerScanVerificationResult> {
  const { userId, scan } = params;
  const speciesKey = normalizeSpeciesKey(scan.scientificName, scan.commonName);

  const isBiologicalCandidate =
    !scan.notASpecies &&
    scan.confidence >= 0.5 &&
    speciesKey.length >= 2 &&
    !['n/a', 'not a living species', 'unknown', 'unknown species'].includes(speciesKey);

  let iNatTaxonId: number | null = null;
  let iucnStatus = 'NE';
  let serverRarity: SpeciesRarity = 'common';
  let verifiedCategory: SpecimenScanResult['category'] = scan.category || 'other';
  let verifiedScientific = scan.scientificName;
  let verifiedCommon = scan.commonName;
  let taxonomySource: TaxonomySource = 'ai_unverified';
  let isTaxonomyConfirmed = false;

  const catalogMatch = TRUSTED_SEED_TAXA[speciesKey];
  if (isBiologicalCandidate && catalogMatch) {
    iNatTaxonId = catalogMatch.iNatTaxonId;
    iucnStatus = catalogMatch.iucnStatus;
    serverRarity = deriveRarityFromIucn(catalogMatch.iucnStatus);
    verifiedCategory = catalogMatch.category;
    taxonomySource = 'trusted_catalog';
    isTaxonomyConfirmed = true;
  } else if (
    isBiologicalCandidate &&
    (scan.taxonomicRank === 'species' || scan.taxonomicRank === 'subspecies') &&
    !/\bsp\.?$/i.test(speciesKey)
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(
        scan.scientificName.trim()
      )}&rank=species,subspecies&per_page=5`;
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) {
        const json = (await res.json()) as { results?: any[] };
        const exact = (json.results || []).find(
          (t) => typeof t?.name === 'string' && t.name.toLowerCase().trim() === speciesKey
        );
        if (exact && typeof exact.id === 'number' && exact.id > 0) {
          iNatTaxonId = exact.id;
          verifiedScientific = exact.name || scan.scientificName;
          verifiedCommon = exact.preferred_common_name || scan.commonName;
          verifiedCategory = mapInatIconicTaxonToCategory(
            exact.iconic_taxon_name,
            scan.category
          );
          iucnStatus = parseIucnCode(
            exact.conservation_status?.status_name,
            exact.conservation_status?.status
          );
          serverRarity = deriveRarityFromIucn(iucnStatus);
          taxonomySource = 'inaturalist_api';
          isTaxonomyConfirmed = true;
        }
      }
    } catch (err: any) {
      console.warn('Server-side iNaturalist taxonomy check skipped:', err?.message || err);
    } finally {
      clearTimeout(timer);
    }
  }

  if (!isTaxonomyConfirmed) {
    serverRarity = 'common';
    iucnStatus = 'NE';
    taxonomySource = 'ai_unverified';
  }

  const verificationStatus: VerificationStatus = isTaxonomyConfirmed
    ? 'verified_taxonomy'
    : 'scanner_unverified';

  let scanVerificationId: string | null = null;
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (userId && supabaseUrl && serviceRoleKey && isBiologicalCandidate) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/scan_verifications`, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          user_id: userId,
          species_key: normalizeSpeciesKey(verifiedScientific, verifiedCommon),
          common_name: verifiedCommon.slice(0, 180),
          scientific_name: verifiedScientific.slice(0, 180),
          category: verifiedCategory,
          confidence: Math.max(0, Math.min(1, Number(scan.confidence) || 0)),
          taxonomic_rank: scan.taxonomicRank || 'unknown',
          not_a_species: Boolean(scan.notASpecies),
          inat_taxon_id: iNatTaxonId,
          iucn_status: iucnStatus,
          server_rarity: serverRarity,
          taxonomy_source: taxonomySource,
          is_taxonomy_confirmed: isTaxonomyConfirmed,
        }),
        signal: controller.signal,
      });

      if (insertRes.ok) {
        const rows = (await insertRes.json()) as Array<{ id?: string }>;
        if (Array.isArray(rows) && rows[0]?.id) {
          scanVerificationId = rows[0].id;
        }
      } else {
        console.warn('Could not persist server scan_verifications attestation:', insertRes.status);
      }
    } catch (err: any) {
      console.warn('scan_verifications persistence error:', err?.message || err);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    scanVerificationId,
    speciesKey: normalizeSpeciesKey(verifiedScientific, verifiedCommon),
    commonName: verifiedCommon,
    scientificName: verifiedScientific,
    category: verifiedCategory,
    iNatTaxonId,
    iucnStatus,
    serverRarity,
    taxonomySource,
    verificationStatus,
    isTaxonomyConfirmed,
  };
}
