import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { compressImageToJpegBlob } from './supabaseCollectionService';
import type { DetailedHealthResult } from '../components/health/HealthResultSection';
import { parseHealthResponse } from '../utils/healthResultParser';

export type CareKind = 'pet' | 'plant' | 'crop' | 'tree';
export type CareSex = '' | 'male' | 'female' | 'unknown';

export interface CareSubject {
  id: string;
  ownerId: string;
  kind: CareKind;
  name: string;
  speciesCommon: string;
  speciesScientific: string;
  inatTaxonId: number | null;
  startedOn: string | null; // YYYY-MM-DD
  sex: CareSex;
  photoPath: string;
  extraPhotoPaths: string[];
  photoUrl: string; // Signed URL from private 'care' bucket
  notes: string;
  archived: boolean;
  hasDueReminder: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CareSubjectInput {
  kind: CareKind;
  name: string;
  speciesCommon: string;
  speciesScientific: string;
  inatTaxonId: number | null;
  startedOn: string | null;
  sex: CareSex;
  notes: string;
  photoDataUrl?: string | null; // New photo chosen by user (data URL)
  removeExistingPhoto?: boolean;
}

export interface TaxonSuggestion {
  id: number;
  commonName: string;
  scientificName: string;
  photoUrl?: string;
}

export const CARE_KIND_META: Record<
  CareKind,
  {
    label: string;
    pluralLabel: string;
    icon: string;
    description: string;
    dateLabel: string;
  }
> = {
  pet: {
    label: 'Pet',
    pluralLabel: 'Pets',
    icon: 'pets',
    description: 'Dog, cat, bird, rabbit, fish, or reptile',
    dateLabel: 'Birthday',
  },
  plant: {
    label: 'Plant',
    pluralLabel: 'Plants',
    icon: 'local_florist',
    description: 'Houseplant, flower, fern, or herb',
    dateLabel: 'Planting date',
  },
  crop: {
    label: 'Crop',
    pluralLabel: 'Crops',
    icon: 'grass',
    description: 'Vegetable, berry, grain, or garden bed',
    dateLabel: 'Planting date',
  },
  tree: {
    label: 'Tree',
    pluralLabel: 'Trees',
    icon: 'park',
    description: 'Fruit tree, shade tree, or sapling',
    dateLabel: 'Planting date',
  },
};

export function inferCareKindFromCategory(category?: string): CareKind | null {
  if (!category) return null;
  const normalized = category.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'tree' || normalized === 'trees') return 'tree';
  if (normalized === 'crop' || normalized === 'crops') return 'crop';
  if (
    normalized === 'plant' ||
    normalized === 'plants' ||
    normalized === 'flora' ||
    normalized === 'flower' ||
    normalized === 'flowers' ||
    normalized === 'shrub' ||
    normalized === 'herb'
  ) {
    return 'plant';
  }
  if (
    normalized === 'pet' ||
    normalized === 'pets' ||
    normalized === 'animal' ||
    normalized === 'animals' ||
    normalized === 'mammal' ||
    normalized === 'mammals' ||
    normalized === 'bird' ||
    normalized === 'birds' ||
    normalized === 'reptile' ||
    normalized === 'reptiles' ||
    normalized === 'amphibian' ||
    normalized === 'amphibians' ||
    normalized === 'insect' ||
    normalized === 'insects' ||
    normalized === 'marine' ||
    normalized === 'fish' ||
    normalized === 'farm animal' ||
    normalized === 'wild animal' ||
    normalized === 'wildlife'
  ) {
    return 'pet';
  }

  return null;
}

export function healthCategoryToCareKind(category?: string): CareKind {
  const inferred = inferCareKindFromCategory(category);
  if (inferred) return inferred;
  if (category?.trim().toLowerCase() === 'fungi') return 'plant';
  return 'pet';
}

export function careKindToHealthCategory(kind: CareKind): string {
  switch (kind) {
    case 'tree':
      return 'Tree';
    case 'crop':
      return 'Crop';
    case 'plant':
      return 'Plant';
    case 'pet':
    default:
      return 'Pet';
  }
}

function pluralize(count: number, unit: string): string {
  return count === 1 ? `1 ${unit}` : `${count} ${unit}s`;
}

/**
 * Formats a birthday or planting date into everyday wording:
 * e.g. "2 years old" (pets) or "planted 3 weeks ago" (plants, crops, trees)
 */
