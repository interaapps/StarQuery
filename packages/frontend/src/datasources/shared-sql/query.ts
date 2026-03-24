import type { DataSourceType } from '@/types/sql'

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const FORBIDDEN_SQL_FRAGMENT_TOKENS = [';', '--', '/*', '*/', '\u0000']

function assertIdentifier(identifier: string) {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`)
  }
}

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

export function quoteIdentifier(identifier: string, sourceType: DataSourceType) {
  assertIdentifier(identifier)

  if (sourceType === 'mysql') {
    return `\`${identifier.replace(/`/g, '``')}\``
  }

  return `"${identifier.replace(/"/g, '""')}"`
}

export function buildTableQuery(input: {
  sourceType: DataSourceType
  tableName: string
  orderByClause?: string
  fallbackOrderByClause: string
  page: number
  pageSize: number
  whereClause?: string
}) {
  const page = Math.max(1, Math.floor(input.page))
  const pageSize = Math.floor(input.pageSize)
  const offset = (page - 1) * pageSize
  const tableName = quoteIdentifier(input.tableName, input.sourceType)
  const whereClause = normalizeWhereClause(input.whereClause)
  const orderByClause = normalizeOrderByClause(input.orderByClause) ?? input.fallbackOrderByClause
  const whereSql = whereClause ? ` WHERE ${whereClause}` : ''

  return [
    `SELECT COUNT(*) AS starquery_total FROM ${tableName}${whereSql}`,
    `SELECT * FROM ${tableName}${whereSql} ORDER BY ${orderByClause} LIMIT ${pageSize} OFFSET ${offset}`,
  ].join(';\n')
}
