import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ActiveChallenge {
  id: string;
  title: string;
  description: string;
  category: string;
  target: number;
  points: number;
  startsAt: string;
  endsAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  scansCount: number;
  speciesCount: number;
}

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please check your environment variables.');
  }
}

export function formatCountdown(endsAtIso: string, nowMs: number = Date.now()): string {
  const endMs = new Date(endsAtIso).getTime();
  if (Number.isNaN(endMs)) return '';

  const remainingMs = Math.max(0, endMs - nowMs);
  if (remainingMs === 0) return 'Ending soon';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m left`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s left`;
  }
  return `${minutes}m ${seconds}s left`;
}

export async function fetchActiveChallenge(): Promise<ActiveChallenge | null> {
  ensureConfigured();
  const nowIso = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .lte('starts_at', nowIso)
      .gt('ends_at', nowIso)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Could not load the weekly challenge.');
    }

    if (!data) return null;

    return {
      id: data.id,
      title: data.title || 'Weekly Challenge',
      description: data.description || '',
      category: data.category || '',
      target: typeof data.target === 'number' && data.target > 0 ? data.target : 5,
      points: typeof data.points === 'number' && data.points >= 0 ? data.points : 0,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
    };
  } catch (err: any) {
    console.error('Error loading active challenge:', err);
    throw new Error(err?.message || 'Could not load the weekly challenge.');
  }
}

export async function fetchChallengeProgressCount(params: {
  userId: string;
  category: string;
  startsAt: string;
}): Promise<number> {
  ensureConfigured();
  const { userId, category, startsAt } = params;

  try {
    let query = supabase
      .from('collection_items')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .gte('created_at', startsAt);

    const cleanCat = category.trim();
    if (cleanCat && cleanCat.toLowerCase() !== 'all') {
      query = query.ilike('category', cleanCat);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(error.message || 'Could not load your challenge progress.');
    }

    return typeof count === 'number' ? count : 0;
  } catch (err: any) {
    console.error('Error loading challenge progress:', err);
    throw new Error(err?.message || 'Could not load your challenge progress.');
  }
}

export function getDefaultWeekStartIso(): string {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = utcDay === 0 ? 6 : utcDay - 1;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday, 0, 0, 0)
  );
  return monday.toISOString();
}

export async function fetchLeaderboard(params: {
  mode: 'weekly' | 'alltime';
  startsAt?: string;
  category?: string;
}): Promise<LeaderboardEntry[]> {
  ensureConfigured();
  const { mode, startsAt, category } = params;

  try {
    const rpcArgs: Record<string, string> =
      mode === 'alltime'
        ? { p_since: '2000-01-01' }
        : {
            p_since: startsAt || getDefaultWeekStartIso(),
            ...(category && category.trim() ? { p_category: category.trim() } : {}),
          };

    const { data, error } = await supabase.rpc('leaderboard', rpcArgs);

    if (error) {
      throw new Error(error.message || 'Could not load the rankings.');
    }

    if (!Array.isArray(data)) return [];

    return data.map((row: any, index: number) => ({
      rank: Number(row.rank ?? index + 1),
      userId: String(row.user_id ?? row.id ?? ''),
      username: String(row.username || row.display_name || 'Explorer'),
      displayName: String(row.display_name || row.username || 'Explorer'),
      avatarUrl: String(row.avatar_url || ''),
      scansCount: Number(row.scans_count ?? row.scans ?? row.scan_count ?? 0),
      speciesCount: Number(row.species_count ?? row.species ?? 0),
    }));
  } catch (err: any) {
    console.error('Error fetching leaderboard:', err);
    throw new Error(err?.message || 'Could not load the rankings.');
  }
}
