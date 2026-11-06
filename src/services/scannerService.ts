import {
  SpecimenScanResult,
  SCANNER_TEST_CASES,
  ScannerTestCase,
} from '../config/scannerPrompt';
import { Species } from '../types/species';
import { CURATED_SPECIES, saveSpeciesToCache } from './speciesService';

export interface EnrichedSpecimenScanResult extends SpecimenScanResult {
  enrichedPhotos: string[];
  photoCredit?: string;
  wikiDescription?: string;
  iNatObservationsCount?: number;
  matchedSpeciesId?: string;
  iNatTaxonId?: number;
  conservationStatusCode?: 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';
}

/**
 * Compresses an image file or DataURL to maximum 1024px width/height and JPEG format before network transfer
 */
export async function compressImage(dataUrl: string, maxDimension = 1024): Promise<string> {
  if (!dataUrl) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
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
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = (e) => {
      console.warn('Image compression load failed, proceeding with original data:', e);
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

/**
 * Translates raw API/server error messages into simple everyday words
 */
export function formatScannerErrorMessage(errorMsg: string, status?: number): string {
  const lower = (errorMsg || '').toLowerCase();

  // 1. Quota or Rate Limit
  if (
    status === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('too many requests')
  ) {
    return 'Too many scans right now, please wait a minute';
  }

  // 2. Invalid or Missing API key
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('invalid api key') ||
    lower.includes('key is not configured') ||
    lower.includes('api key not valid') ||
    lower.includes('unauthenticated')
  ) {
    return 'Invalid or missing API key. Please check your Gemini API key in Settings > Secrets.';
  }

  // 3. Model Not Found or Unavailable
  if (
    status === 404 ||
    lower.includes('not_found') ||
    lower.includes('model not found') ||
    lower.includes('is not found')
  ) {
    return 'The AI scanner model is not available. Please verify the model name or try again later.';
  }

  // 3b. High Demand / Temporary Service Unavailable
  if (
    status === 503 ||
    lower.includes('high demand') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded')
  ) {
    return 'The AI model is experiencing high demand right now. Please try again in a moment.';
  }

  // 4. Safety filter
  if (lower.includes('safety') || lower.includes('blocked') || lower.includes('harm')) {
    return 'Photo could not be processed due to safety filters. Please try a different photo.';
  }

  // 5. Network errors
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Network connection issue. Please check your internet connection and retry.';
  }

  // 6. Generic server error
  if (lower.includes('500') || lower.includes('internal server error')) {
    return 'The scan server encountered an issue. Please try again in a moment.';
  }

  return errorMsg || 'Unable to identify specimen. Please try again.';
}

/**
 * Enrich raw Gemini identification with real photos and taxonomic metadata from iNaturalist & Wikipedia
 */
