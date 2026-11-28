import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type SafetyGroupName =
  | 'snakes'
  | 'insects'
  | 'plants'
  | 'mushrooms'
  | 'marine'
  | 'mammals'
  | 'pets'
  | string;

export interface SafetyTopic {
  id: string;
  slug: string;
  title: string;
  groupName: SafetyGroupName;
  summary: string;
  warningSigns: string[];
  doNow: string[];
  doNot: string[];
  getHelp: string;
  sortOrder: number;
}

export interface SafetyGroupChip {
  key: string;
  label: string;
}

const SAFETY_TOPIC_COLUMNS =
  'id, slug, title, group_name, summary, warning_signs, do_now, do_not, get_help, sort_order';

const TOPIC_STORAGE_PREFIX = 'wilddex_safety_topic_v1_';
const LIST_STORAGE_KEY = 'wilddex_safety_topics_list_v1';

const GROUP_DISPLAY_ORDER = [
  'snakes',
  'insects',
  'plants',
  'mushrooms',
  'marine',
  'mammals',
  'pets',
];

const GROUP_LABEL_MAP: Record<string, string> = {
  snakes: 'Snakes',
  insects: 'Insects',
  plants: 'Plants',
  mushrooms: 'Mushrooms',
  marine: 'Sea',
  mammals: 'Animals',
  pets: 'Pets',
};

const GROUP_ICON_MAP: Record<string, string> = {
  snakes: 'gesture',
  insects: 'bug_report',
  plants: 'local_florist',
  mushrooms: 'eco',
  marine: 'water',
  mammals: 'nature',
  pets: 'pets',
};

export function getSafetyGroupLabel(groupName?: string | null): string {
  const key = (groupName || '').trim().toLowerCase();
  if (!key) return 'Other';
  if (GROUP_LABEL_MAP[key]) return GROUP_LABEL_MAP[key];
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getSafetyGroupIcon(groupName?: string | null): string {
  const key = (groupName || '').trim().toLowerCase();
  return GROUP_ICON_MAP[key] || 'health_and_safety';
}

export function buildSafetyGroupChips(topics: SafetyTopic[]): SafetyGroupChip[] {
  const presentKeys = new Set<string>();
  for (const t of topics) {
    const key = t.groupName.trim().toLowerCase();
    if (key) presentKeys.add(key);
  }

  const orderedKeys = Array.from(presentKeys).sort((a, b) => {
    const idxA = GROUP_DISPLAY_ORDER.indexOf(a);
    const idxB = GROUP_DISPLAY_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  return orderedKeys.map((key) => ({
    key,
    label: getSafetyGroupLabel(key),
  }));
}

function normalizeStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
      .filter(Boolean);
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
          .filter(Boolean);
      }
    } catch {
      // Treat as a single plain-text entry if not JSON
    }
    return [trimmed];
  }

  return [];
}

function mapSafetyTopicRow(row: Record<string, unknown>): SafetyTopic {
  const sortNum = Number(row.sort_order);
  return {
    id: String(row.id ?? ''),
    slug: String(row.slug ?? '').trim(),
    title: String(row.title ?? '').trim(),
    groupName: String(row.group_name ?? '').trim().toLowerCase(),
    summary: String(row.summary ?? '').trim(),
    warningSigns: normalizeStringArray(row.warning_signs),
    doNow: normalizeStringArray(row.do_now),
    doNot: normalizeStringArray(row.do_not),
    getHelp: String(row.get_help ?? '').trim(),
    sortOrder: Number.isFinite(sortNum) ? sortNum : 999,
  };
}

export function saveSafetyTopicOffline(topic: SafetyTopic): void {
  if (typeof window === 'undefined' || !topic.slug) return;
  try {
    localStorage.setItem(
      `${TOPIC_STORAGE_PREFIX}${topic.slug.toLowerCase()}`,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        topic,
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function readSafetyTopicOffline(
  slug: string
): { topic: SafetyTopic; savedAt: string | null } | null {
  if (typeof window === 'undefined' || !slug) return null;
  try {
    const raw = localStorage.getItem(`${TOPIC_STORAGE_PREFIX}${slug.trim().toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { topic?: SafetyTopic; savedAt?: string };
    if (parsed?.topic && parsed.topic.slug && parsed.topic.title) {
      return {
        topic: parsed.topic,
        savedAt: parsed.savedAt || null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function saveSafetyListOffline(topics: SafetyTopic[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LIST_STORAGE_KEY, JSON.stringify(topics));
  } catch {
    // Ignore storage quota errors
  }
}

function readSafetyListOffline(): SafetyTopic[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as SafetyTopic[];
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchSafetyTopics(): Promise<{
  topics: SafetyTopic[];
  fromOfflineCache: boolean;
}> {
  if (!isSupabaseConfigured) {
    const cached = readSafetyListOffline();
    if (cached) return { topics: cached, fromOfflineCache: true };
    throw new Error('Safety guide database is not configured yet.');
  }

  try {
    const { data, error } = await supabase
      .from('safety_topics')
      .select(SAFETY_TOPIC_COLUMNS)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(error.message || 'Could not load safety topics.');
    }

    const topics = ((data || []) as Record<string, unknown>[]).map(mapSafetyTopicRow);
    saveSafetyListOffline(topics);
    for (const topic of topics) {
      saveSafetyTopicOffline(topic);
    }
    return { topics, fromOfflineCache: false };
  } catch (err: any) {
    const isOffline =
      typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isOffline) {
      const cached = readSafetyListOffline();
      if (cached) {
        return { topics: cached, fromOfflineCache: true };
      }
    }
    throw new Error(err?.message || 'Could not load safety topics right now.');
  }
}

export async function fetchSafetyTopicBySlug(slug: string): Promise<{
  topic: SafetyTopic;
  fromOfflineCache: boolean;
  savedAt: string | null;
}> {
  const cleanSlug = decodeURIComponent(slug || '').trim();
  if (!cleanSlug) {
    throw new Error('Safety topic not found.');
  }

  if (!isSupabaseConfigured) {
    const cached = readSafetyTopicOffline(cleanSlug);
    if (cached) {
      return {
        topic: cached.topic,
        fromOfflineCache: true,
        savedAt: cached.savedAt,
      };
    }
    throw new Error('Safety guide database is not configured yet.');
  }

  try {
    const { data, error } = await supabase
      .from('safety_topics')
      .select(SAFETY_TOPIC_COLUMNS)
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Could not load this safety topic.');
    }

    if (!data) {
      throw new Error('This safety topic could not be found.');
    }

    const topic = mapSafetyTopicRow(data as Record<string, unknown>);
    saveSafetyTopicOffline(topic);
    return {
      topic,
      fromOfflineCache: false,
      savedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    const cached = readSafetyTopicOffline(cleanSlug);
    if (cached) {
      return {
        topic: cached.topic,
        fromOfflineCache: true,
        savedAt: cached.savedAt,
      };
    }
    throw new Error(err?.message || 'Could not load this safety topic.');
  }
}
