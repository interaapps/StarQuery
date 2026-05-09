import { optionalString, requirePort } from '../shared/config-helpers.ts'
import { resolveTcpTransportConfig } from '../shared/runtime.ts'
import { getTransportSecretFields, normalizeSshTunnelConfig, normalizeTlsConfig } from '../shared/transport.ts'
import type { DataSourceModule } from '../shared/module.ts'
import { MongoDbResourceAdapter } from './adapter.ts'

export const mongodbDataSourceModule = {
  definition: {
    type: 'mongodb',
    kind: 'resource',
    label: 'MongoDB',
    icon: 'brand-mongodb',
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
  secretFields: ['password', ...getTransportSecretFields({ ssh: true, tls: true })],
  normalizeConfig(config) {
    const uri = optionalString(config, 'uri')
    const defaultTlsEnabled = Boolean(uri?.trim() && /^mongodb\+srv:\/\//i.test(uri.trim()))

    return {
      uri,
      host: optionalString(config, 'host') ?? '127.0.0.1',
      port: requirePort(config, 27017),
      username: optionalString(config, 'username'),
      password: optionalString(config, 'password'),
      database: optionalString(config, 'database'),
      authSource: optionalString(config, 'authSource'),
      tls: normalizeTlsConfig(config, {
        legacyBooleanKeys: ['ssl'],
        defaultEnabled: defaultTlsEnabled,
      }),
      ssh: normalizeSshTunnelConfig(config),
    }
  },
  async resolveRuntimeConfig(config, context) {
    const nextConfig = config as {
      uri?: string
      host?: string
      port: number
      tls?: ReturnType<typeof normalizeTlsConfig>
      ssh?: ReturnType<typeof normalizeSshTunnelConfig>
    }

    if (nextConfig.uri?.trim() && nextConfig.ssh?.enabled) {
      throw new Error('SSH tunneling is not supported when MongoDB URI mode is used')
    }

    if (nextConfig.uri?.trim()) {
      return {
        config: nextConfig,
      }
    }

    return resolveTcpTransportConfig(
      {
        ...(nextConfig as Record<string, unknown>),
        host: nextConfig.host ?? '127.0.0.1',
        port: nextConfig.port,
      } as never,
      context,
    )
  },
  createResourceAdapter(config) {
    return new MongoDbResourceAdapter(config as never)
  },
} satisfies DataSourceModule