export async function enrichScanResult(
  result: SpecimenScanResult,
  userPhoto?: string
): Promise<EnrichedSpecimenScanResult> {
  // If non-species, no biological enrichment
  if (result.notASpecies) {
    return {
      ...result,
      enrichedPhotos: userPhoto ? [userPhoto] : [],
      photoCredit: 'Field Camera Capture',
      wikiDescription: 'Non-biological item or synthetic object.',
      matchedSpeciesId: undefined,
    };
  }

  // Check if matches curated species first
  const cleanScientific = result.scientificName.toLowerCase().trim();
  const cleanCommon = result.commonName.toLowerCase().trim();
  const curatedMatch = CURATED_SPECIES.find(
    (c) =>
      c.scientificName.toLowerCase() === cleanScientific ||
      c.commonName.toLowerCase() === cleanCommon ||
      (c.taxonomy.genus && cleanScientific.startsWith(c.taxonomy.genus.toLowerCase()))
  );

  let enrichedPhotos: string[] = [];
  let photoCredit = 'iNaturalist Biodiversity Network';
  let wikiDescription = '';
  let iNatObservationsCount: number | undefined;
  let iNatTaxonId: number | undefined;
  let conservationStatusCode: 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX' | undefined;

  // 1. Fetch real photos and taxonomy from iNaturalist
  try {
    const query = result.scientificName.replace(/\s+sp\.?$/i, '');
    const inatUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&per_page=5`;
    const inatRes = await fetch(inatUrl);
    if (inatRes.ok) {
      const inatData = await inatRes.json();
      if (inatData.results && inatData.results.length > 0) {
        const topTaxon = inatData.results[0];
        iNatTaxonId = topTaxon.id;
        iNatObservationsCount = topTaxon.observations_count;

        if (topTaxon.default_photo?.medium_url) {
          enrichedPhotos.push(topTaxon.default_photo.medium_url);
        }
        if (topTaxon.default_photo?.attribution) {
          photoCredit = topTaxon.default_photo.attribution;
        }

        // Additional taxon photos
        if (Array.isArray(topTaxon.taxon_photos)) {
          for (const tp of topTaxon.taxon_photos) {
            const u = tp.photo?.medium_url || tp.photo?.url;
            if (u && !enrichedPhotos.includes(u)) {
              enrichedPhotos.push(u);
            }
          }
        }

        if (topTaxon.wikipedia_summary) {
          wikiDescription = topTaxon.wikipedia_summary.replace(/<[^>]+>/g, '').trim();
        }

        const rawStatus = topTaxon.conservation_status?.status_name?.toUpperCase();
        if (rawStatus) {
          if (rawStatus.includes('CRITICAL')) conservationStatusCode = 'CR';
          else if (rawStatus.includes('ENDANGER')) conservationStatusCode = 'EN';
          else if (rawStatus.includes('VULNERABLE')) conservationStatusCode = 'VU';
          else if (rawStatus.includes('NEAR')) conservationStatusCode = 'NT';
          else conservationStatusCode = 'LC';
        }
      }
    }
  } catch (err) {
    console.warn('iNaturalist enrichment network skip:', err);
  }

  // 2. Fetch Wikipedia if description or photos still needed
  if (enrichedPhotos.length < 2 || !wikiDescription) {
    try {
      const cleanWikiTitle = result.scientificName.replace(/\s+sp\.?$/i, '');
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanWikiTitle)}`;
      const wikiRes = await fetch(wikiUrl);
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        if (wikiData.extract && !wikiDescription) {
          wikiDescription = wikiData.extract;
        }
        const wikiImg = wikiData.originalimage?.source || wikiData.thumbnail?.source;
        if (wikiImg && !enrichedPhotos.includes(wikiImg)) {
          enrichedPhotos.push(wikiImg);
        }
      }
    } catch (err) {
      console.warn('Wikipedia enrichment network skip:', err);
    }
  }

  // Fallback photos from curated match or default
  if (curatedMatch && enrichedPhotos.length === 0) {
    enrichedPhotos = [curatedMatch.photoUrl, ...(curatedMatch.galleryUrls || [])];
    if (curatedMatch.photoCredit) {
      photoCredit = curatedMatch.photoCredit;
    }
  }

  // Determine navigable species ID
  const matchedSpeciesId =
    curatedMatch?.id ||
    (iNatTaxonId ? `inat-${iNatTaxonId}` : result.scientificName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

  // Pre-seed species cache so View Details works seamlessly
  const synthesizedSpecies: Species = {
    id: matchedSpeciesId,
    commonName: result.commonName,
    scientificName: result.scientificName,
    taxonomy: {
      kingdom: 'Plantae / Animalia',
      phylum: 'Vertebrata / Arthropoda',
      class: result.category,
      order: '',
      family: '',
      genus: result.scientificName.split(' ')[0],
      species: result.scientificName,
    },
    category: (result.category === 'other' ? 'mammals' : result.category) as Species['category'],
    conservationStatus: conservationStatusCode || (result.safetyFlags.endangered ? 'EN' : 'LC'),
    statusLabel: result.safetyFlags.endangered ? 'In Danger' : 'Common, Not in Danger',
    rarity: result.confidence > 0.9 && result.safetyFlags.endangered ? 'Very Rare' : 'Common',
    nativeRegion: result.quickFacts.habitat || 'Global Biome',
    habitat: result.quickFacts.habitat || 'Natural Habitat',
    biomes: ['Field Observation Site', result.quickFacts.habitat || 'Ecosystem'],
    description:
      wikiDescription ||
      `Identified with ${(result.confidence * 100).toFixed(0)}% match score. Notes: ${result.reasoning}`,
    source: (iNatTaxonId ? 'iNaturalist' : 'AI-generated') as Species['source'],
    photoUrl: enrichedPhotos[0] || userPhoto || (curatedMatch ? curatedMatch.photoUrl : ''),
    photoCredit: photoCredit || 'Verified Community Observation',
    galleryUrls: enrichedPhotos.length > 0 ? enrichedPhotos : userPhoto ? [userPhoto] : [],
    coordinates: { latitude: 37.7749, longitude: -122.4194 },
    preyGuild: {
      category:
        result.quickFacts.diet.toLowerCase().includes('carnivore') ||
        result.quickFacts.diet.toLowerCase().includes('rodent')
          ? 'Carnivore'
          : 'Herbivore / Generalist',
      description: result.quickFacts.diet,
      items: [
        {
          name: result.quickFacts.diet.split(',')[0] || result.quickFacts.diet,
          percentage: 85,
          description: result.quickFacts.diet,
          photoUrl: enrichedPhotos[0] || userPhoto || '',
        },
      ],
    },
    lifeStages: [
      {
        stageNumber: 1,
        name: 'Early Stage',
        subtitle: 'Juvenile Phase',
        badge: 'Developing',
        duration: 'Juvenile Period',
        description: 'Developmental phase in native habitat.',
        keyMilestones: [{ title: 'Morphogenesis', detail: 'Acquires diagnostic visual traits.' }],
        imageUrl: enrichedPhotos[0] || userPhoto || '',
        imageAlt: `${result.commonName} juvenile`,
      },
      {
        stageNumber: 2,
        name: 'Adult Specimen',
        subtitle: 'Mature Phase',
        badge: 'Adult',
        duration: result.quickFacts.lifespan,
        description: 'Full maturity and foraging lifecycle.',
        keyMilestones: [{ title: 'Maturity', detail: 'Active breeding and ecosystem participation.' }],
        imageUrl: enrichedPhotos[0] || userPhoto || '',
        imageAlt: `${result.commonName} adult`,
      },
    ],
  };

  saveSpeciesToCache(synthesizedSpecies);

  return {
    ...result,
    enrichedPhotos,
    photoCredit,
    wikiDescription,
    iNatObservationsCount,
    iNatTaxonId,
    conservationStatusCode,
    matchedSpeciesId,
  };
}