export function formatCareAge(kind: CareKind, startedOn?: string | null): string {
  if (!startedOn) return '';

  const match = startedOn.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  const start = new Date(year, month, day);
  if (Number.isNaN(start.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = today.getTime() - start.getTime();
  if (diffMs < 0) {
    return kind === 'pet' ? 'Expected soon' : 'To be planted';
  }

  const diffDays = Math.floor(diffMs / 86_400_000);
  const isPet = kind === 'pet';

  if (diffDays === 0) {
    return isPet ? 'Born today' : 'planted today';
  }
  if (diffDays < 7) {
    const span = pluralize(diffDays, 'day');
    return isPet ? `${span} old` : `planted ${span} ago`;
  }
  if (diffDays < 30) {
    const weeks = Math.max(1, Math.floor(diffDays / 7));
    const span = pluralize(weeks, 'week');
    return isPet ? `${span} old` : `planted ${span} ago`;
  }

  let totalMonths =
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth());
  if (today.getDate() < start.getDate()) {
    totalMonths -= 1;
  }
  totalMonths = Math.max(1, totalMonths);

  if (totalMonths < 12) {
    const span = pluralize(totalMonths, 'month');
    return isPet ? `${span} old` : `planted ${span} ago`;
  }

  const years = Math.floor(totalMonths / 12);
  const span = pluralize(years, 'year');
  return isPet ? `${span} old` : `planted ${span} ago`;
}

/**
 * Generates a short-lived signed URL for a photo in the private 'care' bucket.
 */
export async function getSignedCarePhotoUrl(photoPath: string): Promise<string> {
  if (!photoPath) return '';
  if (
    photoPath.startsWith('http://') ||
    photoPath.startsWith('https://') ||
    photoPath.startsWith('data:')
  ) {
    return photoPath;
  }
  try {
    const { data, error } = await supabase.storage
      .from('care')
      .createSignedUrl(photoPath, 3600);
    if (error || !data?.signedUrl) {
      return '';
    }
    return data.signedUrl;
  } catch {
    return '';
  }
}

/**
 * Searches species using iNaturalist taxa autocomplete.
 */
export async function searchCareSpecies(
  query: string,
  signal?: AbortSignal
): Promise<TaxonSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const url = `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(
      trimmed
    )}&per_page=8`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`Could not search species (${res.status}).`);
    }
    const json = await res.json();
    if (!Array.isArray(json?.results)) return [];

    return json.results.map((taxon: any) => ({
      id: Number(taxon.id),
      commonName: taxon.preferred_common_name || taxon.name || 'Unknown species',
      scientificName: taxon.name || '',
      photoUrl:
        taxon.default_photo?.square_url ||
        taxon.default_photo?.medium_url ||
        undefined,
    }));
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    throw new Error(err?.message || 'Could not search species right now.');
  }
}

function mapCareRow(
  row: any,
  photoUrl: string,
  dueSubjectIds: Set<string>
): CareSubject {
  return {
    id: row.id,
    ownerId: row.owner_id,
    kind: (['pet', 'plant', 'crop', 'tree'].includes(row.kind) ? row.kind : 'plant') as CareKind,
    name: row.name || '',
    speciesCommon: row.species_name || '',
    speciesScientific: row.scientific_name || '',
    inatTaxonId: null,
    startedOn: row.birth_or_planted_on || null,
    sex: (['male', 'female', 'unknown'].includes(row.sex) ? row.sex : '') as CareSex,
    photoPath: row.photo_path || '',
    extraPhotoPaths: [],
    photoUrl,
    notes: row.notes || '',
    archived: Boolean(row.archived),
    hasDueReminder: dueSubjectIds.has(row.id),
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

async function getAuthenticatedUserId(): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('App database is not configured yet.');
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) {
    throw new Error('Please sign in to manage My Care.');
  }
  return user.id;
}

/**
 * Fetches all active (not archived) care_subjects for the signed-in user,
 * resolving signed photo URLs and checking due/overdue care_reminders.
 */
export async function listCareSubjects(): Promise<CareSubject[]> {
  try {
    const authUserId = await getAuthenticatedUserId();

    const { data, error } = await supabase
      .from('care_subjects')
      .select('*')
      .eq('owner_id', authUserId)
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Could not load your care list.');
    }

    const rows = data || [];
    if (rows.length === 0) return [];

    // Check due or overdue active reminders (gracefully ignored if reminders table is unavailable)
    const dueSubjectIds = new Set<string>();
    try {
      const { data: dueRows, error: remErr } = await supabase
        .from('care_reminders')
        .select('subject_id')
        .eq('owner_id', authUserId)
        .eq('active', true)
        .lte('next_due', todayLocalYmd())
        .order('next_due', { ascending: true });

      if (!remErr && Array.isArray(dueRows)) {
        for (const r of dueRows) {
          if (r?.subject_id) {
            dueSubjectIds.add(r.subject_id);
          }
        }
      }
    } catch {
      // Do not fail subject list if reminders query cannot run
    }

    const mapped = await Promise.all(
      rows.map(async (row: any) => {
        const signedUrl = row.photo_path
          ? await getSignedCarePhotoUrl(row.photo_path)
          : '';
        return mapCareRow(row, signedUrl, dueSubjectIds);
      })
    );

    return mapped;
  } catch (err: any) {
    console.error('[My Care] listCareSubjects failed:', err);
    throw new Error(err?.message || 'Could not load My Care right now.');
  }
}

