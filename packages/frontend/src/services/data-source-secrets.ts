import type { DataSourceType } from '@/types/datasources'
import type { DataSourceRecord } from '@/types/workspace'

export const REDACTED_SECRET_VALUE = '__STARQUERY_REDACTED__'

const SECRET_FIELDS: Partial<Record<DataSourceType, string[]>> = {
  mysql: ['password'],
  postgres: ['password'],
  elasticsearch: ['password', 'apiKey'],
  s3: ['secretKey', 'sessionToken'],
  minio: ['secretKey', 'sessionToken'],
}

export function getSecretFields(type: DataSourceType) {
  return SECRET_FIELDS[type] ?? []
}

export function getRedactedSecretFields(source: Pick<DataSourceRecord, 'type' | 'config'> | null | undefined) {
  if (!source) {
    return []
  }

  return getSecretFields(source.type).filter((field) => source.config[field] === REDACTED_SECRET_VALUE)
}

export function stripRedactedSecrets(type: DataSourceType, config: Record<string, unknown>) {
  const nextConfig = { ...config }

  for (const secretField of getSecretFields(type)) {
    if (nextConfig[secretField] === REDACTED_SECRET_VALUE) {
      delete nextConfig[secretField]
    }
  }

  return nextConfig
}
