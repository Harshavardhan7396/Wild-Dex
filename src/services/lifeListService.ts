import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { compressImageToJpegBlob, getSignedPhotoUrl } from './supabaseCollectionService';

export const LIFE_LIST_PAGE_SIZE = 30;

export type LifeListSort = 'recent' | 'az' | 'rarity' | 'favorites';

export interface LifeListGroup {
  key: string;
  label: string;
  count: number | null;
}

export interface LifeListSummary {
  speciesFound: number;
  totalSightings: number;
  groups: LifeListGroup[];
  yearGoal: number | null;
  yearSpeciesCount: number;
}

export interface LifeListEntry {
  itemId: string;
  speciesKey: string;
  speciesName: string;
  scientificName: string;
  category: string;
  rarity: string;
  photoPath: string;
  photoUrl: string;
  firstSeen: string;
  lastSeen: string;
  sightings: number;
  favorite: boolean;
  notes: string;
}

export interface SightingRecord {
  id: string;
  ownerId: string;
  albumId: string | null;
  speciesName: string;
  scientificName: string;
  category: string;
  confidence: number | null;
  rarity: string;
  photoPath: string;
  photoUrl: string;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  seenOn: string | null;
  notes: string;
  favorite: boolean;
  effectiveDate: string;
}

export interface SpeciesDetailData {
  speciesName: string;
  scientificName: string;
  category: string;
  rarity: string;
  heroPhotoUrl: string;
  firstSeen: string;
  lastSeen: string;
  sightings: SightingRecord[];
}

export interface YearlyGoalState {
  year: number;
  targetSpecies: number | null;
  speciesThisYear: number;
}

export interface InatTaxonSuggestion {
  id: number;
  commonName: string;
  scientificName: string;
  category: string;
  photoUrl?: string;
}

const COLLECTION_ITEM_COLUMNS =
  'id, owner_id, album_id, species_name, scientific_name, category, confidence, rarity, photo_path, lat, lng, created_at, notes, seen_on, favorite';

function ensureConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Database is not configured yet.');
  }
}

async function ensureAuthenticatedUserId(): Promise<string> {
  ensureConfigured();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) {
    throw new Error('Please sign in to view your life list.');
  }
  return user.id;
}

