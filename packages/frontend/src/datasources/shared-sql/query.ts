import type { DataSourceType } from '@/types/sql'
import { quoteSqlIdentifier } from '@/datasources/shared-sql/dialect'

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

export function quoteIdentifier(identifier: string, sourceType: DataSourceType) {
  return quoteSqlIdentifier(identifier, sourceType)
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
