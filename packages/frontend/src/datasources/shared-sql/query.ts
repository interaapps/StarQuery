import type { DataSourceType } from '@/types/sql'
import { quoteSqlIdentifier } from '@/datasources/shared-sql/dialect'
import { getSqlDialect } from '@/datasources/shared-sql/dialect'
export { normalizeOrderByClause, normalizeWhereClause } from '@/datasources/shared-sql/fragments'

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
  return getSqlDialect(input.sourceType).buildTableQuery({
    tableName: input.tableName,
    orderByClause: input.orderByClause,
    fallbackOrderByClause: input.fallbackOrderByClause,
    page: input.page,
    pageSize: input.pageSize,
    whereClause: input.whereClause,
  })
}
