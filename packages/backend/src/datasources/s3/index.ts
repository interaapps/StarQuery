import { resolveTcpTransportConfig } from '../shared/runtime.ts'
import { getTransportSecretFields } from '../shared/transport.ts'
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
    transportSupport: {
      ssh: true,
      tls: true,
    },
  },
  secretFields: ['secretKey', 'sessionToken', ...getTransportSecretFields({ ssh: true, tls: true })],
  normalizeConfig(config) {
    return normalizeS3CompatibleConfig(config, {
      pathStyle: false,
      port: 443,
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
