import type { DataSourceType } from '@/types/datasources'
import type { DataSourceRecord } from '@/types/workspace'
import { getRedactedSecretFields, stripRedactedSecrets } from '@/services/data-source-secrets'

function defaultConfigForType(type: DataSourceType): Record<string, unknown> {
  switch (type) {
    case 'mysql':
      return {
        host: '127.0.0.1',
        port: 3306,
        user: '',
        password: '',
        database: '',
      }
    case 'postgres':
      return {
        host: '127.0.0.1',
        port: 5432,
        user: '',
        password: '',
        database: '',
      }
    case 'sqlite':
      return {
        filePath: '',
      }
    case 'elasticsearch':
      return {
        node: 'http://127.0.0.1:9200',
        username: '',
        password: '',
        apiKey: '',
        index: '',
      }
    case 's3':
      return {
        endPoint: 's3.amazonaws.com',
        port: 443,
        useSSL: true,
        pathStyle: false,
        accessKey: '',
        secretKey: '',
        sessionToken: '',
        region: 'eu-central-1',
        bucket: '',
      }
    case 'minio':
      return {
        endPoint: '127.0.0.1',
        port: 9000,
        useSSL: false,
        pathStyle: true,
        accessKey: '',
        secretKey: '',
        sessionToken: '',
        region: '',
        bucket: '',
      }
  }
}

function normalizeConfigForEdit(type: DataSourceType, config: Record<string, unknown>, redactedSecretFields: string[]) {
  const nextConfig = {
    ...defaultConfigForType(type),
    ...config,
  }

  for (const secretField of redactedSecretFields) {
    nextConfig[secretField] = ''
  }

  return nextConfig
}

export function createDataSourceFormState(type: DataSourceType, source?: DataSourceRecord | null) {
  const nextType = source?.type ?? type
  const redactedSecretFields = getRedactedSecretFields(source)

  return {
    name: source?.name ?? '',
    type: nextType,
    config: source
      ? normalizeConfigForEdit(nextType, source.config, redactedSecretFields)
      : defaultConfigForType(nextType),
    redactedSecretFields,
  }
}

export function buildDataSourcePayload(input: {
  name: string
  type: DataSourceType
  config: Record<string, unknown>
  redactedSecretFields?: string[]
}) {
  const config = { ...input.config }
  for (const secretField of input.redactedSecretFields ?? []) {
    if (config[secretField] === '' || config[secretField] === undefined || config[secretField] === null) {
      config[secretField] = '__STARQUERY_REDACTED__'
    }
  }

  return {
    name: input.name.trim(),
    type: input.type,
    config: stripRedactedSecrets(input.type, config),
  }
}

export function canSubmitDataSourcePayload(input: {
  name: string
  type: DataSourceType
  config: Record<string, unknown>
  redactedSecretFields?: string[]
}) {
  const payload = input
  const hasRedactedSecret = (field: string) => (input.redactedSecretFields ?? []).includes(field)

  if (!payload.name.trim()) {
    return false
  }

  if (payload.type === 'sqlite') {
    return Boolean(String(payload.config.filePath ?? '').trim())
  }

  if (payload.type === 'mysql' || payload.type === 'postgres') {
    return Boolean(
      String(payload.config.host ?? '').trim() &&
        Number(payload.config.port ?? 0) > 0 &&
        String(payload.config.user ?? '').trim() &&
        String(payload.config.database ?? '').trim(),
    ) && Boolean(String(payload.config.password ?? '').trim() || hasRedactedSecret('password'))
  }

  if (payload.type === 'elasticsearch') {
    return Boolean(
      String(payload.config.node ?? '').trim() &&
        (String(payload.config.apiKey ?? '').trim() ||
          String(payload.config.password ?? '').trim() ||
          hasRedactedSecret('apiKey') ||
          hasRedactedSecret('password') ||
          !String(payload.config.username ?? '').trim()),
    )
  }

  if (payload.type === 's3' || payload.type === 'minio') {
    return Boolean(
      String(payload.config.endPoint ?? '').trim() &&
        Number(payload.config.port ?? 0) > 0 &&
        String(payload.config.accessKey ?? '').trim() &&
        (String(payload.config.secretKey ?? '').trim() || hasRedactedSecret('secretKey')),
    )
  }

  return false
}
