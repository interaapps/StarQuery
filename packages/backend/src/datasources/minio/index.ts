import type { DataSourceModule } from '../shared/module.ts'
import { S3ResourceAdapter } from '../s3/adapter.ts'
import { normalizeS3CompatibleConfig } from '../s3/config.ts'

export const minioDataSourceModule = {
  definition: {
    type: 'minio',
    kind: 'objectStorage',
    label: 'MinIO',
    icon: 'bucket',
    capabilities: {
      sqlQuery: false,
      tableBrowser: false,
      schemaEditor: false,
      resourceBrowser: true,
    },
  },
  secretFields: ['secretKey', 'sessionToken'],
  normalizeConfig(config) {
    return normalizeS3CompatibleConfig(config, {
      useSSL: false,
      pathStyle: true,
      port: 9000,
    })
  },
  createResourceAdapter(config) {
    return new S3ResourceAdapter(config as ReturnType<typeof normalizeS3CompatibleConfig>)
  },
} satisfies DataSourceModule
