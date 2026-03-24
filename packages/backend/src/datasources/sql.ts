import { SQL_ADAPTERS } from '../adapters/database/sql/index.ts'
import type { DefaultSQLAdapter } from '../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import type { DataSourceRecord } from '../meta/types.ts'
import { normalizeDataSourceConfig } from './config.ts'
import { isSqlDataSourceType } from './definitions.ts'

export function createSqlAdapter(source: DataSourceRecord): DefaultSQLAdapter {
  if (!isSqlDataSourceType(source.type)) {
    throw new Error(`Datasource type ${source.type} does not support SQL operations`)
  }

  const Adapter = SQL_ADAPTERS[source.type]
  if (!Adapter) {
    throw new Error(`Unsupported SQL datasource type: ${source.type}`)
  }

  return new Adapter(normalizeDataSourceConfig(source.type, source.config) as never)
}

export async function withSqlAdapter<T>(
  source: DataSourceRecord,
  callback: (adapter: DefaultSQLAdapter) => Promise<T>,
) {
  const adapter = createSqlAdapter(source)
  await adapter.connect()

  try {
    return await callback(adapter)
  } finally {
    await adapter.close()
  }
}
