// Best-effort in-memory rate limiter for route handlers. Per serverless instance, so it slows abuse
// rather than stopping it. Stale entries are pruned so the map can't grow without bound.

export function createRateLimiter({ windowMs, max, maxKeys = 10_000 }: { windowMs: number; max: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>()
  return function limited(key: string): boolean {
    const now = Date.now()
    if (hits.size > maxKeys) {
      for (const [k, times] of hits) if (now - times[times.length - 1] >= windowMs) hits.delete(k)
      if (hits.size > maxKeys) hits.clear()
    }
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    recent.push(now)
    hits.set(key, recent)
    return recent.length > max
  }
}

export const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
