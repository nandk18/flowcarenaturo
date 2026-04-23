// Client-side rate limiter — prevents one clinic from hammering AI APIs.
// Swap with Redis later without changing call sites.

interface RateLimit {
  count: number;
  resetAt: number;
}

const limits = new Map<string, RateLimit>();

export const rateLimiter = {
  check(key: string, maxRequests: number, windowSeconds: number): boolean {
    const now = Date.now();
    const existing = limits.get(key);

    if (!existing || now > existing.resetAt) {
      limits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return true;
    }

    if (existing.count >= maxRequests) {
      return false;
    }

    existing.count++;
    return true;
  },

  getTimeUntilReset(key: string): number {
    const existing = limits.get(key);
    if (!existing) return 0;
    return Math.max(0, Math.ceil((existing.resetAt - Date.now()) / 1000));
  },
};