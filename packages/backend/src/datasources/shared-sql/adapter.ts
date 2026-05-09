import type { DefaultSQLAdapter } from '../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import type { AppContext } from '../../app-context.ts'
import type { DataSourceRecord } from '../../meta/types.ts'
import { getDataSourceModule } from '../registry.ts'
import { resolveDataSourceRuntime } from '../shared/runtime.ts'

export async function withSqlAdapter<T>(
  source: DataSourceRecord,
  context: AppContext,
  callback: (adapter: DefaultSQLAdapter) => Promise<T>,
) {
  const dataSourceModule = getDataSourceModule(source.type)
  if (!dataSourceModule.createSqlAdapter) {
    throw new Error(`Datasource type ${source.type} does not support SQL operations`)
  }

  const resolved = await resolveDataSourceRuntime(source, context)
  const adapter = dataSourceModule.createSqlAdapter(resolved.config)

  try {
    await adapter.connect()
    return await callback(adapter)
  } finally {
    await adapter.close().catch(() => undefined)
    await resolved.cleanup().catch(() => undefined)
  }
}