async function uploadCarePhoto(userId: string, dataUrl: string): Promise<string> {
  let jpegBlob: Blob;
  try {
    jpegBlob = await compressImageToJpegBlob(dataUrl, 1024);
  } catch (err: any) {
    throw new Error(err?.message || 'Could not prepare the photo for upload.');
  }

  const photoPath = `${userId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('care')
    .upload(photoPath, jpegBlob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Could not upload your photo.');
  }

  return photoPath;
}

async function removeCareStoragePaths(paths: string[]): Promise<void> {
  const uniquePaths = Array.from(
    new Set(
      paths
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && !p.startsWith('http') && !p.startsWith('data:'))
    )
  );
  if (uniquePaths.length === 0) return;

  try {
    await supabase.storage.from('care').remove(uniquePaths);
  } catch (err) {
    console.warn('[My Care] Failed to remove storage photo(s):', err);
  }
}

/**
 * Inserts a new care_subject (compressing & uploading photo to private 'care' bucket).
 */
export async function createCareSubject(
  input: CareSubjectInput
): Promise<CareSubject> {
  const authUserId = await getAuthenticatedUserId();
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('Please enter a name.');
  }

  let uploadedPath = '';
  try {
    if (input.photoDataUrl) {
      uploadedPath = await uploadCarePhoto(authUserId, input.photoDataUrl);
    }

    const rowPayload = {
      owner_id: authUserId,
      kind: input.kind,
      name: cleanName,
      species_name: input.speciesCommon.trim(),
      scientific_name: input.speciesScientific.trim(),
      birth_or_planted_on: input.startedOn ? input.startedOn : null,
      sex: input.kind === 'pet' ? input.sex || '' : '',
      photo_path: uploadedPath,
      notes: input.notes.trim(),
      archived: false,
    };

    const { data, error } = await supabase
      .from('care_subjects')
      .insert([rowPayload])
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not save this entry.');
    }

    const signedUrl = uploadedPath
      ? await getSignedCarePhotoUrl(uploadedPath)
      : '';

    return mapCareRow(data, signedUrl, new Set());
  } catch (err: any) {
    if (uploadedPath) {
      await removeCareStoragePaths([uploadedPath]);
    }
    console.error('[My Care] createCareSubject failed:', err);
    throw new Error(err?.message || 'Could not save this entry.');
  }
}

/**
 * Updates an existing care_subject and handles optional photo replacement or removal.
 */
export async function updateCareSubject(
  existing: CareSubject,
  input: CareSubjectInput
): Promise<CareSubject> {
  const authUserId = await getAuthenticatedUserId();
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('Please enter a name.');
  }

  let newlyUploadedPath = '';
  try {
    let nextPhotoPath = existing.photoPath;
    let shouldDeleteOldPhoto = false;

    if (input.photoDataUrl) {
      newlyUploadedPath = await uploadCarePhoto(authUserId, input.photoDataUrl);
      nextPhotoPath = newlyUploadedPath;
      if (existing.photoPath) {
        shouldDeleteOldPhoto = true;
      }
    } else if (input.removeExistingPhoto) {
      nextPhotoPath = '';
      if (existing.photoPath) {
        shouldDeleteOldPhoto = true;
      }
    }

    const updatePayload = {
      kind: input.kind,
      name: cleanName,
      species_name: input.speciesCommon.trim(),
      scientific_name: input.speciesScientific.trim(),
      birth_or_planted_on: input.startedOn ? input.startedOn : null,
      sex: input.kind === 'pet' ? input.sex || '' : '',
      photo_path: nextPhotoPath,
      notes: input.notes.trim(),
    };

    const { data, error } = await supabase
      .from('care_subjects')
      .update(updatePayload)
      .eq('id', existing.id)
      .eq('owner_id', authUserId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not update this entry.');
    }

    if (shouldDeleteOldPhoto && existing.photoPath) {
      await removeCareStoragePaths([existing.photoPath]);
    }

    const signedUrl = nextPhotoPath
      ? await getSignedCarePhotoUrl(nextPhotoPath)
      : '';

    const dueSet = existing.hasDueReminder
      ? new Set([existing.id])
      : new Set<string>();
    return mapCareRow(data, signedUrl, dueSet);
  } catch (err: any) {
    if (newlyUploadedPath) {
      await removeCareStoragePaths([newlyUploadedPath]);
    }
    console.error('[My Care] updateCareSubject failed:', err);
    throw new Error(err?.message || 'Could not save your changes.');
  }
}

/**
 * Archives a care_subject so it leaves the active list without deleting data.
 */
export async function archiveCareSubject(subjectId: string): Promise<void> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const { error } = await supabase
      .from('care_subjects')
      .update({
        archived: true,
      })
      .eq('id', subjectId)
      .eq('owner_id', authUserId);

    if (error) {
      throw new Error(error.message || 'Could not archive this entry.');
    }
  } catch (err: any) {
    console.error('[My Care] archiveCareSubject failed:', err);
    throw new Error(err?.message || 'Could not archive this entry.');
  }
}

/**
 * Permanently deletes a care_subject and removes its photos (and entry photos) from private storage.
 */
export async function deleteCareSubject(subject: CareSubject): Promise<void> {
  try {
    const authUserId = await getAuthenticatedUserId();

    // Collect any entry photos attached to this subject before cascade delete
    let entryPhotoPaths: string[] = [];
    try {
      const { data: entryPhotos } = await supabase
        .from('care_entries')
        .select('photo_path')
        .eq('subject_id', subject.id)
        .eq('owner_id', authUserId);
      if (Array.isArray(entryPhotos)) {
        entryPhotoPaths = entryPhotos
          .map((r: any) => (typeof r?.photo_path === 'string' ? r.photo_path : ''))
          .filter(Boolean);
      }
    } catch {
      // Ignore if care_entries table is not yet provisioned
    }

    const { error } = await supabase
      .from('care_subjects')
      .delete()
      .eq('id', subject.id)
      .eq('owner_id', authUserId);

    if (error) {
      throw new Error(error.message || 'Could not delete this entry.');
    }

    await removeCareStoragePaths([
      subject.photoPath,
      ...entryPhotoPaths,
    ]);
  } catch (err: any) {
    console.error('[My Care] deleteCareSubject failed:', err);
    throw new Error(err?.message || 'Could not delete this entry.');
  }
}

// ==============================================================================
// CARE ENTRIES (TIMELINE, WEIGHT CHART, GROWTH GALLERY)
// ==============================================================================

export type CareMeasurementUnit = '' | 'kg' | 'lb' | 'cm';

export type PetCareEntryType =
  | 'vet_visit'
  | 'vaccination'
  | 'weight'
  | 'symptom'
  | 'treatment'
  | 'food_change'
  | 'grooming'
  | 'note';

export type PlantCareEntryType =
  | 'watering'
  | 'feeding'
  | 'pruning'
  | 'repotting'
  | 'pest_disease'
  | 'growth_photo'
  | 'harvest'
  | 'note';

export type CareEntryType = PetCareEntryType | PlantCareEntryType;

export interface CareEntryTypeMeta {
  id: CareEntryType;
  label: string;
  icon: string;
  defaultUnit?: CareMeasurementUnit;
  allowedUnits?: CareMeasurementUnit[];
  valueLabel?: string;
}

export const PET_ENTRY_TYPES: CareEntryTypeMeta[] = [
  { id: 'vet_visit', label: 'Vet visit', icon: 'medical_services' },
  { id: 'vaccination', label: 'Vaccination', icon: 'vaccines' },
  {
    id: 'weight',
    label: 'Weight',
    icon: 'monitor_weight',
    defaultUnit: 'kg',
    allowedUnits: ['kg', 'lb'],
    valueLabel: 'Weight (optional)',
  },
  { id: 'symptom', label: 'Symptom', icon: 'healing' },
  { id: 'treatment', label: 'Treatment', icon: 'medication' },
  { id: 'food_change', label: 'Food change', icon: 'restaurant' },
  { id: 'grooming', label: 'Grooming', icon: 'content_cut' },
  { id: 'note', label: 'Note', icon: 'edit_note' },
];

export const PLANT_ENTRY_TYPES: CareEntryTypeMeta[] = [
  { id: 'watering', label: 'Watering', icon: 'water_drop' },
  { id: 'feeding', label: 'Feeding', icon: 'eco' },
  { id: 'pruning', label: 'Pruning', icon: 'content_cut' },
  { id: 'repotting', label: 'Repotting', icon: 'yard' },
  { id: 'pest_disease', label: 'Pest or disease', icon: 'bug_report' },
  {
    id: 'growth_photo',
    label: 'Growth photo',
    icon: 'photo_camera',
    defaultUnit: 'cm',
    allowedUnits: ['cm'],
    valueLabel: 'Height (optional)',
  },
  {
    id: 'harvest',
    label: 'Harvest',
    icon: 'shopping_basket',
    defaultUnit: 'kg',
    allowedUnits: ['kg'],
    valueLabel: 'Harvest amount (optional)',
  },
  { id: 'note', label: 'Note', icon: 'edit_note' },
];

export function getEntryTypesForKind(kind: CareKind): CareEntryTypeMeta[] {
  return kind === 'pet' ? PET_ENTRY_TYPES : PLANT_ENTRY_TYPES;
}

export function getEntryTypeMeta(
  kind: CareKind,
  entryType: string
): CareEntryTypeMeta {
  const list = getEntryTypesForKind(kind);
  const found =
    list.find((t) => t.id === entryType) ||
    PET_ENTRY_TYPES.find((t) => t.id === entryType) ||
    PLANT_ENTRY_TYPES.find((t) => t.id === entryType);

  return (
    found || {
      id: 'note',
      label: 'Note',
      icon: 'edit_note',
    }
  );
}

export interface CareEntry {
  id: string;
  ownerId: string;
  subjectId: string;
  entryType: CareEntryType;
  entryDate: string; // YYYY-MM-DD
  title: string;
  notes: string;
  value: number | null;
  unit: CareMeasurementUnit;
  photoPath: string;
  photoUrl: string;
  healthResult: DetailedHealthResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareEntryInput {
  entryType: CareEntryType;
  entryDate: string;
  title: string;
  notes: string;
  value: number | null;
  unit: CareMeasurementUnit;
  photoDataUrl?: string | null;
  removeExistingPhoto?: boolean;
  healthResult?: DetailedHealthResult | null;
}

export function todayLocalYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYmdToLocalDate(ymd: string): Date | null {
  const match = ymd?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatEntryDate(ymd: string): string {
  const date = parseYmdToLocalDate(ymd);
  if (!date) return ymd || '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonthHeading(ymd: string): string {
  const date = parseYmdToLocalDate(ymd);
  if (!date) return 'Other';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function parseStoredHealthResult(raw: unknown): DetailedHealthResult | null {
  if (!raw || typeof raw !== 'object') return null;
  try {
    return parseHealthResponse(raw);
  } catch {
    return null;
  }
}

function mapCareEntryRow(row: any, photoUrl: string): CareEntry {
  const rawUnit = typeof row.unit === 'string' ? row.unit : '';
  const unit: CareMeasurementUnit = ['kg', 'lb', 'cm'].includes(rawUnit)
    ? (rawUnit as CareMeasurementUnit)
    : '';

  return {
    id: row.id,
    ownerId: row.owner_id,
    subjectId: row.subject_id,
    entryType: (row.entry_type || 'note') as CareEntryType,
    entryDate: row.entry_date || todayLocalYmd(),
    title: row.title || '',
    notes: row.notes || '',
    value: typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : null,
    unit,
    photoPath: row.photo_path || '',
    photoUrl,
    healthResult: parseStoredHealthResult(row.health_result),
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

/**
 * Fetches a single care_subject belonging to the signed-in user.
 */
export async function getCareSubjectById(
  subjectId: string
): Promise<CareSubject | null> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const { data, error } = await supabase
      .from('care_subjects')
      .select('*')
      .eq('id', subjectId)
      .eq('owner_id', authUserId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Could not load this diary.');
    }
    if (!data) return null;

    const dueSubjectIds = new Set<string>();
    try {
      const { data: dueRows, error: remErr } = await supabase
        .from('care_reminders')
        .select('subject_id')
        .eq('owner_id', authUserId)
        .eq('subject_id', subjectId)
        .eq('active', true)
        .lte('next_due', todayLocalYmd())
        .order('next_due', { ascending: true });

      if (!remErr && Array.isArray(dueRows) && dueRows.length > 0) {
        dueSubjectIds.add(subjectId);
      }
    } catch {
      // Soft fallback if reminders unavailable
    }

    const signedUrl = data.photo_path
      ? await getSignedCarePhotoUrl(data.photo_path)
      : '';

    return mapCareRow(data, signedUrl, dueSubjectIds);
  } catch (err: any) {
    console.error('[My Care] getCareSubjectById failed:', err);
    throw new Error(err?.message || 'Could not load this diary.');
  }
}

export const CARE_ENTRIES_PAGE_SIZE = 20;

/**
 * Lists care_entries for a subject, newest first, 20 per page.
 */
export async function listCareEntriesPage(
  subjectId: string,
  page = 0,
  pageSize = CARE_ENTRIES_PAGE_SIZE
): Promise<{ entries: CareEntry[]; hasMore: boolean }> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const from = page * pageSize;
    const to = from + pageSize; // fetch 1 extra row to detect hasMore cleanly

    const { data, error } = await supabase
      .from('care_entries')
      .select('*')
      .eq('owner_id', authUserId)
      .eq('subject_id', subjectId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message || 'Could not load diary entries.');
    }

    const rows = data || [];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

    const entries = await Promise.all(
      pageRows.map(async (row: any) => {
        const signedUrl = row.photo_path
          ? await getSignedCarePhotoUrl(row.photo_path)
          : '';
        return mapCareEntryRow(row, signedUrl);
      })
    );

    return { entries, hasMore };
  } catch (err: any) {
    console.error('[My Care] listCareEntriesPage failed:', err);
    throw new Error(err?.message || 'Could not load diary entries.');
  }
}

/**
 * Lists all entries of a given type (e.g. 'weight' or 'growth_photo') in date order (oldest -> newest).
 */
export async function listCareEntriesByType(
  subjectId: string,
  entryType: CareEntryType
): Promise<CareEntry[]> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const { data, error } = await supabase
      .from('care_entries')
      .select('*')
      .eq('owner_id', authUserId)
      .eq('subject_id', subjectId)
      .eq('entry_type', entryType)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message || 'Could not load entries.');
    }

    const rows = data || [];
    return Promise.all(
      rows.map(async (row: any) => {
        const signedUrl = row.photo_path
          ? await getSignedCarePhotoUrl(row.photo_path)
          : '';
        return mapCareEntryRow(row, signedUrl);
      })
    );
  } catch (err: any) {
    console.error('[My Care] listCareEntriesByType failed:', err);
    throw new Error(err?.message || 'Could not load entries.');
  }
}

async function uploadCareEntryPhoto(
  userId: string,
  dataUrl: string
): Promise<string> {
  let jpegBlob: Blob;
  try {
    jpegBlob = await compressImageToJpegBlob(dataUrl, 1024);
  } catch (err: any) {
    throw new Error(err?.message || 'Could not prepare the photo for upload.');
  }

  const photoPath = `${userId}/entries-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('care')
    .upload(photoPath, jpegBlob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Could not upload your photo.');
  }

  return photoPath;
}

