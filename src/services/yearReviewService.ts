import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getSignedPhotoUrl } from './supabaseCollectionService';

export interface YearReviewMonth {
  month: number; // 1..12
  label: string;
  shortLabel: string;
  count: number;
}

export interface YearReviewRarest {
  name: string;
  rarity: string;
  photoPath: string;
  photoUrl: string;
}

export interface YearReviewTopSpecies {
  name: string;
  count: number;
}

export interface YearReviewGoal {
  targetSpecies: number;
  currentSpecies: number;
}

export interface YearReviewData {
  year: number;
  sightings: number | null;
  species: number | null;
  newSpecies: number | null;
  topCategory: string | null;
  busiestMonth: number | null;
  busiestMonthName: string | null;
  months: YearReviewMonth[];
  rarest: YearReviewRarest | null;
  topSpecies: YearReviewTopSpecies[];
  goal: YearReviewGoal | null;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

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
    throw new Error('Please sign in to see your year in review.');
  }
  return user.id;
}

function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toNonEmptyString(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getMonthName(monthNum: number | null | undefined): string | null {
  if (monthNum === null || monthNum === undefined) return null;
  const idx = Math.round(monthNum) - 1;
  if (idx < 0 || idx > 11) return null;
  return MONTH_NAMES[idx];
}

export function formatCategoryLabel(raw: string): string {
  return raw
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractYearFromDates(seenOn?: unknown, createdAt?: unknown): number | null {
  const candidates = [seenOn, createdAt];
  for (const val of candidates) {
    if (typeof val !== 'string') continue;
    const trimmed = val.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(\d{4})-/);
    if (match) {
      const yr = Number(match[1]);
      if (yr >= 1900 && yr <= 2100) return yr;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const yr = parsed.getFullYear();
      if (yr >= 1900 && yr <= 2100) return yr;
    }
  }
  return null;
}

export async function fetchAvailableReviewYears(): Promise<number[]> {
  const userId = await ensureAuthenticatedUserId();
  const currentYear = new Date().getFullYear();

  try {
    const { data, error } = await supabase
      .from('collection_items')
      .select('seen_on, created_at')
      .eq('owner_id', userId);

    if (error) {
      throw new Error(error.message || 'Could not load sighting years.');
    }

    const yearSet = new Set<number>([currentYear]);
    for (const row of (data || []) as Record<string, unknown>[]) {
      const y = extractYearFromDates(row.seen_on, row.created_at);
      if (y !== null) {
        yearSet.add(y);
      }
    }

    return Array.from(yearSet).sort((a, b) => b - a);
  } catch (err: any) {
    throw new Error(err?.message || 'Could not load sighting years.');
  }
}

export async function fetchSafeUsername(fallbackDisplayName?: string): Promise<string> {
  const cleanFallback =
    fallbackDisplayName && !fallbackDisplayName.includes('@')
      ? fallbackDisplayName.trim()
      : 'Explorer';

  try {
    const userId = await ensureAuthenticatedUserId();
    const { data, error } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return cleanFallback;
    }

    const username = toNonEmptyString(data.username);
    if (username && !username.includes('@')) {
      return username.startsWith('@') ? username : `@${username}`;
    }

    const displayName = toNonEmptyString(data.display_name);
    if (displayName && !displayName.includes('@')) {
      return displayName;
    }

    return cleanFallback;
  } catch {
    return cleanFallback;
  }
}

async function resolveRarestPhotoUrl(photoPath: string): Promise<string> {
  const clean = photoPath.trim();
  if (!clean) return '';
  if (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('data:')
  ) {
    return clean;
  }

  try {
    const { data, error } = await supabase.storage
      .from('scans')
      .createSignedUrl(clean, 3600);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch {
    // Fall back to shared helper below
  }

  try {
    return (await getSignedPhotoUrl(clean)) || '';
  } catch {
    return '';
  }
}

function normalizeMonths(rawMonths: unknown): YearReviewMonth[] {
  if (!Array.isArray(rawMonths) || rawMonths.length === 0) {
    return [];
  }

  const countByMonth = new Map<number, number>();
  for (const entry of rawMonths) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const monthNum = toFiniteNumber(obj.month ?? obj.month_number ?? obj.m);
    const countNum = toFiniteNumber(obj.count ?? obj.sightings ?? obj.total);
    if (monthNum !== null) {
      const m = Math.round(monthNum);
      if (m >= 1 && m <= 12) {
        countByMonth.set(m, Math.max(0, Math.round(countNum ?? 0)));
      }
    }
  }

  if (countByMonth.size === 0) return [];

  return Array.from({ length: 12 }, (_, idx) => {
    const month = idx + 1;
    return {
      month,
      label: MONTH_NAMES[idx],
      shortLabel: MONTH_SHORT_NAMES[idx],
      count: countByMonth.get(month) ?? 0,
    };
  });
}

function normalizeTopSpecies(rawTop: unknown): YearReviewTopSpecies[] {
  if (!Array.isArray(rawTop)) return [];
  const items: YearReviewTopSpecies[] = [];
  for (const entry of rawTop) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const name = toNonEmptyString(
      obj.name ?? obj.species_name ?? obj.common_name ?? obj.species
    );
    const count = toFiniteNumber(obj.count ?? obj.sightings ?? obj.total);
    if (!name || count === null) continue;
    items.push({
      name,
      count: Math.max(0, Math.round(count)),
    });
    if (items.length >= 5) break;
  }
  return items;
}

