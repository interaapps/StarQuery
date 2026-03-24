import crypto from 'node:crypto'

const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
}

export function createPasswordHash(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64, SCRYPT_OPTIONS).toString('hex')

  return {
    salt,
    hash,
  }
}

export function verifyPasswordHash(password: string, salt: string, hash: string) {
  const candidate = crypto.scryptSync(password, salt, 64, SCRYPT_OPTIONS)
  const target = Buffer.from(hash, 'hex')

  if (candidate.length !== target.length) {
    return false
  }

  return crypto.timingSafeEqual(candidate, target)
}