export function todayLocalYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatGroupLabel(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return 'Other';
  return cleaned
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeGroups(rawGroups: unknown): LifeListGroup[] {
  if (!rawGroups) return [];

  if (Array.isArray(rawGroups)) {
    const seen = new Set<string>();
    const result: LifeListGroup[] = [];
    for (const item of rawGroups) {
      if (typeof item === 'string') {
        const key = item.trim();
        if (!key || seen.has(key.toLowerCase())) continue;
        seen.add(key.toLowerCase());
        result.push({
          key,
          label: formatGroupLabel(key),
          count: null,
        });
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const rawKey = String(
          obj.group ??
            obj.group_name ??
            obj.category ??
            obj.key ??
            obj.slug ??
            obj.id ??
            obj.name ??
            obj.label ??
            ''
        ).trim();
        if (!rawKey) continue;
        const lower = rawKey.toLowerCase();
        if (lower === 'all' || seen.has(lower)) continue;
        seen.add(lower);

        const rawLabel = String(
          obj.label ?? obj.title ?? obj.display_name ?? obj.name ?? rawKey
        ).trim();
        const count =
          toFiniteNumber(obj.count) ??
          toFiniteNumber(obj.species_count) ??
          toFiniteNumber(obj.species_found) ??
          toFiniteNumber(obj.total) ??
          toFiniteNumber(obj.sightings) ??
          null;

        result.push({
          key: rawKey,
          label: rawLabel ? formatGroupLabel(rawLabel) : formatGroupLabel(rawKey),
          count,
        });
      }
    }
    return result;
  }

  if (typeof rawGroups === 'object') {
    return Object.entries(rawGroups as Record<string, unknown>)
      .filter(([k]) => k.trim() !== '' && k.toLowerCase() !== 'all')
      .map(([k, v]) => ({
        key: k,
        label: formatGroupLabel(k),
        count: toFiniteNumber(v),
      }));
  }

  return [];
}

export async function fetchLifeListSummary(): Promise<LifeListSummary> {
  await ensureAuthenticatedUserId();

  try {
    const { data, error } = await supabase.rpc('life_list_summary');
    if (error) {
      throw new Error(error.message || 'Could not load life list summary.');
    }

    const row: Record<string, unknown> = Array.isArray(data)
      ? (data[0] as Record<string, unknown>) || {}
      : ((data as Record<string, unknown>) || {});

    const speciesFound =
      toFiniteNumber(row.species_found) ??
      toFiniteNumber(row.species_count) ??
      toFiniteNumber(row.unique_species) ??
      toFiniteNumber(row.total_species) ??
      toFiniteNumber(row.species) ??
      0;

    const totalSightings =
      toFiniteNumber(row.total_sightings) ??
      toFiniteNumber(row.sightings_count) ??
      toFiniteNumber(row.sightings) ??
      toFiniteNumber(row.total_count) ??
      toFiniteNumber(row.total_items) ??
      0;

    const groups = normalizeGroups(
      row.groups ?? row.categories ?? row.by_group ?? row.group_counts
    );

    let yearGoal: number | null = null;
    let yearSpeciesCount = 0;

    if (row.goal && typeof row.goal === 'object') {
      const goalObj = row.goal as Record<string, unknown>;
      yearGoal =
        toFiniteNumber(goalObj.target) ??
        toFiniteNumber(goalObj.goal) ??
        toFiniteNumber(goalObj.target_species) ??
        null;
      yearSpeciesCount =
        toFiniteNumber(goalObj.current) ??
        toFiniteNumber(goalObj.count) ??
        toFiniteNumber(goalObj.species_count) ??
        toFiniteNumber(goalObj.progress) ??
        0;
    } else {
      yearGoal =
        toFiniteNumber(row.year_goal) ??
        toFiniteNumber(row.annual_goal) ??
        toFiniteNumber(row.goal_target) ??
        toFiniteNumber(row.target_species) ??
        toFiniteNumber(row.goal) ??
        null;

      yearSpeciesCount =
        toFiniteNumber(row.year_species) ??
        toFiniteNumber(row.year_species_count) ??
        toFiniteNumber(row.this_year_species) ??
        toFiniteNumber(row.this_year_count) ??
        toFiniteNumber(row.species_this_year) ??
        toFiniteNumber(row.current_year_species) ??
        toFiniteNumber(row.goal_current) ??
        toFiniteNumber(row.goal_progress) ??
        0;
    }

    if (yearGoal !== null && yearGoal <= 0) {
      yearGoal = null;
    }

    return {
      speciesFound: Math.max(0, Math.round(speciesFound)),
      totalSightings: Math.max(0, Math.round(totalSightings)),
      groups,
      yearGoal,
      yearSpeciesCount: Math.max(0, Math.round(yearSpeciesCount)),
    };
  } catch (err: any) {
    throw new Error(err?.message || 'Could not load life list summary.');
  }
}

function buildEntryKey(row: Record<string, unknown>): string {
  const explicitKey = String(
    row.species_key ?? row.key ?? row.slug ?? row.id ?? ''
  ).trim();
  if (explicitKey) return explicitKey;
  const scientific = String(row.scientific_name ?? '').trim();
  if (scientific) return scientific.toLowerCase().replace(/\s+/g, '-');
  const common = String(row.species_name ?? row.common_name ?? '').trim();
  return common.toLowerCase().replace(/\s+/g, '-') || 'species';
}

function mapRawLifeListRow(
  row: Record<string, unknown>,
  signedUrlMap?: Map<string, string>
): LifeListEntry {
  const itemId = String(
    row.id ?? row.latest_id ?? row.representative_id ?? row.item_id ?? ''
  ).trim();
  const speciesName = String(
    row.species_name ?? row.common_name ?? row.name ?? 'Unknown species'
  ).trim();
  const scientificName = String(row.scientific_name ?? '').trim();
  const category = String(
    row.category ?? row.group_name ?? row.taxon_group ?? ''
  ).trim();
  const rarity = String(row.rarity ?? 'Common').trim();
  const photoPath = String(
    row.photo_path ?? row.cover_photo_path ?? row.latest_photo_path ?? ''
  ).trim();

  let photoUrl = '';
  if (photoPath) {
    if (
      photoPath.startsWith('http://') ||
      photoPath.startsWith('https://') ||
      photoPath.startsWith('data:')
    ) {
      photoUrl = photoPath;
    } else if (signedUrlMap?.has(photoPath)) {
      photoUrl = signedUrlMap.get(photoPath) || '';
    }
  }

  const firstSeen = String(
    row.first_seen ??
      row.first_seen_on ??
      row.first_seen_at ??
      row.min_seen_on ??
      row.seen_on ??
      row.created_at ??
      ''
  ).trim();

  const lastSeen = String(
    row.last_seen ??
      row.last_seen_on ??
      row.last_seen_at ??
      row.max_seen_on ??
      row.latest_seen_on ??
      firstSeen
  ).trim();

  const sightings = Math.max(
    1,
    Math.round(
      toFiniteNumber(row.sightings) ??
        toFiniteNumber(row.sighting_count) ??
        toFiniteNumber(row.sightings_count) ??
        toFiniteNumber(row.count) ??
        toFiniteNumber(row.total_sightings) ??
        1
    )
  );

  const favorite = Boolean(
    row.favorite ?? row.is_favorite ?? row.has_favorite ?? false
  );

  const notes = String(row.notes ?? row.latest_notes ?? '').trim();

  return {
    itemId,
    speciesKey: buildEntryKey(row),
    speciesName,
    scientificName,
    category,
    rarity,
    photoPath,
    photoUrl,
    firstSeen,
    lastSeen,
    sightings,
    favorite,
    notes,
  };
}

async function resolveScanPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const storagePaths = Array.from(
    new Set(
      paths.filter(
        (p) =>
          Boolean(p) &&
          !p.startsWith('http://') &&
          !p.startsWith('https://') &&
          !p.startsWith('data:')
      )
    )
  );
  if (storagePaths.length === 0) return map;

  try {
    const { data, error } = await supabase.storage
      .from('scans')
      .createSignedUrls(storagePaths, 3600);

    if (!error && Array.isArray(data)) {
      for (const item of data) {
        if (item?.path && item?.signedUrl) {
          map.set(item.path, item.signedUrl);
        }
      }
      return map;
    }
  } catch {
    // Fall back to individual signing below
  }

  await Promise.all(
    storagePaths.map(async (path) => {
      try {
        const url = await getSignedPhotoUrl(path);
        if (url) map.set(path, url);
      } catch {
        // Leave missing so icon fallback renders
      }
    })
  );

  return map;
}

