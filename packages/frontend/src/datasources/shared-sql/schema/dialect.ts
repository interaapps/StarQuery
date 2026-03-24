import type { DataSourceType } from '@/types/datasources'
import { mysqlTableSchemaDialect } from '@/datasources/mysql/table-schema-dialect'
import { postgresTableSchemaDialect } from '@/datasources/postgres/table-schema-dialect'
import { sqliteTableSchemaDialect } from '@/datasources/sqlite/table-schema-dialect'
import type { RegisteredSqlTableSchemaDialect } from '@/datasources/shared-sql/schema/dialect-types'
import type { SqlDataSourceType } from '@/datasources/shared-sql/dialect-types'
import { isSqlDataSourceType } from '@/datasources/shared-sql/dialect-types'

const SQL_TABLE_SCHEMA_DIALECTS: Record<SqlDataSourceType, RegisteredSqlTableSchemaDialect> = {
  mysql: mysqlTableSchemaDialect,
  postgres: postgresTableSchemaDialect,
  sqlite: sqliteTableSchemaDialect,
}

export function getSqlTableSchemaDialect(
  sourceType: DataSourceType | undefined,
): RegisteredSqlTableSchemaDialect {
  if (isSqlDataSourceType(sourceType)) {
    return SQL_TABLE_SCHEMA_DIALECTS[sourceType]
  }

  return mysqlTableSchemaDialect
}
