import type { DataSourceType } from '@/types/datasources'
import type { TableSchemaDraft, TableSchemaMode } from '@/types/table-schema'
import { cassandraSqlDialect } from '@/datasources/cassandra/sql-dialect'
import { clickHouseSqlDialect } from '@/datasources/clickhouse/sql-dialect'
import { cockroachDbSqlDialect } from '@/datasources/cockroachdb/sql-dialect'
import { duckDbSqlDialect } from '@/datasources/duckdb/sql-dialect'
import { mariadbSqlDialect } from '@/datasources/mariadb/sql-dialect'
import { mssqlSqlDialect } from '@/datasources/mssql/sql-dialect'
import { mysqlSqlDialect } from '@/datasources/mysql/sql-dialect'
import { oracleSqlDialect } from '@/datasources/oracle/sql-dialect'
import { postgresSqlDialect } from '@/datasources/postgres/sql-dialect'
import { sqliteSqlDialect } from '@/datasources/sqlite/sql-dialect'
import type {
  RegisteredSqlDialect,
  SqlCompletionSourceRecord,
  SqlDataSourceType,
  SqlTableSchemaUi,
} from '@/datasources/shared-sql/dialect-types'
import { isSqlDataSourceType } from '@/datasources/shared-sql/dialect-types'

const SQL_DIALECTS: Record<SqlDataSourceType, RegisteredSqlDialect> = {
  mysql: mysqlSqlDialect,
  mariadb: mariadbSqlDialect,
  postgres: postgresSqlDialect,
  cockroachdb: cockroachDbSqlDialect,
  sqlite: sqliteSqlDialect,
  duckdb: duckDbSqlDialect,
  mssql: mssqlSqlDialect,
  clickhouse: clickHouseSqlDialect,
  oracle: oracleSqlDialect,
  cassandra: cassandraSqlDialect,
}

export function getSqlDialect(sourceType: DataSourceType | undefined): RegisteredSqlDialect {
  if (isSqlDataSourceType(sourceType)) {
    return SQL_DIALECTS[sourceType]
  }

  return mysqlSqlDialect
}

export function quoteSqlIdentifier(identifier: string, sourceType: DataSourceType | undefined) {
  return getSqlDialect(sourceType).quoteIdentifier(identifier)
}

export function getSqlEditorDialect(sourceType: DataSourceType | undefined) {
  return getSqlDialect(sourceType).editorDialect
}

export function getDefaultSqlSchemaName(
  source: SqlCompletionSourceRecord,
  sourceType: DataSourceType | undefined = source.type,
) {
  return getSqlDialect(sourceType).getDefaultSchemaName(source)
}

export function getTableSchemaSupport(sourceType: DataSourceType | undefined, mode: TableSchemaMode) {
  return getSqlDialect(sourceType).getTableSchemaSupport(mode)
}

export function createDefaultSqlTableSchema(sourceType: DataSourceType | undefined): TableSchemaDraft {
  return getSqlDialect(sourceType).createDefaultTableSchema()
}

export function getSqlTableSchemaUi(
  sourceType: DataSourceType | undefined,
  mode: TableSchemaMode,
): SqlTableSchemaUi {
  return getSqlDialect(sourceType).getTableSchemaUi(mode)
}