/**
 * Creates a care_entry with owner_id = signed-in user and subject_id = target subject.
 */
export async function createCareEntry(
  subjectId: string,
  input: CareEntryInput
): Promise<CareEntry> {
  const authUserId = await getAuthenticatedUserId();
  const cleanTitle = input.title.trim();
  if (!cleanTitle) {
    throw new Error('Please enter a title.');
  }

  let uploadedPath = '';
  try {
    if (input.photoDataUrl) {
      uploadedPath = await uploadCareEntryPhoto(authUserId, input.photoDataUrl);
    }

    const hasValue =
      input.value !== null && Number.isFinite(input.value) && input.value >= 0;

    const rowPayload: Record<string, any> = {
      owner_id: authUserId,
      subject_id: subjectId,
      entry_type: input.entryType,
      entry_date: input.entryDate || todayLocalYmd(),
      title: cleanTitle,
      notes: input.notes.trim(),
      value: hasValue ? input.value : null,
      unit: hasValue ? input.unit || '' : '',
      photo_path: uploadedPath,
    };

    if (input.healthResult !== undefined) {
      rowPayload.health_result = input.healthResult;
    }

    const { data, error } = await supabase
      .from('care_entries')
      .insert([rowPayload])
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not save this diary entry.');
    }

    const signedUrl = uploadedPath
      ? await getSignedCarePhotoUrl(uploadedPath)
      : '';
    return mapCareEntryRow(data, signedUrl);
  } catch (err: any) {
    if (uploadedPath) {
      await removeCareStoragePaths([uploadedPath]);
    }
    console.error('[My Care] createCareEntry failed:', err);
    throw new Error(err?.message || 'Could not save this diary entry.');
  }
}

