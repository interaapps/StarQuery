import { optionalString, requireString } from '../shared/config-helpers.ts'
import { resolveTcpTransportConfig } from '../shared/runtime.ts'
import { getTransportSecretFields, normalizeSshTunnelConfig, normalizeTlsConfig } from '../shared/transport.ts'
import type { DataSourceModule } from '../shared/module.ts'
import { ElasticsearchResourceAdapter } from './adapter.ts'

type ElasticsearchConfig = {
  node: string
  username?: string
  password?: string
  apiKey?: string
  index?: string
  tls?: ReturnType<typeof normalizeTlsConfig>
  ssh?: ReturnType<typeof normalizeSshTunnelConfig>
}

function normalizeElasticsearchConfig(config: Record<string, unknown>): ElasticsearchConfig {
  const node = requireString(config, 'node')
  return {
    node,
    username: optionalString(config, 'username'),
    password: optionalString(config, 'password'),
    apiKey: optionalString(config, 'apiKey'),
    index: optionalString(config, 'index'),
    tls: normalizeTlsConfig(config, {
      defaultEnabled: /^https:\/\//i.test(node),
    }),
    ssh: normalizeSshTunnelConfig(config),
  }
}

export const elasticsearchDataSourceModule = {
  definition: {
    type: 'elasticsearch',
    kind: 'search',
    label: 'Elasticsearch',
    icon: 'search',
    capabilities: {
      sqlQuery: false,
      tableBrowser: false,
      dataEditor: true,
      schemaEditor: false,
      resourceBrowser: true,
    },
    transportSupport: {
      ssh: true,
      tls: true,
    },
  },
  secretFields: ['password', 'apiKey', ...getTransportSecretFields({ ssh: true, tls: true })],
  normalizeConfig: normalizeElasticsearchConfig,
  async resolveRuntimeConfig(config, context) {
    const nextConfig = config as ElasticsearchConfig
    const nodeUrl = new URL(nextConfig.node)
    if (!['http:', 'https:'].includes(nodeUrl.protocol)) {
      throw new Error('Elasticsearch node URLs must use http:// or https://')
    }

    const defaultPort = nodeUrl.protocol === 'https:' ? 443 : 80
    const resolved = await resolveTcpTransportConfig(
      {
        host: nodeUrl.hostname,
        port: nodeUrl.port ? Number(nodeUrl.port) : defaultPort,
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
    return new ElasticsearchResourceAdapter(config as ElasticsearchConfig)
  },
} satisfies DataSourceModule
