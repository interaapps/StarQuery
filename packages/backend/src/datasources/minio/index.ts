import { resolveTcpTransportConfig } from '../shared/runtime.ts'
import { getTransportSecretFields } from '../shared/transport.ts'
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
      dataEditor: false,
      schemaEditor: false,
      resourceBrowser: true,
    },
    transportSupport: {
      ssh: true,
      tls: true,
    },
  },
  secretFields: ['secretKey', 'sessionToken', ...getTransportSecretFields({ ssh: true, tls: true })],
  normalizeConfig(config) {
    return normalizeS3CompatibleConfig(config, {
      pathStyle: true,
      port: 9000,
    })
  },
  async resolveRuntimeConfig(config, context) {
    const nextConfig = config as ReturnType<typeof normalizeS3CompatibleConfig>
    const resolved = await resolveTcpTransportConfig(
      {
        host: nextConfig.endPoint,
        port: nextConfig.port,
        tls: nextConfig.tls,
        ssh: nextConfig.ssh,
      } as never,
      context,
    )

    return {
      config: {
        ...nextConfig,
        transport: (resolved.config as { transport: unknown }).transport,
      },
      cleanup: resolved.cleanup,
    }
  },
  createResourceAdapter(config) {
    return new S3ResourceAdapter(config as ReturnType<typeof normalizeS3CompatibleConfig>)
  },
} satisfies DataSourceModule
