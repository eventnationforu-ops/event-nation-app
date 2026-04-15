/**
 * In-memory sliding-window rate limiter for Edge Functions.
 * Keyed by IP + user ID. Configurable window and max requests.
 *
 * Note: Deno Deploy functions are stateless across cold starts,
 * so this provides per-instance protection. For distributed rate
 * limiting, use Supabase/Redis-backed counters.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const RATE_LIMITS = {
  payment: { windowMs: 60_000, maxRequests: 5 },
  verification: { windowMs: 60_000, maxRequests: 10 },
  checkin: { windowMs: 10_000, maxRequests: 20 },
  email: { windowMs: 60_000, maxRequests: 10 },
  refund: { windowMs: 60_000, maxRequests: 5 },
} as const;

export function checkRateLimit(
  req: Request,
  userId: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs: number } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const key = `${ip}:${userId}`;
  const now = Date.now();

  cleanup(config.windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < config.windowMs);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = config.windowMs - (now - oldest);
    return { allowed: false, retryAfterMs };
  }

  entry.timestamps.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

export function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
      retry_after_seconds: retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    }
  );
}
