import { mysqlSqlDialect } from '@/datasources/mysql/sql-dialect'
import { defineSqlDialect } from '@/datasources/shared-sql/dialect-types'

export const mariadbSqlDialect = defineSqlDialect({
  ...mysqlSqlDialect,
  type: 'mariadb',
})
