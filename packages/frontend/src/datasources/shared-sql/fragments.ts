const FORBIDDEN_SQL_FRAGMENT_TOKENS = [';', '--', '/*', '*/', '\u0000']

export function normalizeWhereClause(where?: string) {
  const trimmed = where?.trim()
  if (!trimmed) {
    return undefined
  }

  const normalized = trimmed.replace(/^where\b/i, '').trim()
  if (!normalized) {
    return undefined
  }

  if (FORBIDDEN_SQL_FRAGMENT_TOKENS.some((token) => normalized.includes(token))) {
    throw new Error(
      'WHERE filter must be a single SQL expression without comments or statement separators',
    )
  }

  return normalized
}

export function normalizeOrderByClause(orderBy?: string) {
  const trimmed = orderBy?.trim()
  if (!trimmed) {
    return undefined
  }

  const normalized = trimmed.replace(/^order\s+by\b/i, '').trim()
  if (!normalized) {
    return undefined
  }

  if (FORBIDDEN_SQL_FRAGMENT_TOKENS.some((token) => normalized.includes(token))) {
    throw new Error(
      'ORDER BY must be a single SQL expression without comments or statement separators',
    )
  }

  return normalized
}
