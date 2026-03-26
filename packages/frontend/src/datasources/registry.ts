import { cassandraDataSourceDefinition } from '@/datasources/cassandra/definition'
import { clickHouseDataSourceDefinition } from '@/datasources/clickhouse/definition'
import { cockroachDbDataSourceDefinition } from '@/datasources/cockroachdb/definition'
import { convexDataSourceDefinition } from '@/datasources/convex/definition'
import { duckDbDataSourceDefinition } from '@/datasources/duckdb/definition'
import { elasticsearchDataSourceDefinition } from '@/datasources/elasticsearch/definition'
import { mariadbDataSourceDefinition } from '@/datasources/mariadb/definition'
import { mongodbDataSourceDefinition } from '@/datasources/mongodb/definition'
import { mssqlDataSourceDefinition } from '@/datasources/mssql/definition'
import { minioDataSourceDefinition } from '@/datasources/minio/definition'
import { mysqlDataSourceDefinition } from '@/datasources/mysql/definition'
import { oracleDataSourceDefinition } from '@/datasources/oracle/definition'
import { postgresDataSourceDefinition } from '@/datasources/postgres/definition'
import { redisDataSourceDefinition } from '@/datasources/redis/definition'
import { s3DataSourceDefinition } from '@/datasources/s3/definition'
import { sqliteDataSourceDefinition } from '@/datasources/sqlite/definition'
import type { RegisteredDataSourceDefinition } from '@/datasources/shared/module'
import type { DataSourceDefinition, DataSourceType } from '@/types/datasources'
import type { DataSourceRecord, ServerInfo } from '@/types/workspace'

export const REDACTED_SECRET_VALUE = '__STARQUERY_REDACTED__'

const DATA_SOURCE_DEFINITIONS: Record<DataSourceType, RegisteredDataSourceDefinition> = {
  mysql: mysqlDataSourceDefinition,
  mariadb: mariadbDataSourceDefinition,
  postgres: postgresDataSourceDefinition,
  cockroachdb: cockroachDbDataSourceDefinition,
  convex: convexDataSourceDefinition,
  sqlite: sqliteDataSourceDefinition,
  duckdb: duckDbDataSourceDefinition,
  mssql: mssqlDataSourceDefinition,
  clickhouse: clickHouseDataSourceDefinition,
  oracle: oracleDataSourceDefinition,
  mongodb: mongodbDataSourceDefinition,
  redis: redisDataSourceDefinition,
  cassandra: cassandraDataSourceDefinition,
  elasticsearch: elasticsearchDataSourceDefinition,
  s3: s3DataSourceDefinition,
  minio: minioDataSourceDefinition,
}

function isDataSourceType(value: string): value is DataSourceType {
  return value in DATA_SOURCE_DEFINITIONS
}

function mergeDefinition(
  baseDefinition: RegisteredDataSourceDefinition,
  override: Partial<DataSourceDefinition>,
): RegisteredDataSourceDefinition {
  return {
    ...baseDefinition,
    ...override,
    capabilities: {
      ...baseDefinition.capabilities,
      ...override.capabilities,
    },
  }
}

function normalizeDataSourceDefinition(
  entry: ServerInfo['capabilities']['dataSources'][number],
): RegisteredDataSourceDefinition | null {
  if (typeof entry === 'string') {
    return isDataSourceType(entry) ? DATA_SOURCE_DEFINITIONS[entry] : null
  }

  if (
    !entry ||
    typeof entry !== 'object' ||
    !('type' in entry) ||
    !isDataSourceType(String(entry.type))
  ) {
    return null
  }

  return mergeDefinition(DATA_SOURCE_DEFINITIONS[entry.type], entry)
}

export function listRegisteredDataSourceDefinitions(serverInfo: ServerInfo | null | undefined) {
  const entries =
    serverInfo?.capabilities?.dataSources ??
    (Object.values(DATA_SOURCE_DEFINITIONS) as Array<DataSourceDefinition | DataSourceType>)
  const normalized = entries
    .map((entry) => normalizeDataSourceDefinition(entry))
    .filter((entry): entry is RegisteredDataSourceDefinition => entry !== null)

  return normalized.length ? normalized : Object.values(DATA_SOURCE_DEFINITIONS)
}

export function getRegisteredDataSourceDefinition(
  type: DataSourceType,
  serverInfo?: ServerInfo | null,
) {
  return (
    listRegisteredDataSourceDefinitions(serverInfo).find((entry) => entry.type === type) ??
    DATA_SOURCE_DEFINITIONS[type]
  )
}

export function isSqlDataSource(type: DataSourceType, serverInfo?: ServerInfo | null) {
  return getRegisteredDataSourceDefinition(type, serverInfo).kind === 'sql'
}

export function supportsResourceBrowser(type: DataSourceType, serverInfo?: ServerInfo | null) {
  return getRegisteredDataSourceDefinition(type, serverInfo).capabilities.resourceBrowser
}

export function supportsQueryConsole(type: DataSourceType, serverInfo?: ServerInfo | null) {
  const capabilities = getRegisteredDataSourceDefinition(type, serverInfo).capabilities
  return capabilities.queryConsole ?? capabilities.sqlQuery
}

export function supportsTableBrowser(type: DataSourceType, serverInfo?: ServerInfo | null) {
  return getRegisteredDataSourceDefinition(type, serverInfo).capabilities.tableBrowser
}

export function supportsDataEditor(type: DataSourceType, serverInfo?: ServerInfo | null) {
  return getRegisteredDataSourceDefinition(type, serverInfo).capabilities.dataEditor
}

export function supportsSchemaEditor(type: DataSourceType, serverInfo?: ServerInfo | null) {
  return getRegisteredDataSourceDefinition(type, serverInfo).capabilities.schemaEditor
}

export function supportsTableCreate(type: DataSourceType, serverInfo?: ServerInfo | null) {
  const capabilities = getRegisteredDataSourceDefinition(type, serverInfo).capabilities
  return capabilities.tableCreate ?? capabilities.schemaEditor
}

export function getSecretFields(type: DataSourceType) {
  return [...getRegisteredDataSourceDefinition(type).secretFields]
}

export function getRedactedSecretFields(
  source: Pick<DataSourceRecord, 'type' | 'config'> | null | undefined,
) {
  if (!source) {
    return []
  }

  return getSecretFields(source.type).filter(
    (field) => source.config[field] === REDACTED_SECRET_VALUE,
  )
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

export function createDataSourceFormState(type: DataSourceType, source?: DataSourceRecord | null) {
  const nextType = source?.type ?? type
  const definition = getRegisteredDataSourceDefinition(nextType)
  const redactedSecretFields = getRedactedSecretFields(source)
  const config = {
    ...definition.createDefaultConfig(),
    ...(source?.config ?? {}),
  }

  for (const secretField of redactedSecretFields) {
    config[secretField] = ''
  }

  return {
    name: source?.name ?? '',
    type: nextType,
    config,
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
    if (
      config[secretField] === '' ||
      config[secretField] === undefined ||
      config[secretField] === null
    ) {
      config[secretField] = REDACTED_SECRET_VALUE
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
  return getRegisteredDataSourceDefinition(input.type).canSubmit({
    name: input.name,
    config: input.config,
    redactedSecretFields: input.redactedSecretFields ?? [],
  })
}
