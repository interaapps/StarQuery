import { optionalBoolean, optionalString, requirePort, requireString } from '../shared/config-helpers.ts'

export type NetworkSqlConfig = {
  host: string
  port: number
  user?: string
  password?: string
  database?: string
  schema?: string
  ssl?: boolean
}

export function normalizeNetworkSqlConfig(
  config: Record<string, unknown>,
  options: {
    defaultPort: number
    requireUser?: boolean
    requirePassword?: boolean
    requireDatabase?: boolean
    includeSchema?: boolean
    includeSsl?: boolean
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

  if (options.includeSsl) {
    nextConfig.ssl = optionalBoolean(config, 'ssl', false)
  }

  return nextConfig
}
