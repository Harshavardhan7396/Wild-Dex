import { SpecimenScanResult } from '../config/scannerPrompt';
import { Species } from '../types/species';

export interface CollectedSpecimen {
  id: string;
  speciesId: string;
  commonName: string;
  scientificName: string;
  category: Species['category'] | 'other';
  confidence: number;
  photoUrl: string;
  userPhotoUrl?: string;
  collectedAt: string;
  locationName?: string;
  notes?: string;
  rarity?: string;
  safetyFlags: SpecimenScanResult['safetyFlags'];
  quickFacts: SpecimenScanResult['quickFacts'];
}

const STORAGE_KEY = 'wilddex_collected_specimens_v1';

export function getCollectedSpecimens(): CollectedSpecimen[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load collection from localStorage:', err);
    return [];
  }
}

export function isSpeciesCollected(speciesIdOrName: string): boolean {
  const collection = getCollectedSpecimens();
  const target = speciesIdOrName.toLowerCase().trim();
  return collection.some(
    (item) =>
      item.speciesId.toLowerCase() === target ||
      item.scientificName.toLowerCase() === target ||
      item.commonName.toLowerCase() === target
  );
}

export function addSpecimenToCollection(
  scanResult: SpecimenScanResult,
  userPhoto?: string,
  enrichedPhoto?: string,
  notes?: string
): { success: boolean; specimen: CollectedSpecimen; alreadyExists: boolean } {
  const collection = getCollectedSpecimens();
  const existingIndex = collection.findIndex(
    (s) =>
      s.scientificName.toLowerCase() === scanResult.scientificName.toLowerCase() ||
      s.commonName.toLowerCase() === scanResult.commonName.toLowerCase()
  );

  const specimenId = `obs-${Date.now()}`;
  const speciesId =
    scanResult.scientificName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `taxon-${Date.now()}`;

  const bestPhoto =
    enrichedPhoto ||
    userPhoto ||
    'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=800&auto=format&fit=crop&q=80';

  const newSpecimen: CollectedSpecimen = {
    id: specimenId,
    speciesId,
    commonName: scanResult.commonName,
    scientificName: scanResult.scientificName,
    category: scanResult.category,
    confidence: scanResult.confidence,
    photoUrl: bestPhoto,
    userPhotoUrl: userPhoto,
    collectedAt: new Date().toISOString(),
    locationName: 'Field Observation',
    notes: notes || `Identified with ${(scanResult.confidence * 100).toFixed(0)}% confidence via WildDex AI.`,
    rarity:
      scanResult.confidence > 0.9 && scanResult.safetyFlags.endangered
        ? 'Very Rare'
        : scanResult.confidence > 0.85
        ? 'Rare'
        : 'Common',
    safetyFlags: scanResult.safetyFlags,
    quickFacts: scanResult.quickFacts,
  };

  if (existingIndex >= 0) {
    // Update existing observation with latest scan
    collection[existingIndex] = {
      ...collection[existingIndex],
      collectedAt: newSpecimen.collectedAt,
      confidence: Math.max(collection[existingIndex].confidence, newSpecimen.confidence),
      userPhotoUrl: userPhoto || collection[existingIndex].userPhotoUrl,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
      window.dispatchEvent(new CustomEvent('wilddex:collection_updated', { detail: collection }));
    } catch (e) {
      console.warn('Storage limit reached:', e);
    }
    return { success: true, specimen: collection[existingIndex], alreadyExists: true };
  }

  // Prepend newest specimen
  collection.unshift(newSpecimen);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
    window.dispatchEvent(new CustomEvent('wilddex:collection_updated', { detail: collection }));
  } catch (e) {
    console.warn('Storage limit reached:', e);
  }

  return { success: true, specimen: newSpecimen, alreadyExists: false };
}

export function removeSpecimenFromCollection(id: string): void {
  const collection = getCollectedSpecimens();
  const filtered = collection.filter((item) => item.id !== id && item.speciesId !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new CustomEvent('wilddex:collection_updated', { detail: filtered }));
}
