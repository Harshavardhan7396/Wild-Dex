import type { Request, Response } from 'express';
import crypto from 'crypto';

export interface VerifiedCaller {
  key: string;
  userId: string | null;
  authenticated: boolean;
  ip: string;
}

interface TokenCacheEntry {
  userId: string;
  expiresAtMs: number;
}

interface RateBucket {
  windowHits: number[];
  dayKey: string;
  dayCount: number;
  lastSeenMs: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();
const rateBuckets = new Map<string, RateBucket>();

const TOKEN_CACHE_MAX = 500;
const RATE_BUCKET_MAX = 2000;

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return { url, anonKey };
}

function getUtcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function pruneMapIfNeeded<K, V>(map: Map<K, V>, maxEntries: number) {
  if (map.size <= maxEntries) return;
  const excess = map.size - Math.floor(maxEntries * 0.8);
  let removed = 0;
  for (const key of map.keys()) {
    map.delete(key);
    removed++;
    if (removed >= excess) break;
  }
}

/**
 * Verifies an Authorization: Bearer <jwt> against Supabase Auth when provided.
 * Rejects malformed or invalid bearer tokens with HTTP 401 behavior via throws/status,
 * while permitting bounded guest usage when no Authorization header is sent.
 */
export async function resolveVerifiedCaller(
  req: Request
): Promise<{ caller: VerifiedCaller | null; authError?: string }> {
  const ip = getClientIp(req);
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return {
      caller: {
        key: `guest:${ip}`,
        userId: null,
        authenticated: false,
        ip,
      },
    };
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return { caller: null, authError: 'Invalid Authorization header format.' };
  }

  const token = match[1].trim();
  if (token.length < 20 || token.length > 4096) {
    return { caller: null, authError: 'Invalid authentication token.' };
  }

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    // Supabase auth server URL not configured in local env; treat token hash as caller key without trusting unverified claims
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
    return {
      caller: {
        key: `token:${tokenHash}:${ip}`,
        userId: null,
        authenticated: false,
        ip,
      },
    };
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const cached = tokenCache.get(tokenHash);
  const nowMs = Date.now();
  if (cached && cached.expiresAtMs > nowMs) {
    return {
      caller: {
        key: `user:${cached.userId}`,
        userId: cached.userId,
        authenticated: true,
        ip,
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const authRes = await fetch(`${url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (!authRes.ok) {
      return { caller: null, authError: 'Session expired or invalid. Please sign in again.' };
    }

    const userData = (await authRes.json()) as { id?: string };
    if (!userData?.id || typeof userData.id !== 'string') {
      return { caller: null, authError: 'Unable to verify signed-in user.' };
    }

    pruneMapIfNeeded(tokenCache, TOKEN_CACHE_MAX);
    tokenCache.set(tokenHash, {
      userId: userData.id,
      expiresAtMs: nowMs + 60_000,
    });

    return {
      caller: {
        key: `user:${userData.id}`,
        userId: userData.id,
        authenticated: true,
        ip,
      },
    };
  } catch (err: any) {
    console.warn('Supabase auth verification request failed:', err?.message || err);
    return { caller: null, authError: 'Authentication verification failed. Please retry.' };
  } finally {
    clearTimeout(timeout);
  }
}

export interface RateLimitPolicy {
  bucketPrefix: string;
  windowMs: number;
  maxPerWindow: number;
  maxPerDay: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingWindow: number;
  remainingDaily: number;
  retryAfterSeconds: number;
}

export function checkAndConsumeRateLimit(
  callerKey: string,
  policy: RateLimitPolicy
): RateLimitResult {
  const nowMs = Date.now();
  const dayKey = getUtcDayKey(nowMs);
  const fullKey = `${policy.bucketPrefix}:${callerKey}`;
  const cutoffMs = nowMs - policy.windowMs;

  pruneMapIfNeeded(rateBuckets, RATE_BUCKET_MAX);

  let bucket = rateBuckets.get(fullKey);
  if (!bucket) {
    bucket = {
      windowHits: [],
      dayKey,
      dayCount: 0,
      lastSeenMs: nowMs,
    };
    rateBuckets.set(fullKey, bucket);
  }

  if (bucket.dayKey !== dayKey) {
    bucket.dayKey = dayKey;
    bucket.dayCount = 0;
  }

  bucket.windowHits = bucket.windowHits.filter((ts) => ts > cutoffMs);
  bucket.lastSeenMs = nowMs;

  if (bucket.dayCount >= policy.maxPerDay) {
    const tomorrowUtc = Date.UTC(
      new Date(nowMs).getUTCFullYear(),
      new Date(nowMs).getUTCMonth(),
      new Date(nowMs).getUTCDate() + 1,
      0,
      0,
      0
    );
    return {
      allowed: false,
      remainingWindow: 0,
      remainingDaily: 0,
      retryAfterSeconds: Math.max(60, Math.ceil((tomorrowUtc - nowMs) / 1000)),
    };
  }

  if (bucket.windowHits.length >= policy.maxPerWindow) {
    const oldestHit = bucket.windowHits[0] || nowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestHit + policy.windowMs - nowMs) / 1000));
    return {
      allowed: false,
      remainingWindow: 0,
      remainingDaily: Math.max(0, policy.maxPerDay - bucket.dayCount),
      retryAfterSeconds,
    };
  }

  bucket.windowHits.push(nowMs);
  bucket.dayCount += 1;

  return {
    allowed: true,
    remainingWindow: Math.max(0, policy.maxPerWindow - bucket.windowHits.length),
    remainingDaily: Math.max(0, policy.maxPerDay - bucket.dayCount),
    retryAfterSeconds: 0,
  };
}

export function applyRateLimitHeaders(
  res: Response,
  policy: RateLimitPolicy,
  result: RateLimitResult
) {
  res.setHeader('X-RateLimit-Limit', String(policy.maxPerWindow));
  res.setHeader('X-RateLimit-Remaining', String(result.remainingWindow));
  res.setHeader('X-RateLimit-Daily-Remaining', String(result.remainingDaily));
  if (!result.allowed && result.retryAfterSeconds > 0) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
  }
}
