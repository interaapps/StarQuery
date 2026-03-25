import type { DataSourceType } from '@/types/datasources'
import type { RegisteredSqlTableSchemaDialect } from '@/datasources/shared-sql/schema/dialect-types'
import type { SqlDataSourceType } from '@/datasources/shared-sql/dialect-types'
import { mysqlTableSchemaDialect } from '@/datasources/mysql/table-schema-dialect'
import { mssqlTableSchemaDialect } from '@/datasources/mssql/table-schema-dialect'
import { oracleTableSchemaDialect } from '@/datasources/oracle/table-schema-dialect'
import { postgresTableSchemaDialect } from '@/datasources/postgres/table-schema-dialect'
import { sqliteTableSchemaDialect } from '@/datasources/sqlite/table-schema-dialect'
import { clickHouseTableSchemaDialect } from '@/datasources/clickhouse/table-schema-dialect'
import { duckDbTableSchemaDialect } from '@/datasources/duckdb/table-schema-dialect'
import { isSqlDataSourceType } from '@/datasources/shared-sql/dialect-types'

const SQL_TABLE_SCHEMA_DIALECTS: Partial<Record<SqlDataSourceType, RegisteredSqlTableSchemaDialect>> = {
  mysql: mysqlTableSchemaDialect,
  mariadb: mysqlTableSchemaDialect,
  postgres: postgresTableSchemaDialect,
  cockroachdb: postgresTableSchemaDialect,
  sqlite: sqliteTableSchemaDialect,
  duckdb: duckDbTableSchemaDialect,
  mssql: mssqlTableSchemaDialect,
  clickhouse: clickHouseTableSchemaDialect,
  oracle: oracleTableSchemaDialect,
}

export function getSqlTableSchemaDialect(
  sourceType: DataSourceType | undefined,
): RegisteredSqlTableSchemaDialect {
  if (isSqlDataSourceType(sourceType)) {
    return SQL_TABLE_SCHEMA_DIALECTS[sourceType] ?? mysqlTableSchemaDialect
  }

  return mysqlTableSchemaDialect
}
