import type { AppContext } from '../../app-context.ts'
import type { DataSourceRecord } from '../../meta/types.ts'
import { getDataSourceModule } from '../registry.ts'
import { resolveDataSourceRuntime } from '../shared/runtime.ts'
import type { ResourceDataSourceAdapter } from './types.ts'

export async function withResourceAdapter<T>(
  source: DataSourceRecord,
  context: AppContext,
  callback: (adapter: ResourceDataSourceAdapter) => Promise<T>,
) {
  const dataSourceModule = getDataSourceModule(source.type)
  if (!dataSourceModule.createResourceAdapter) {
    throw new Error(`Datasource type ${source.type} does not support resource browsing`)
  }

  const resolved = await resolveDataSourceRuntime(source, context)
  const adapter = dataSourceModule.createResourceAdapter(resolved.config)

  try {
    await adapter.connect()
    return await callback(adapter)
  } finally {
    await adapter.close().catch(() => undefined)
    await resolved.cleanup().catch(() => undefined)
  }
}
