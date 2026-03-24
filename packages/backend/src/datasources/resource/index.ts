import type { DataSourceRecord } from '../../meta/types.ts'
import { normalizeDataSourceConfig } from '../config.ts'
import { getDataSourceDefinition } from '../definitions.ts'
import type { ResourceDataSourceAdapter } from './types.ts'
import { ElasticsearchResourceAdapter } from './elasticsearch-adapter.ts'
import { S3ResourceAdapter } from './s3-adapter.ts'

function createResourceAdapter(source: DataSourceRecord): ResourceDataSourceAdapter {
  const definition = getDataSourceDefinition(source.type)
  if (!definition.capabilities.resourceBrowser) {
    throw new Error(`Datasource type ${source.type} does not support resource browsing`)
  }

  const normalizedConfig = normalizeDataSourceConfig(source.type, source.config)
  if (source.type === 'elasticsearch') {
    return new ElasticsearchResourceAdapter(normalizedConfig as never)
  }

  if (source.type === 's3' || source.type === 'minio') {
    return new S3ResourceAdapter(normalizedConfig as never)
  }

  throw new Error(`Unsupported resource datasource type: ${source.type}`)
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
