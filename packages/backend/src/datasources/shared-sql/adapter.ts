import type { DefaultSQLAdapter } from '../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import type { DataSourceRecord } from '../../meta/types.ts'
import { getDataSourceModule } from '../registry.ts'

export function createSqlAdapter(source: DataSourceRecord): DefaultSQLAdapter {
  const dataSourceModule = getDataSourceModule(source.type)
  if (!dataSourceModule.createSqlAdapter) {
    throw new Error(`Datasource type ${source.type} does not support SQL operations`)
  }

  return dataSourceModule.createSqlAdapter(dataSourceModule.normalizeConfig(source.config))
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