export async function fetchLifeListPage(params: {
  group: string | null;
  search: string;
  sort: LifeListSort;
  limit?: number;
  offset: number;
}): Promise<{ entries: LifeListEntry[]; hasMore: boolean }> {
  await ensureAuthenticatedUserId();

  const limit = params.limit ?? LIFE_LIST_PAGE_SIZE;
  const trimmedSearch = params.search.trim();

  try {
    const { data, error } = await supabase.rpc('life_list', {
      p_group: params.group || null,
      p_search: trimmedSearch || null,
      p_sort: params.sort,
      p_limit: limit,
      p_offset: params.offset,
    });

    if (error) {
      throw new Error(error.message || 'Could not load your life list.');
    }

    const rows = Array.isArray(data)
      ? (data as Record<string, unknown>[])
      : [];

    const photoPaths = rows
      .map((r) =>
        String(r.photo_path ?? r.cover_photo_path ?? r.latest_photo_path ?? '').trim()
      )
      .filter(Boolean);

    const signedUrlMap = await resolveScanPhotoUrls(photoPaths);
    const entries = rows.map((row) => mapRawLifeListRow(row, signedUrlMap));

    return {
      entries,
      hasMore: rows.length >= limit,
    };
  } catch (err: any) {
    throw new Error(err?.message || 'Could not load your life list.');
  }
}