/**
 * Send specimen image to Gemini Scanner API with single request execution (no automatic retry)
 */
export async function scanSpecimenImage(
  imageDataUrl: string,
  testCaseId?: string
): Promise<EnrichedSpecimenScanResult> {
  // Compress to max 1024px width/height and format as JPEG
  const compressedDataUrl = await compressImage(imageDataUrl, 1024);

  // If running predefined test case offline
  if (testCaseId) {
    const match = SCANNER_TEST_CASES.find((tc) => tc.id === testCaseId);
    if (match) {
      return await enrichScanResult(match.expectedOutput, compressedDataUrl);
    }
  }

  // Exactly one request sent per scan - no automatic retry on rate limits or errors
  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: compressedDataUrl,
        mimeType: 'image/jpeg',
        testCaseId,
      }),
    });

    const responseText = await response.text();
    let payload: any = null;
    try {
      payload = JSON.parse(responseText);
    } catch {
      console.warn('Response from /api/scan was not JSON:', responseText.slice(0, 200));
    }

    const isHtmlResponse =
      !payload &&
      (responseText.includes('<!doctype') ||
        responseText.includes('<html') ||
        responseText.includes('Starting Server') ||
        responseText.includes('warmup'));

    if (!response.ok || !payload || !payload.success) {
      const rawServerMessage =
        payload?.error ||
        payload?.message ||
        (isHtmlResponse
          ? 'The AI scanner is temporarily busy or starting up. Please try again in a moment.'
          : `Server returned status ${response.status}: ${response.statusText}`);

      // Log the full error to the console
      console.error('Gemini Scanner Server Error:', {
        status: response.status,
        statusText: response.statusText,
        payload,
        rawMessage: rawServerMessage,
        isHtmlResponse,
      });

      const friendlyMessage = formatScannerErrorMessage(rawServerMessage, response.status);
      const errorObj = new Error(friendlyMessage);
      (errorObj as any).status = response.status;
      (errorObj as any).rawServerMessage = rawServerMessage;

      throw errorObj;
    }

    if (payload && payload.success && payload.data) {
      const rawResult = payload.data as SpecimenScanResult;
      // Enrich with real iNaturalist & Wikipedia photos
      const enriched = await enrichScanResult(rawResult, compressedDataUrl);
      return enriched;
    }

    const errMessage = payload?.error || 'Unable to identify specimen. Please try another photo.';
    throw new Error(formatScannerErrorMessage(errMessage));
  } catch (err: any) {
    console.error('Specimen scan failed:', err);
    throw err;
  }
}

/**
 * Run a specific test case
 */
export function getScannerTestCase(testCaseId: string): ScannerTestCase | undefined {
  return SCANNER_TEST_CASES.find((tc) => tc.id === testCaseId);
}

/**
 * Get all 5 scanner test cases
 */
export function getAllScannerTestCases(): ScannerTestCase[] {
  return SCANNER_TEST_CASES;
}
