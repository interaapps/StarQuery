import type { DataSourceRecord } from '../meta/types.ts'

export const REDACTED_PASSWORD = '__STARQUERY_REDACTED__'

const SECRET_FIELDS: Partial<Record<DataSourceRecord['type'], string[]>> = {
  mysql: ['password'],
  postgres: ['password'],
  elasticsearch: ['password', 'apiKey'],
  s3: ['secretKey', 'sessionToken'],
  minio: ['secretKey', 'sessionToken'],
}

export function sanitizeDataSourceRecord(source: DataSourceRecord): DataSourceRecord {
  const secretFields = SECRET_FIELDS[source.type] ?? []
  if (!secretFields.length) {
    return source
  }

  let nextConfig = source.config
  let changed = false

  for (const key of secretFields) {
    const secretValue = nextConfig[key]
    if (secretValue === undefined || secretValue === null || secretValue === '') {
      continue
    }

    nextConfig = {
      ...nextConfig,
      [key]: REDACTED_PASSWORD,
    }
    changed = true
  }

  return changed ? { ...source, config: nextConfig } : source
}

export function mergeDataSourceConfig(
  source: DataSourceRecord,
  nextType: DataSourceRecord['type'],
  configPatch?: Record<string, unknown>,
) {
  if (!configPatch) {
    return source.config
  }

  const currentConfig = source.config ?? {}
  const nextConfig = {
    ...currentConfig,
    ...configPatch,
  }

  for (const key of SECRET_FIELDS[nextType] ?? []) {
    const patchValue = configPatch[key]
    if (patchValue === undefined || patchValue === REDACTED_PASSWORD) {
      nextConfig[key] = currentConfig[key]
    }
  }

  return nextConfig
}
