import { optionalString, requirePort, requireString } from '../shared/config-helpers.ts'
import type { SshTunnelConfig, TlsConfig } from '../shared/transport.ts'
import { normalizeSshTunnelConfig, normalizeTlsConfig } from '../shared/transport.ts'

export type NetworkSqlConfig = {
  host: string
  port: number
  user?: string
  password?: string
  database?: string
  schema?: string
  tls?: TlsConfig
  ssh?: SshTunnelConfig
}

export function normalizeNetworkSqlConfig(
  config: Record<string, unknown>,
  options: {
    defaultPort: number
    requireUser?: boolean
    requirePassword?: boolean
    requireDatabase?: boolean
    includeSchema?: boolean
    includeTls?: boolean
    includeSsh?: boolean
  },
): NetworkSqlConfig {
  const nextConfig: NetworkSqlConfig = {
    host: requireString(config, 'host'),
    port: requirePort(config, options.defaultPort),
  }

  if (options.requireUser) {
    nextConfig.user = requireString(config, 'user')
  } else {
    nextConfig.user = optionalString(config, 'user')
  }

  if (options.requirePassword) {
    nextConfig.password = requireString(config, 'password')
  } else {
    nextConfig.password = optionalString(config, 'password')
  }

  if (options.requireDatabase) {
    nextConfig.database = requireString(config, 'database')
  } else {
    nextConfig.database = optionalString(config, 'database')
  }

  if (options.includeSchema) {
    nextConfig.schema = optionalString(config, 'schema')
  }

  if (options.includeTls) {
    nextConfig.tls = normalizeTlsConfig(config, {
      legacyBooleanKeys: ['ssl'],
    })
  }

  if (options.includeSsh) {
    nextConfig.ssh = normalizeSshTunnelConfig(config)
  }

  return nextConfig
}