export async function fetchAllLifeListEntries(params: {
  group: string | null;
  search: string;
  sort: LifeListSort;
}): Promise<LifeListEntry[]> {
  await ensureAuthenticatedUserId();

  const trimmedSearch = params.search.trim();
  const allEntries: LifeListEntry[] = [];
  let offset = 0;
  const maxRows = 15000;

  try {
    while (offset < maxRows) {
      const { data, error } = await supabase.rpc('life_list', {
        p_group: params.group || null,
        p_search: trimmedSearch || null,
        p_sort: params.sort,
        p_limit: LIFE_LIST_PAGE_SIZE,
        p_offset: offset,
      });

      if (error) {
        throw new Error(error.message || 'Could not export your life list.');
      }

      const rows = Array.isArray(data)
        ? (data as Record<string, unknown>[])
        : [];

      if (rows.length === 0) break;

      for (const row of rows) {
        allEntries.push(mapRawLifeListRow(row));
      }

      if (rows.length < LIFE_LIST_PAGE_SIZE) break;
      offset += rows.length;
    }

    return allEntries;
  } catch (err: any) {
    throw new Error(err?.message || 'Could not export your life list.');
  }
}

function extractEffectiveYmd(seenOn?: string | null, createdAt?: string | null): string {
  const primary = (seenOn || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(primary)) return primary.slice(0, 10);
  const fallback = (createdAt || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(fallback)) return fallback.slice(0, 10);
  const parsed = new Date(primary || fallback);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

function escapeIlikePattern(val: string): string {
  return val.replace(/[\\%_]/g, '\\$&');
}

function pickHighestRarity(rarities: string[]): string {
  const rank = (r: string) => {
    const n = r.trim().toLowerCase();
    if (n === 'legendary' || n === 'very rare' || n === 'very_rare' || n === 'cr') return 4;
    if (n === 'rare' || n === 'en') return 3;
    if (n === 'uncommon' || n === 'vu' || n === 'nt') return 2;
    return 1;
  };
  let best = 'Common';
  let bestScore = 0;
  for (const r of rarities) {
    const s = rank(r);
    if (s > bestScore) {
      bestScore = s;
      best = r || 'Common';
    }
  }
  return best;
}

function mapCollectionItemToSighting(
  row: Record<string, unknown>,
  signedUrlMap?: Map<string, string>
): SightingRecord {
  const photoPath = String(row.photo_path ?? '').trim();
  let photoUrl = '';
  if (photoPath) {
    if (
      photoPath.startsWith('http://') ||
      photoPath.startsWith('https://') ||
      photoPath.startsWith('data:')
    ) {
      photoUrl = photoPath;
    } else if (signedUrlMap?.has(photoPath)) {
      photoUrl = signedUrlMap.get(photoPath) || '';
    }
  }

  const seenOnRaw = row.seen_on ? String(row.seen_on).trim() : null;
  const createdAt = String(row.created_at ?? '').trim();
  const effectiveDate = seenOnRaw || createdAt;

  return {
    id: String(row.id ?? ''),
    ownerId: String(row.owner_id ?? ''),
    albumId: row.album_id ? String(row.album_id) : null,
    speciesName: String(row.species_name ?? 'Unknown species').trim(),
    scientificName: String(row.scientific_name ?? '').trim(),
    category: String(row.category ?? '').trim(),
    confidence: toFiniteNumber(row.confidence),
    rarity: String(row.rarity ?? 'Common').trim(),
    photoPath,
    photoUrl,
    lat: toFiniteNumber(row.lat),
    lng: toFiniteNumber(row.lng),
    createdAt,
    seenOn: seenOnRaw ? seenOnRaw.slice(0, 10) : null,
    notes: String(row.notes ?? '').trim(),
    favorite: Boolean(row.favorite),
    effectiveDate,
  };
}

export async function fetchSpeciesDetailAndSightings(
  itemIdOrKey: string,
  hintSpeciesName?: string
): Promise<SpeciesDetailData> {
  const userId = await ensureAuthenticatedUserId();
  const decodedParam = decodeURIComponent(itemIdOrKey || '').trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  try {
    let targetSpeciesName = (hintSpeciesName || '').trim();

    if (!targetSpeciesName && uuidRegex.test(decodedParam)) {
      const { data: seedRow, error: seedError } = await supabase
        .from('collection_items')
        .select(COLLECTION_ITEM_COLUMNS)
        .eq('id', decodedParam)
        .eq('owner_id', userId)
        .maybeSingle();

      if (seedError) {
        throw new Error(seedError.message || 'Could not load this sighting.');
      }
      if (seedRow?.species_name) {
        targetSpeciesName = String(seedRow.species_name).trim();
      }
    }

    let rawRows: Record<string, unknown>[] = [];

    if (targetSpeciesName) {
      const { data, error } = await supabase
        .from('collection_items')
        .select(COLLECTION_ITEM_COLUMNS)
        .eq('owner_id', userId)
        .ilike('species_name', escapeIlikePattern(targetSpeciesName));

      if (error) {
        throw new Error(error.message || 'Could not load sightings.');
      }

      const targetLower = targetSpeciesName.toLowerCase();
      rawRows = ((data || []) as Record<string, unknown>[]).filter(
        (r) => String(r.species_name ?? '').trim().toLowerCase() === targetLower
      );
    } else {
      const { data, error } = await supabase
        .from('collection_items')
        .select(COLLECTION_ITEM_COLUMNS)
        .eq('owner_id', userId);

      if (error) {
        throw new Error(error.message || 'Could not load sightings.');
      }

      const allUserRows = (data || []) as Record<string, unknown>[];
      const paramLower = decodedParam.toLowerCase();
      const matched = allUserRows.find((r) => {
        const idStr = String(r.id ?? '').trim().toLowerCase();
        const sciSlug = String(r.scientific_name ?? '').trim().toLowerCase().replace(/\s+/g, '-');
        const nameLower = String(r.species_name ?? '').trim().toLowerCase();
        const nameSlug = nameLower.replace(/\s+/g, '-');
        return (
          idStr === paramLower ||
          nameLower === paramLower ||
          nameSlug === paramLower ||
          (sciSlug !== '' && sciSlug === paramLower)
        );
      });

      if (matched) {
        const matchedNameLower = String(matched.species_name ?? '').trim().toLowerCase();
        rawRows = allUserRows.filter(
          (r) => String(r.species_name ?? '').trim().toLowerCase() === matchedNameLower
        );
      }
    }

    if (rawRows.length === 0) {
      throw new Error('No sightings found for this species.');
    }

    const photoPaths = rawRows
      .map((r) => String(r.photo_path ?? '').trim())
      .filter(Boolean);
    const signedUrlMap = await resolveScanPhotoUrls(photoPaths);

    const sightings = rawRows
      .map((r) => mapCollectionItemToSighting(r, signedUrlMap))
      .sort((a, b) => {
        const dateA = extractEffectiveYmd(a.seenOn, a.createdAt);
        const dateB = extractEffectiveYmd(b.seenOn, b.createdAt);
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return b.createdAt.localeCompare(a.createdAt);
      });

    const firstSighting = sightings[sightings.length - 1];
    const latestSighting = sightings[0];
    const heroPhoto = sightings.find((s) => Boolean(s.photoUrl))?.photoUrl || '';
    const scientificName =
      sightings.find((s) => Boolean(s.scientificName))?.scientificName || '';
    const category = sightings.find((s) => Boolean(s.category))?.category || '';

    return {
      speciesName: latestSighting.speciesName,
      scientificName,
      category,
      rarity: pickHighestRarity(sightings.map((s) => s.rarity)),
      heroPhotoUrl: heroPhoto,
      firstSeen: firstSighting.effectiveDate,
      lastSeen: latestSighting.effectiveDate,
      sightings,
    };
  } catch (err: any) {
    throw new Error(err?.message || 'Could not load species details.');
  }
}

export async function updateSighting(params: {
  id: string;
  notes: string;
  seenOn: string;
  favorite: boolean;
}): Promise<SightingRecord> {
  const userId = await ensureAuthenticatedUserId();
  const trimmedNotes = params.notes.trim().slice(0, 1000);
  const trimmedSeenOn = params.seenOn.trim();

  if (trimmedSeenOn && trimmedSeenOn > todayLocalYmd()) {
    throw new Error('Date seen cannot be in the future.');
  }

  try {
    const { data, error } = await supabase
      .from('collection_items')
      .update({
        notes: trimmedNotes || null,
        seen_on: trimmedSeenOn || null,
        favorite: Boolean(params.favorite),
      })
      .eq('id', params.id)
      .eq('owner_id', userId)
      .select(COLLECTION_ITEM_COLUMNS)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not save sighting changes.');
    }

    const row = data as Record<string, unknown>;
    const photoPath = String(row.photo_path ?? '').trim();
    const signedUrlMap = photoPath
      ? await resolveScanPhotoUrls([photoPath])
      : new Map<string, string>();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wilddex:collection_updated'));
    }

    return mapCollectionItemToSighting(row, signedUrlMap);
  } catch (err: any) {
    throw new Error(err?.message || 'Could not save sighting changes.');
  }
}

