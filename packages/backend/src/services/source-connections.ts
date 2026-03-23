import { SQL_ADAPTERS } from '../adapters/database/sql/index.ts'
import type { DefaultSQLAdapter } from '../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import type { DataSourceRecord } from '../meta/types.ts'

export function validateDataSourceConfig(type: DataSourceRecord['type'], config: Record<string, unknown>) {
  if (type === 'mysql' || type === 'postgres') {
    for (const key of ['host', 'port', 'user', 'password', 'database']) {
      if (config[key] === undefined || config[key] === null || config[key] === '') {
        throw new Error(`Datasource config requires ${key}`)
      }
    }
  }

  if (type === 'sqlite' && !config.filePath) {
    throw new Error('SQLite datasources require filePath')
  }
}

export function createSqlAdapter(source: DataSourceRecord): DefaultSQLAdapter {
  validateDataSourceConfig(source.type, source.config)
  const Adapter = SQL_ADAPTERS[source.type]

  if (!Adapter) {
    throw new Error(`Unsupported datasource type: ${source.type}`)
  }

  return new Adapter(source.config as never)
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
