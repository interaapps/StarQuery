import { postgresSqlDialect } from '@/datasources/postgres/sql-dialect'
import { defineSqlDialect } from '@/datasources/shared-sql/dialect-types'

export const cockroachDbSqlDialect = defineSqlDialect({
  ...postgresSqlDialect,
  type: 'cockroachdb',
})
