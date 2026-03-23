const FORBIDDEN_WHERE_TOKENS = [';', '--', '/*', '*/', '\u0000']

export function normalizeWhereClause(where?: string) {
  const trimmed = where?.trim()
  if (!trimmed) {
    return undefined
  }

  const normalized = trimmed.replace(/^where\b/i, '').trim()
  if (!normalized) {
    return undefined
  }

  if (FORBIDDEN_WHERE_TOKENS.some((token) => normalized.includes(token))) {
    throw new Error('WHERE filter must be a single SQL expression without comments or statement separators')
  }

  return normalized
}
