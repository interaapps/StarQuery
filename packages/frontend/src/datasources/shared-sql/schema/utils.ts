import type { SQLTableColumn, SQLEditTableColumnDraft } from '@/types/sql'
import type { TableColumnDraft } from '@/types/table-schema'
import type { SqlDataSourceType } from '@/datasources/shared-sql/dialect-types'
import { quoteSqlIdentifier } from '@/datasources/shared-sql/dialect'

export function parseColumns(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function parseColumnList(value: unknown) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function normalizeName(value: string) {
  return value.trim()
}

export function tableRef(tableName: string, sourceType: SqlDataSourceType) {
  return quoteSqlIdentifier(tableName, sourceType)
}

export function columnList(value: string, sourceType: SqlDataSourceType) {
  const columns = parseColumns(value)
  if (!columns.length) {
    throw new Error('At least one column is required')
  }

  return columns.map((column) => quoteSqlIdentifier(column, sourceType)).join(', ')
}

export function escapeLiteral(value: string) {
  return value.replace(/'/g, "''")
}

export function compareByName<T extends { name: string; originalName?: string }>(items: T[]) {
  return new Map(items.map((item) => [normalizeName(item.originalName || item.name), item]))
}

export function compareSignature<T>(value: T) {
  return JSON.stringify(value)
}

export function normalizeDefaultValue(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

export function draftColumnToSqlColumn(column: TableColumnDraft): SQLTableColumn {
  return {
    name: column.name,
    field: column.name,
    type: column.type,
    nullable: column.nullable,
    defaultValue: column.defaultValue || undefined,
    autoIncrement: column.autoIncrement,
    primaryKey: column.primaryKey,
  }
}

export function toAlterColumnDraft(column: TableColumnDraft): SQLEditTableColumnDraft {
  return {
    originalName: column.originalName,
    name: column.name,
    type: column.type,
    nullable: column.nullable,
    primaryKey: column.primaryKey,
    autoIncrement: column.autoIncrement,
    defaultValue: column.defaultValue,
  }
}