export async function deleteSighting(params: {
  id: string;
  photoPath?: string;
}): Promise<void> {
  const userId = await ensureAuthenticatedUserId();

  try {
    const { error: deleteErr } = await supabase
      .from('collection_items')
      .delete()
      .eq('id', params.id)
      .eq('owner_id', userId);

    if (deleteErr) {
      throw new Error(deleteErr.message || 'Could not delete this sighting.');
    }

    const storagePath = (params.photoPath || '').trim();
    if (
      storagePath &&
      !storagePath.startsWith('http://') &&
      !storagePath.startsWith('https://') &&
      !storagePath.startsWith('data:')
    ) {
      try {
        const { count, error: countErr } = await supabase
          .from('collection_items')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', userId)
          .eq('photo_path', storagePath);

        if (!countErr && (count ?? 0) === 0) {
          await supabase.storage.from('scans').remove([storagePath]);
        }
      } catch (storageErr) {
        console.warn('Could not clean up unused scan photo:', storageErr);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wilddex:collection_updated'));
    }
  } catch (err: any) {
    throw new Error(err?.message || 'Could not delete this sighting.');
  }
}

export function mapInatIconicTaxonToCategory(iconicTaxonName?: string | null): string {
  const normalized = (iconicTaxonName || '').trim().toLowerCase();
  if (normalized === 'aves') return 'birds';
  if (normalized === 'mammalia') return 'mammals';
  if (normalized === 'reptilia') return 'reptiles';
  if (normalized === 'amphibia') return 'amphibians';
  if (normalized === 'insecta' || normalized === 'arachnida') return 'insects';
  if (normalized === 'actinopterygii' || normalized === 'mollusca') return 'marine';
  if (normalized === 'plantae') return 'plants';
  if (normalized === 'fungi') return 'fungi';
  if (normalized === 'animalia') return 'animals';
  return 'other';
}

export async function searchInatTaxa(
  query: string,
  signal?: AbortSignal
): Promise<InatTaxonSuggestion[]> {
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
      category: mapInatIconicTaxonToCategory(taxon.iconic_taxon_name),
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

export async function addPastSighting(params: {
  speciesName: string;
  scientificName?: string;
  category?: string;
  seenOn: string;
  notes?: string;
  photoDataUrl?: string | null;
}): Promise<SightingRecord> {
  const userId = await ensureAuthenticatedUserId();

  const speciesName = params.speciesName.trim();
  if (!speciesName) {
    throw new Error('Please enter or choose a species name.');
  }

  const seenOn = params.seenOn.trim();
  if (!seenOn) {
    throw new Error('Please choose the date you saw it.');
  }
  if (seenOn > todayLocalYmd()) {
    throw new Error('Date seen cannot be in the future.');
  }

  let uploadedPhotoPath: string | null = null;
  if (params.photoDataUrl) {
    try {
      const jpegBlob = await compressImageToJpegBlob(params.photoDataUrl, 1024);
      const storagePath = `${userId}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('scans')
        .upload(storagePath, jpegBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(uploadErr.message || 'Could not upload your photo.');
      }
      uploadedPhotoPath = storagePath;
    } catch (err: any) {
      throw new Error(err?.message || 'Could not upload your photo.');
    }
  }

  const trimmedScientific = (params.scientificName || '').trim();
  const trimmedCategory = (params.category || 'other').trim() || 'other';
  const trimmedNotes = (params.notes || '').trim().slice(0, 1000);

  try {
    // Insert with owner_id, seen_on, category, notes; leave confidence, lat, lng empty
    const insertRow: Record<string, unknown> = {
      owner_id: userId,
      species_name: speciesName,
      scientific_name: trimmedScientific || null,
      category: trimmedCategory,
      rarity: 'Common',
      photo_path: uploadedPhotoPath,
      notes: trimmedNotes || null,
      seen_on: seenOn,
      favorite: false,
    };

    const { data, error: insertErr } = await supabase
      .from('collection_items')
      .insert([insertRow])
      .select(COLLECTION_ITEM_COLUMNS)
      .single();

    if (insertErr || !data) {
      throw new Error(insertErr?.message || 'Could not save this sighting.');
    }

    const row = data as Record<string, unknown>;
    const signedUrlMap = uploadedPhotoPath
      ? await resolveScanPhotoUrls([uploadedPhotoPath])
      : new Map<string, string>();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wilddex:collection_updated'));
    }

    return mapCollectionItemToSighting(row, signedUrlMap);
  } catch (err: any) {
    throw new Error(err?.message || 'Could not save this sighting.');
  }
}

export async function fetchYearlyGoal(year: number): Promise<YearlyGoalState> {
  const userId = await ensureAuthenticatedUserId();

  try {
    const [goalRes, itemsRes] = await Promise.all([
      supabase
        .from('life_goals')
        .select('owner_id, year, target_species, created_at')
        .eq('owner_id', userId)
        .eq('year', year)
        .maybeSingle(),
      supabase
        .from('collection_items')
        .select('species_name, seen_on, created_at')
        .eq('owner_id', userId),
    ]);

    if (goalRes.error) {
      throw new Error(goalRes.error.message || 'Could not load your yearly goal.');
    }
    if (itemsRes.error) {
      throw new Error(itemsRes.error.message || 'Could not count species for this year.');
    }

    const earliestDateBySpecies = new Map<string, string>();
    for (const row of (itemsRes.data || []) as Record<string, unknown>[]) {
      const speciesLower = String(row.species_name ?? '').trim().toLowerCase();
      if (!speciesLower) continue;
      const ymd = extractEffectiveYmd(
        row.seen_on ? String(row.seen_on) : null,
        row.created_at ? String(row.created_at) : null
      );
      if (!ymd) continue;
      const existing = earliestDateBySpecies.get(speciesLower);
      if (!existing || ymd < existing) {
        earliestDateBySpecies.set(speciesLower, ymd);
      }
    }

    const yearPrefix = `${year}-`;
    let speciesThisYear = 0;
    for (const firstYmd of earliestDateBySpecies.values()) {
      if (firstYmd.startsWith(yearPrefix)) {
        speciesThisYear += 1;
      }
    }

    const targetRaw = goalRes.data?.target_species;
    const parsedTarget = toFiniteNumber(targetRaw);
    const targetSpecies =
      parsedTarget !== null && parsedTarget > 0 ? Math.round(parsedTarget) : null;

    return {
      year,
      targetSpecies,
      speciesThisYear,
    };
  } catch (err: any) {
    throw new Error(err?.message || 'Could not load your yearly goal.');
  }
}

export async function saveYearlyGoal(
  year: number,
  targetSpecies: number
): Promise<number> {
  const userId = await ensureAuthenticatedUserId();
  const cleanTarget = Math.round(targetSpecies);
  if (!Number.isFinite(cleanTarget) || cleanTarget < 1 || cleanTarget > 10000) {
    throw new Error('Please enter a goal between 1 and 10,000 species.');
  }

  try {
    const { data, error } = await supabase
      .from('life_goals')
      .upsert(
        {
          owner_id: userId,
          year,
          target_species: cleanTarget,
        },
        { onConflict: 'owner_id,year' }
      )
      .select('owner_id, year, target_species, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not save your yearly goal.');
    }

    return Math.round(Number(data.target_species) || cleanTarget);
  } catch (err: any) {
    throw new Error(err?.message || 'Could not save your yearly goal.');
  }
}

function escapeCsvCell(value: string): string {
  const needsQuotes = /[",\r\n]/.test(value);
  const safe = value.replace(/"/g, '""');
  return needsQuotes ? `"${safe}"` : safe;
}

function formatCsvDate(value: string): string {
  if (!value) return '';
  const dateOnlyMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnlyMatch) return dateOnlyMatch[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

export function buildLifeListCsv(entries: LifeListEntry[]): string {
  const headers = [
    'species',
    'scientific name',
    'category',
    'first seen',
    'last seen',
    'sightings',
    'notes',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const entry of entries) {
    lines.push(
      [
        entry.speciesName,
        entry.scientificName,
        entry.category,
        formatCsvDate(entry.firstSeen),
        formatCsvDate(entry.lastSeen),
        String(entry.sightings),
        entry.notes,
      ]
        .map((cell) => escapeCsvCell(cell || ''))
        .join(',')
    );
  }

  return lines.join('\r\n');
}

export function downloadLifeListCsv(entries: LifeListEntry[]): void {
  const csv = buildLifeListCsv(entries);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `wilddex-life-list-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatLifeListDate(value?: string | null): string {
  if (!value) return 'Unknown date';
  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let dateObj: Date;
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    dateObj = new Date(year, month - 1, day);
  } else {
    dateObj = new Date(trimmed);
  }

  if (Number.isNaN(dateObj.getTime())) return trimmed;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateObj);
}

export function formatRaritySimple(rarity?: string | null): {
  label: string;
  badgeClass: string;
} {
  const normalized = (rarity || '').trim().toLowerCase();
  if (
    normalized === 'legendary' ||
    normalized === 'very rare' ||
    normalized === 'very_rare' ||
    normalized === 'cr' ||
    normalized.includes('critically')
  ) {
    return {
      label: 'Very rare',
      badgeClass: 'bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary/20',
    };
  }
  if (
    normalized === 'rare' ||
    normalized === 'en' ||
    normalized.includes('endangered')
  ) {
    return {
      label: 'Rare',
      badgeClass: 'bg-tertiary-fixed/70 text-on-tertiary-fixed-variant border border-tertiary/15',
    };
  }
  if (
    normalized === 'uncommon' ||
    normalized === 'vu' ||
    normalized === 'nt' ||
    normalized.includes('vulnerable') ||
    normalized.includes('near threatened')
  ) {
    return {
      label: 'Uncommon',
      badgeClass: 'bg-secondary-container/70 text-on-secondary-container border border-secondary/20',
    };
  }
  return {
    label: 'Common',
    badgeClass: 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30',
  };
}

export function getLifeListCategoryIcon(category?: string | null): string {
  const normalized = (category || '').trim().toLowerCase();
  if (normalized.includes('bird') || normalized.includes('avian')) return 'flutter_dash';
  if (normalized.includes('insect') || normalized.includes('bug') || normalized.includes('butterfly')) return 'pest_control';
  if (normalized.includes('plant') || normalized.includes('flower')) return 'local_florist';
  if (normalized.includes('tree')) return 'park';
  if (normalized.includes('fungi') || normalized.includes('mushroom')) return 'eco';
  if (normalized.includes('marine') || normalized.includes('fish')) return 'water';
  if (normalized.includes('reptile') || normalized.includes('amphibian')) return 'pest_control_rodent';
  if (normalized.includes('mammal') || normalized.includes('animal')) return 'pets';
  return 'nature';
}