/**
 * Updates an existing care_entry and manages optional photo replacement/removal.
 */
export async function updateCareEntry(
  existing: CareEntry,
  input: CareEntryInput
): Promise<CareEntry> {
  const authUserId = await getAuthenticatedUserId();
  const cleanTitle = input.title.trim();
  if (!cleanTitle) {
    throw new Error('Please enter a title.');
  }

  let newlyUploadedPath = '';
  try {
    let nextPhotoPath = existing.photoPath;
    let shouldDeleteOldPhoto = false;

    if (input.photoDataUrl) {
      newlyUploadedPath = await uploadCareEntryPhoto(authUserId, input.photoDataUrl);
      nextPhotoPath = newlyUploadedPath;
      if (existing.photoPath) {
        shouldDeleteOldPhoto = true;
      }
    } else if (input.removeExistingPhoto) {
      nextPhotoPath = '';
      if (existing.photoPath) {
        shouldDeleteOldPhoto = true;
      }
    }

    const hasValue =
      input.value !== null && Number.isFinite(input.value) && input.value >= 0;

    const updatePayload = {
      entry_type: input.entryType,
      entry_date: input.entryDate || todayLocalYmd(),
      title: cleanTitle,
      notes: input.notes.trim(),
      value: hasValue ? input.value : null,
      unit: hasValue ? input.unit || '' : '',
      photo_path: nextPhotoPath,
    };

    const { data, error } = await supabase
      .from('care_entries')
      .update(updatePayload)
      .eq('id', existing.id)
      .eq('owner_id', authUserId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not update this entry.');
    }

    if (shouldDeleteOldPhoto && existing.photoPath) {
      await removeCareStoragePaths([existing.photoPath]);
    }

    const signedUrl = nextPhotoPath
      ? await getSignedCarePhotoUrl(nextPhotoPath)
      : '';
    return mapCareEntryRow(data, signedUrl);
  } catch (err: any) {
    if (newlyUploadedPath) {
      await removeCareStoragePaths([newlyUploadedPath]);
    }
    console.error('[My Care] updateCareEntry failed:', err);
    throw new Error(err?.message || 'Could not update this entry.');
  }
}

