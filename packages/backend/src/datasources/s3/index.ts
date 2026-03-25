import type { DataSourceModule } from '../shared/module.ts'
import { S3ResourceAdapter } from './adapter.ts'
import { normalizeS3CompatibleConfig } from './config.ts'

export const s3DataSourceModule = {
  definition: {
    type: 's3',
    kind: 'objectStorage',
    label: 'S3',
    icon: 'cloud',
    capabilities: {
      sqlQuery: false,
      tableBrowser: false,
      dataEditor: false,
      schemaEditor: false,
      resourceBrowser: true,
    },
  },
  secretFields: ['secretKey', 'sessionToken'],
  normalizeConfig(config) {
    return normalizeS3CompatibleConfig(config, {
      useSSL: true,
      pathStyle: false,
      port: 443,
    })
  },
  createResourceAdapter(config) {
    return new S3ResourceAdapter(config as ReturnType<typeof normalizeS3CompatibleConfig>)
  },
} satisfies DataSourceModule
