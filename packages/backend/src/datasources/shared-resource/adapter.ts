import type { DataSourceRecord } from '../../meta/types.ts'
import { getDataSourceModule } from '../registry.ts'
import type { ResourceDataSourceAdapter } from './types.ts'

function createResourceAdapter(source: DataSourceRecord): ResourceDataSourceAdapter {
  const dataSourceModule = getDataSourceModule(source.type)
  if (!dataSourceModule.createResourceAdapter) {
    throw new Error(`Datasource type ${source.type} does not support resource browsing`)
  }

  return dataSourceModule.createResourceAdapter(dataSourceModule.normalizeConfig(source.config))
}

export async function withResourceAdapter<T>(
  source: DataSourceRecord,
  callback: (adapter: ResourceDataSourceAdapter) => Promise<T>,
) {
  const adapter = createResourceAdapter(source)
  await adapter.connect()

  try {
    return await callback(adapter)
  } finally {
    await adapter.close()
  }
}
