import type { DataSourceConfig, DataSourceType } from './types.ts'

function requireString(config: Record<string, unknown>, key: string, label = key) {
  const value = config[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Datasource config requires ${label}`)
  }

  return value.trim()
}

function optionalString(config: Record<string, unknown>, key: string) {
  const value = config[key]
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  return String(value).trim() || undefined
}

function requirePort(config: Record<string, unknown>, fallback: number, key = 'port') {
  const value = config[key]
  const nextValue = Number(value ?? fallback)
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    throw new Error(`Datasource config requires a valid ${key}`)
  }

  return nextValue
}

function optionalBoolean(config: Record<string, unknown>, key: string, fallback = false) {
  const value = config[key]
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }

  return Boolean(value)
}

export function normalizeDataSourceConfig(type: DataSourceType, config: Record<string, unknown>): DataSourceConfig {
  if (type === 'mysql' || type === 'postgres') {
    return {
      host: requireString(config, 'host'),
      port: requirePort(config, type === 'postgres' ? 5432 : 3306),
      user: requireString(config, 'user'),
      password: requireString(config, 'password'),
      database: requireString(config, 'database'),
    }
  }

  if (type === 'sqlite') {
    return {
      filePath: requireString(config, 'filePath'),
    }
  }

  if (type === 'elasticsearch') {
    const apiKey = optionalString(config, 'apiKey')
    const password = optionalString(config, 'password')

    return {
      node: requireString(config, 'node'),
      username: optionalString(config, 'username'),
      password,
      apiKey,
      index: optionalString(config, 'index'),
    }
  }

  if (type === 's3' || type === 'minio') {
    return {
      endPoint: requireString(config, 'endPoint'),
      port: requirePort(config, 9000),
      useSSL: optionalBoolean(config, 'useSSL', type === 's3'),
      accessKey: requireString(config, 'accessKey'),
      secretKey: requireString(config, 'secretKey'),
      region: optionalString(config, 'region'),
      bucket: optionalString(config, 'bucket'),
      sessionToken: optionalString(config, 'sessionToken'),
      pathStyle: optionalBoolean(config, 'pathStyle', type === 'minio'),
    }
  }

  throw new Error(`Unsupported datasource type: ${type}`)
}

export function validateDataSourceConfig(type: DataSourceType, config: Record<string, unknown>) {
  normalizeDataSourceConfig(type, config)
}
