import type { DataSourceDefinition, DataSourceType } from '@/types/datasources'
import type { ServerInfo } from '@/types/workspace'

export const FALLBACK_DATA_SOURCE_DEFINITIONS: Record<DataSourceType, DataSourceDefinition> = {
  mysql: {
    type: 'mysql',
    kind: 'sql',
    label: 'MySQL',
    icon: 'brand-mysql',
    capabilities: {
      sqlQuery: true,
      tableBrowser: true,
      schemaEditor: true,
      resourceBrowser: false,
    },
  },
  postgres: {
    type: 'postgres',
    kind: 'sql',
    label: 'Postgres',
    icon: 'brand-postgresql',
    capabilities: {
      sqlQuery: true,
      tableBrowser: true,
      schemaEditor: true,
      resourceBrowser: false,
    },
  },
  sqlite: {
    type: 'sqlite',
    kind: 'sql',
    label: 'SQLite',
    icon: 'database',
    localOnly: true,
    capabilities: {
      sqlQuery: true,
      tableBrowser: true,
      schemaEditor: true,
      resourceBrowser: false,
    },
  },
  elasticsearch: {
    type: 'elasticsearch',
    kind: 'search',
    label: 'Elasticsearch',
    icon: 'search',
    capabilities: {
      sqlQuery: false,
      tableBrowser: false,
      schemaEditor: false,
      resourceBrowser: true,
    },
  },
  s3: {
    type: 's3',
    kind: 'objectStorage',
    label: 'S3',
    icon: 'cloud',
    capabilities: {
      sqlQuery: false,
      tableBrowser: false,
      schemaEditor: false,
      resourceBrowser: true,
    },
  },
  minio: {
    type: 'minio',
    kind: 'objectStorage',
    label: 'MinIO',
    icon: 'bucket',
    capabilities: {
      sqlQuery: false,
      tableBrowser: false,
      schemaEditor: false,
      resourceBrowser: true,
    },
  },
}

function isDataSourceType(value: string): value is DataSourceType {
  return value in FALLBACK_DATA_SOURCE_DEFINITIONS
}

function normalizeDataSourceDefinition(
  entry: ServerInfo['capabilities']['dataSources'][number],
): DataSourceDefinition | null {
  if (typeof entry === 'string') {
    return isDataSourceType(entry) ? FALLBACK_DATA_SOURCE_DEFINITIONS[entry] : null
  }

  if (!entry || typeof entry !== 'object' || !('type' in entry) || !isDataSourceType(String(entry.type))) {
    return null
  }

  const fallback = FALLBACK_DATA_SOURCE_DEFINITIONS[entry.type]
  return {
    ...fallback,
    ...entry,
    capabilities: {
      ...fallback.capabilities,
      ...entry.capabilities,
    },
  }
}

export function listDataSourceDefinitions(serverInfo: ServerInfo | null | undefined) {
  const entries =
    serverInfo?.capabilities?.dataSources ?? (Object.values(FALLBACK_DATA_SOURCE_DEFINITIONS) as DataSourceDefinition[])
  const normalized = entries
    .map((entry) => normalizeDataSourceDefinition(entry))
    .filter((entry): entry is DataSourceDefinition => entry !== null)

  return normalized.length ? normalized : Object.values(FALLBACK_DATA_SOURCE_DEFINITIONS)
}

export function getDataSourceDefinition(type: DataSourceType, serverInfo?: ServerInfo | null) {
  return listDataSourceDefinitions(serverInfo).find((entry) => entry.type === type) ?? FALLBACK_DATA_SOURCE_DEFINITIONS[type]
}

export function isSqlDataSource(type: DataSourceType, serverInfo?: ServerInfo | null) {
  return getDataSourceDefinition(type, serverInfo).kind === 'sql'
}

export function supportsResourceBrowser(type: DataSourceType, serverInfo?: ServerInfo | null) {
  return getDataSourceDefinition(type, serverInfo).capabilities.resourceBrowser
}
