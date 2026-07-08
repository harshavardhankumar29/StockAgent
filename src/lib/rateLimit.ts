// ─────────────────────────────────────────────
// In-memory sliding-window rate limiter
// No external dependencies — suitable for single-instance deployments.
// For multi-instance (serverless), switch to Upstash Redis or similar.
// ─────────────────────────────────────────────

interface RateLimitEntry {
  timestamps: number[];
}

const limiters = new Map<string, RateLimitEntry>();

const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_REQUESTS = 5;

/**
 * Check if a request is within rate limits.
 *
 * @param userId        Unique user identifier
 * @param maxRequests   Max requests allowed in the window (default 5)
 * @param windowMs      Sliding window in milliseconds (default 10 min)
 * @returns `{ allowed, remaining, retryAfterMs }`
 */
export function checkRateLimit(
  userId: string,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = limiters.get(userId) || { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.timestamps.push(now);
  limiters.set(userId, entry);

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

// Periodically clean up stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limiters) {
    entry.timestamps = entry.timestamps.filter(
      (t) => now - t < DEFAULT_WINDOW_MS
    );
    if (entry.timestamps.length === 0) {
      limiters.delete(key);
    }
  }
}, 5 * 60 * 1000);
