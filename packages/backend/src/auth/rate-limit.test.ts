import test from 'node:test'
import assert from 'node:assert/strict'
import { clearRateLimit, consumeRateLimit, resetRateLimitState } from './rate-limit.ts'

test.afterEach(() => {
  resetRateLimitState()
})

test('rate limiter blocks requests after the configured maximum', () => {
  const key = 'login:127.0.0.1:user@example.com'
  const now = 1_000

  const first = consumeRateLimit(key, 60_000, 2, now)
  const second = consumeRateLimit(key, 60_000, 2, now + 1)
  const third = consumeRateLimit(key, 60_000, 2, now + 2)

  assert.equal(first.allowed, true)
  assert.equal(second.allowed, true)
  assert.equal(third.allowed, false)
  assert.equal(third.remaining, 0)
})

test('clearing a rate limit bucket resets the counter', () => {
  const key = 'login:127.0.0.1:user@example.com'
  const now = 2_000

  consumeRateLimit(key, 60_000, 1, now)
  clearRateLimit(key)
  const next = consumeRateLimit(key, 60_000, 1, now + 1)

  assert.equal(next.allowed, true)
  assert.equal(next.remaining, 0)
})