function normalizeGoal(
  rawGoal: unknown,
  fallbackCurrentSpecies: number | null
): YearReviewGoal | null {
  if (rawGoal === null || rawGoal === undefined) return null;

  if (typeof rawGoal === 'number' || typeof rawGoal === 'string') {
    const target = toFiniteNumber(rawGoal);
    if (target === null || target <= 0) return null;
    return {
      targetSpecies: Math.round(target),
      currentSpecies: Math.max(0, Math.round(fallbackCurrentSpecies ?? 0)),
    };
  }

  if (typeof rawGoal === 'object') {
    const obj = rawGoal as Record<string, unknown>;
    const target =
      toFiniteNumber(obj.target_species) ??
      toFiniteNumber(obj.targetSpecies) ??
      toFiniteNumber(obj.target) ??
      toFiniteNumber(obj.goal);
    if (target === null || target <= 0) return null;

    const current =
      toFiniteNumber(obj.current) ??
      toFiniteNumber(obj.currentSpecies) ??
      toFiniteNumber(obj.current_species) ??
      toFiniteNumber(obj.species_this_year) ??
      toFiniteNumber(obj.speciesThisYear) ??
      toFiniteNumber(obj.count) ??
      toFiniteNumber(obj.progress) ??
      fallbackCurrentSpecies ??
      0;

    return {
      targetSpecies: Math.round(target),
      currentSpecies: Math.max(0, Math.round(current)),
    };
  }

  return null;
}

export async function fetchYearReview(year: number): Promise<YearReviewData> {
  await ensureAuthenticatedUserId();

  try {
    const { data, error } = await supabase.rpc('year_review', { p_year: year });
    if (error) {
      throw new Error(error.message || 'Could not load your year in review.');
    }

    const row: Record<string, unknown> = Array.isArray(data)
      ? ((data[0] as Record<string, unknown>) || {})
      : ((data as Record<string, unknown>) || {});

    const resolvedYear = toFiniteNumber(row.year) ?? year;
    const sightingsRaw = toFiniteNumber(row.sightings ?? row.total_sightings);
    const speciesRaw = toFiniteNumber(row.species ?? row.species_count);
    const newSpeciesRaw = toFiniteNumber(row.newSpecies ?? row.new_species);
    const topCategoryRaw = toNonEmptyString(row.topCategory ?? row.top_category);
    const busiestMonthRaw = toFiniteNumber(row.busiestMonth ?? row.busiest_month);

    const busiestMonth =
      busiestMonthRaw !== null &&
      Math.round(busiestMonthRaw) >= 1 &&
      Math.round(busiestMonthRaw) <= 12
        ? Math.round(busiestMonthRaw)
        : null;

    const months = normalizeMonths(row.months);
    const topSpecies = normalizeTopSpecies(row.topSpecies ?? row.top_species);

    let rarest: YearReviewRarest | null = null;
    if (row.rarest && typeof row.rarest === 'object') {
      const rarestObj = row.rarest as Record<string, unknown>;
      const rarestName = toNonEmptyString(
        rarestObj.name ?? rarestObj.species_name ?? rarestObj.common_name
      );
      if (rarestName) {
        const photoPath =
          toNonEmptyString(rarestObj.photo ?? rarestObj.photo_path) || '';
        const photoUrl = photoPath ? await resolveRarestPhotoUrl(photoPath) : '';
        rarest = {
          name: rarestName,
          rarity: toNonEmptyString(rarestObj.rarity) || 'Rare',
          photoPath,
          photoUrl,
        };
      }
    }

    const sightings =
      sightingsRaw !== null ? Math.max(0, Math.round(sightingsRaw)) : null;
    const species =
      speciesRaw !== null ? Math.max(0, Math.round(speciesRaw)) : null;
    const newSpecies =
      newSpeciesRaw !== null ? Math.max(0, Math.round(newSpeciesRaw)) : null;

    const goal = normalizeGoal(row.goal, newSpecies ?? species);

    return {
      year: Math.round(resolvedYear),
      sightings,
      species,
      newSpecies,
      topCategory: topCategoryRaw,
      busiestMonth,
      busiestMonthName: getMonthName(busiestMonth),
      months,
      rarest,
      topSpecies,
      goal,
    };
  } catch (err: any) {
    throw new Error(err?.message || 'Could not load your year in review.');
  }
}

export async function loadScanImageForCanvas(
  photoPath?: string,
  signedUrl?: string
): Promise<HTMLImageElement | null> {
  let blob: Blob | null = null;

  const cleanPath = (photoPath || '').trim();
  if (
    cleanPath &&
    !cleanPath.startsWith('http://') &&
    !cleanPath.startsWith('https://') &&
    !cleanPath.startsWith('data:')
  ) {
    try {
      const { data, error } = await supabase.storage
        .from('scans')
        .download(cleanPath);
      if (!error && data) {
        blob = data;
      }
    } catch {
      // Fallback to fetch(signedUrl) below
    }
  }

  if (!blob && signedUrl) {
    try {
      const res = await fetch(signedUrl);
      if (res.ok) {
        blob = await res.blob();
      }
    } catch {
      return null;
    }
  }

  if (!blob) return null;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = objectUrl;
    });
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
