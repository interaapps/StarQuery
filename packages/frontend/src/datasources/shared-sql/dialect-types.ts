import { MariaSQL, PostgreSQL, SQLite } from '@codemirror/lang-sql'
import type { DataSourceType } from '@/types/datasources'
import type { DataSourceRecord } from '@/types/workspace'
import type { TableSchemaDraft, TableSchemaMode, TableSchemaSupport } from '@/types/table-schema'

export type SqlDataSourceType =
  | 'mysql'
  | 'mariadb'
  | 'postgres'
  | 'cockroachdb'
  | 'sqlite'
  | 'duckdb'
  | 'mssql'
  | 'clickhouse'
  | 'oracle'
  | 'cassandra'

export type SqlCompletionSourceRecord = Pick<DataSourceRecord, 'type' | 'config' | 'name'>

export type SqlEditorDialect = typeof MariaSQL | typeof PostgreSQL | typeof SQLite

export type SqlTableSchemaUi = {
  editDescription: string
  indexMethodPlaceholder: string
  virtualColumnStorageLocked: boolean
}

export type RegisteredSqlDialect = {
  type: SqlDataSourceType
  editorDialect: SqlEditorDialect
  quoteIdentifier(identifier: string): string
  buildTableQuery(input: {
    tableName: string
    orderByClause?: string
    fallbackOrderByClause: string
    page: number
    pageSize: number
    whereClause?: string
  }): string
  getDefaultSchemaName(source: SqlCompletionSourceRecord): string
  getTableSchemaSupport(mode: TableSchemaMode): TableSchemaSupport
  createDefaultTableSchema(): TableSchemaDraft
  getTableSchemaUi(mode: TableSchemaMode): SqlTableSchemaUi
}

const SQL_DATA_SOURCE_TYPES: SqlDataSourceType[] = [
  'mysql',
  'mariadb',
  'postgres',
  'cockroachdb',
  'sqlite',
  'duckdb',
  'mssql',
  'clickhouse',
  'oracle',
  'cassandra',
]

export const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export function assertSqlIdentifier(identifier: string) {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`)
  }
}

export function getTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function isSqlDataSourceType(value: DataSourceType | undefined): value is SqlDataSourceType {
  return typeof value === 'string' && SQL_DATA_SOURCE_TYPES.includes(value as SqlDataSourceType)
}

export function defineSqlDialect(dialect: RegisteredSqlDialect) {
  return dialect
}
