import crypto from 'node:crypto'

export function createRawAuthToken() {
  const raw = crypto.randomBytes(32).toString('base64url')
  const prefix = raw.slice(0, 12)

  return {
    raw,
    prefix,
    hash: crypto.createHash('sha256').update(raw).digest('hex'),
  }
}

export function hashAuthToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export function createOpaqueStateToken() {
  return crypto.randomBytes(24).toString('base64url')
}