/**
 * Deletes a care_entry and removes its photo from private storage.
 */
export async function deleteCareEntry(entry: CareEntry): Promise<void> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const { error } = await supabase
      .from('care_entries')
      .delete()
      .eq('id', entry.id)
      .eq('owner_id', authUserId);

    if (error) {
      throw new Error(error.message || 'Could not delete this entry.');
    }

    if (entry.photoPath) {
      await removeCareStoragePaths([entry.photoPath]);
    }
  } catch (err: any) {
    console.error('[My Care] deleteCareEntry failed:', err);
    throw new Error(err?.message || 'Could not delete this entry.');
  }
}

// ==============================================================================
// CARE REMINDERS (next_due, kind, active, last_done, complete_reminder RPC)
// ==============================================================================

export const CARE_REMINDERS_REFRESH_EVENT = 'wilddex:care_reminders_refresh';

export function notifyCareRemindersChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CARE_REMINDERS_REFRESH_EVENT));
  }
}

export type CareReminderType =
  | 'watering'
  | 'feeding'
  | 'vet_visit'
  | 'vaccination'
  | 'grooming'
  | 'pruning'
  | 'treatment'
  | 'other';

export interface CareReminderTypeMeta {
  id: CareReminderType;
  label: string;
  icon: string;
}

export const CARE_REMINDER_TYPES: CareReminderTypeMeta[] = [
  { id: 'watering', label: 'Watering', icon: 'water_drop' },
  { id: 'feeding', label: 'Feeding', icon: 'eco' },
  { id: 'vet_visit', label: 'Vet visit', icon: 'medical_services' },
  { id: 'vaccination', label: 'Vaccination', icon: 'vaccines' },
  { id: 'grooming', label: 'Grooming', icon: 'content_cut' },
  { id: 'pruning', label: 'Pruning', icon: 'content_cut' },
  { id: 'treatment', label: 'Treatment', icon: 'medication' },
  { id: 'other', label: 'Other', icon: 'notifications' },
];

export function getReminderTypeMeta(type: string): CareReminderTypeMeta {
  return (
    CARE_REMINDER_TYPES.find((t) => t.id === type) || {
      id: 'other',
      label: 'Other',
      icon: 'notifications',
    }
  );
}

export type CareReminderStatus = 'overdue' | 'today' | 'upcoming';

export function getReminderStatus(nextDue: string): {
  status: CareReminderStatus;
  label: string;
} {
  const cleanDue = (nextDue || '').slice(0, 10);
  const today = todayLocalYmd();
  if (!cleanDue) return { status: 'today', label: 'Today' };
  if (cleanDue < today) return { status: 'overdue', label: 'Overdue' };
  if (cleanDue === today) return { status: 'today', label: 'Today' };
  return { status: 'upcoming', label: 'Upcoming' };
}

export function addDaysToYmd(ymd: string, days: number): string {
  const parsed = parseYmdToLocalDate(ymd) || new Date();
  const next = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate() + days
  );
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface CareReminder {
  id: string;
  subjectId: string;
  ownerId: string;
  title: string;
  kind: CareReminderType;
  nextDue: string; // YYYY-MM-DD
  repeatDays: number | null;
  active: boolean;
  lastDone: string | null;
  createdAt: string;
}

export interface DueCareReminderItem extends CareReminder {
  subjectName: string;
  subjectKind: CareKind;
}

export interface CareReminderInput {
  title: string;
  kind: CareReminderType;
  nextDue: string; // YYYY-MM-DD
  repeatDays: number | null;
}

