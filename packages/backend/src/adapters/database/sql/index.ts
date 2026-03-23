import { MySQLAdapter } from './mysql-adapter/MySQLAdapter.ts'
import { PostgresAdapter } from './postgres-adapter/PostgresAdapter.ts'
import { SqliteAdapter } from './sqlite-adapter/SqliteAdapter.ts'

export const SQL_ADAPTERS = {
  mysql: MySQLAdapter,
  postgres: PostgresAdapter,
  sqlite: SqliteAdapter,
}
