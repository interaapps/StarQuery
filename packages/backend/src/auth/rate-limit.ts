type RateLimitEntry = {
  count: number
  resetAt: number
}

const authRateLimitState = new Map<string, RateLimitEntry>()

function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of authRateLimitState.entries()) {
    if (entry.resetAt <= now) {
      authRateLimitState.delete(key)
    }
  }
}

export function consumeRateLimit(key: string, windowMs: number, maxAttempts: number, now = Date.now()) {
  cleanupExpiredEntries(now)

  const existing = authRateLimitState.get(key)
  if (!existing || existing.resetAt <= now) {
    authRateLimitState.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })

    return {
      allowed: true,
      remaining: Math.max(0, maxAttempts - 1),
      resetAt: now + windowMs,
    }
  }

  existing.count += 1
  authRateLimitState.set(key, existing)

  return {
    allowed: existing.count <= maxAttempts,
    remaining: Math.max(0, maxAttempts - existing.count),
    resetAt: existing.resetAt,
  }
}

export function clearRateLimit(key: string) {
  authRateLimitState.delete(key)
}

export function resetRateLimitState() {
  authRateLimitState.clear()
}