const VALID_REMINDER_TYPES = new Set<string>(
  CARE_REMINDER_TYPES.map((t) => t.id)
);

function normalizeNextDue(row: any): string {
  if (typeof row?.next_due === 'string' && row.next_due.trim()) {
    return row.next_due.trim().slice(0, 10);
  }
  return todayLocalYmd();
}

function mapReminderRow(row: any): CareReminder {
  const rawKind = typeof row?.kind === 'string' ? row.kind : 'other';
  const kind = (VALID_REMINDER_TYPES.has(rawKind)
    ? rawKind
    : 'other') as CareReminderType;

  return {
    id: row.id,
    subjectId: row.subject_id,
    ownerId: row.owner_id,
    title: row.title || '',
    kind,
    nextDue: normalizeNextDue(row),
    repeatDays: typeof row.repeat_days === 'number' ? row.repeat_days : null,
    active: Boolean(row.active),
    lastDone: row.last_done || null,
    createdAt: row.created_at,
  };
}

export async function listCareReminders(
  subjectId: string
): Promise<CareReminder[]> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const { data, error } = await supabase
      .from('care_reminders')
      .select('*')
      .eq('owner_id', authUserId)
      .eq('subject_id', subjectId)
      .eq('active', true)
      .order('next_due', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message || 'Could not load reminders.');
    }

    return (data || []).map(mapReminderRow);
  } catch (err: any) {
    console.error('[My Care] listCareReminders failed:', err);
    throw new Error(err?.message || 'Could not load reminders.');
  }
}

/**
 * Lists all active reminders due today or overdue across non-archived subjects.
 */
export async function listDueCareRemindersAcrossSubjects(): Promise<
  DueCareReminderItem[]
> {
  try {
    if (!isSupabaseConfigured) return [];
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user?.id) return [];

    const today = todayLocalYmd();
    const { data, error } = await supabase
      .from('care_reminders')
      .select('*, care_subjects!inner(id, name, kind, archived)')
      .eq('owner_id', user.id)
      .eq('active', true)
      .eq('care_subjects.archived', false)
      .lte('next_due', today)
      .order('next_due', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message || 'Could not load today’s care reminders.');
    }

    return (data || []).map((row: any) => {
      const subj = Array.isArray(row.care_subjects)
        ? row.care_subjects[0]
        : row.care_subjects;
      const base = mapReminderRow(row);
      const kind = (['pet', 'plant', 'crop', 'tree'].includes(subj?.kind)
        ? subj.kind
        : 'plant') as CareKind;

      return {
        ...base,
        subjectName: subj?.name || 'Care diary',
        subjectKind: kind,
      };
    });
  } catch (err: any) {
    console.error('[My Care] listDueCareRemindersAcrossSubjects failed:', err);
    throw new Error(err?.message || 'Could not load today’s care reminders.');
  }
}

/**
 * Lightweight boolean check used by navigation to show the red dot when any reminder is due/overdue.
 */
export async function hasDueCareReminders(): Promise<boolean> {
  try {
    if (!isSupabaseConfigured) return false;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return false;

    const { data, error } = await supabase
      .from('care_reminders')
      .select('id, care_subjects!inner(archived)')
      .eq('owner_id', user.id)
      .eq('active', true)
      .eq('care_subjects.archived', false)
      .lte('next_due', todayLocalYmd())
      .order('next_due', { ascending: true })
      .limit(1);

    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

function validateRepeatDays(repeatDays: number | null): number | null {
  if (repeatDays === null || repeatDays === undefined) return null;
  const rounded = Math.round(repeatDays);
  if (!Number.isFinite(rounded) || rounded < 1 || rounded > 730) {
    throw new Error('Repeat interval must be between 1 and 730 days.');
  }
  return rounded;
}

export async function createCareReminder(
  subjectId: string,
  input: CareReminderInput
): Promise<CareReminder> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const cleanTitle = input.title.trim();
    if (!cleanTitle) {
      throw new Error('Please enter a reminder title.');
    }

    const repeatDays = validateRepeatDays(input.repeatDays);
    const nextDue = input.nextDue?.trim() || todayLocalYmd();

    const { data, error } = await supabase
      .from('care_reminders')
      .insert([
        {
          owner_id: authUserId,
          subject_id: subjectId,
          title: cleanTitle,
          kind: input.kind || 'other',
          next_due: nextDue,
          repeat_days: repeatDays,
          active: true,
        },
      ])
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not save reminder.');
    }

    notifyCareRemindersChanged();
    return mapReminderRow(data);
  } catch (err: any) {
    console.error('[My Care] createCareReminder failed:', err);
    throw new Error(err?.message || 'Could not save reminder.');
  }
}

export async function updateCareReminder(
  reminderId: string,
  input: CareReminderInput
): Promise<CareReminder> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const cleanTitle = input.title.trim();
    if (!cleanTitle) {
      throw new Error('Please enter a reminder title.');
    }

    const repeatDays = validateRepeatDays(input.repeatDays);
    const nextDue = input.nextDue?.trim() || todayLocalYmd();

    const { data, error } = await supabase
      .from('care_reminders')
      .update({
        title: cleanTitle,
        kind: input.kind || 'other',
        next_due: nextDue,
        repeat_days: repeatDays,
      })
      .eq('id', reminderId)
      .eq('owner_id', authUserId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not update reminder.');
    }

    notifyCareRemindersChanged();
    return mapReminderRow(data);
  } catch (err: any) {
    console.error('[My Care] updateCareReminder failed:', err);
    throw new Error(err?.message || 'Could not update reminder.');
  }
}

/**
 * Calls supabase.rpc('complete_reminder', { p_id }) which logs the diary entry
 * and sets the next due date (or deactivates a one-time reminder).
 */
export async function completeCareReminder(reminderId: string): Promise<void> {
  try {
    await getAuthenticatedUserId();
    const { error } = await supabase.rpc('complete_reminder', {
      p_id: reminderId,
    });

    if (error) {
      throw new Error(error.message || 'Could not mark reminder done.');
    }

    notifyCareRemindersChanged();
  } catch (err: any) {
    console.error('[My Care] completeCareReminder failed:', err);
    throw new Error(err?.message || 'Could not mark reminder done.');
  }
}

/**
 * Snoozes a reminder by 1 day (relative to today if overdue, or next_due + 1 if today/future).
 */
export async function snoozeCareReminder(
  reminder: CareReminder,
  days = 1
): Promise<CareReminder> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const today = todayLocalYmd();
    const baseDate = reminder.nextDue < today ? today : reminder.nextDue;
    const snoozedDue = addDaysToYmd(baseDate, days);

    const { data, error } = await supabase
      .from('care_reminders')
      .update({
        next_due: snoozedDue,
      })
      .eq('id', reminder.id)
      .eq('owner_id', authUserId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not snooze reminder.');
    }

    notifyCareRemindersChanged();
    return mapReminderRow(data);
  } catch (err: any) {
    console.error('[My Care] snoozeCareReminder failed:', err);
    throw new Error(err?.message || 'Could not snooze reminder.');
  }
}

export async function deleteCareReminder(reminderId: string): Promise<void> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const { error } = await supabase
      .from('care_reminders')
      .delete()
      .eq('id', reminderId)
      .eq('owner_id', authUserId);

    if (error) {
      throw new Error(error.message || 'Could not delete reminder.');
    }

    notifyCareRemindersChanged();
  } catch (err: any) {
    console.error('[My Care] deleteCareReminder failed:', err);
    throw new Error(err?.message || 'Could not delete reminder.');
  }
}

async function listCareBucketPathsRecursive(prefix: string): Promise<string[]> {
  const collected: string[] = [];
  const limit = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from('care')
      .list(prefix, { limit, offset });

    if (error) {
      throw new Error(error.message || 'Could not list stored care photos.');
    }

    const items = Array.isArray(data) ? data : [];
    for (const item of items) {
      if (!item?.name || item.name === '.emptyFolderPlaceholder') continue;
      const fullPath = `${prefix}/${item.name}`;
      if (item.id === null) {
        const nested = await listCareBucketPathsRecursive(fullPath);
        collected.push(...nested);
      } else {
        collected.push(fullPath);
      }
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return collected;
}

/**
 * Deletes all care_subjects (cascading care_entries and care_reminders)
 * and all files belonging to the signed-in user in the private 'care' bucket.
 */
export async function deleteAllCareData(): Promise<{
  deletedSubjects: number;
  deletedFiles: number;
}> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const pathSet = new Set<string>();

    // 1. Collect paths from DB rows first
    const { data: subjectRows, error: subjFetchErr } = await supabase
      .from('care_subjects')
      .select('id, photo_path')
      .eq('owner_id', authUserId);

    if (subjFetchErr) {
      throw new Error(subjFetchErr.message || 'Could not read your care data.');
    }

    for (const row of subjectRows || []) {
      if (typeof row?.photo_path === 'string' && row.photo_path.trim()) {
        pathSet.add(row.photo_path.trim());
      }
    }

    const { data: entryRows, error: entryFetchErr } = await supabase
      .from('care_entries')
      .select('photo_path')
      .eq('owner_id', authUserId);

    if (!entryFetchErr && Array.isArray(entryRows)) {
      for (const row of entryRows) {
        if (typeof row?.photo_path === 'string' && row.photo_path.trim()) {
          pathSet.add(row.photo_path.trim());
        }
      }
    }

    // 2. Also list the user's folder in the private 'care' storage bucket
    const listedPaths = await listCareBucketPathsRecursive(authUserId);
    for (const p of listedPaths) {
      pathSet.add(p);
    }

    const cleanPaths = Array.from(pathSet).filter(
      (p) => p.length > 0 && !p.startsWith('http') && !p.startsWith('data:')
    );

    // 3. Remove files in batches of 100
    for (let i = 0; i < cleanPaths.length; i += 100) {
      const chunk = cleanPaths.slice(i, i + 100);
      const { error: removeErr } = await supabase.storage.from('care').remove(chunk);
      if (removeErr) {
        throw new Error(removeErr.message || 'Could not delete stored care photos.');
      }
    }

    // 4. Delete all care_subjects (care_entries & care_reminders cascade automatically)
    const { error: deleteSubjErr } = await supabase
      .from('care_subjects')
      .delete()
      .eq('owner_id', authUserId);

    if (deleteSubjErr) {
      throw new Error(deleteSubjErr.message || 'Could not delete your care records.');
    }

    notifyCareRemindersChanged();

    return {
      deletedSubjects: (subjectRows || []).length,
      deletedFiles: cleanPaths.length,
    };
  } catch (err: any) {
    console.error('[My Care] deleteAllCareData failed:', err);
    throw new Error(err?.message || 'Could not delete your care data.');
  }
}
