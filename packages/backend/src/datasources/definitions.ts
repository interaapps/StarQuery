import type { AppMode } from '../config/app-config.ts'
import type { DataSourceDefinition, DataSourceType } from './types.ts'

export const DATA_SOURCE_DEFINITIONS: Record<DataSourceType, DataSourceDefinition> = {
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

export function getDataSourceDefinition(type: DataSourceType) {
  return DATA_SOURCE_DEFINITIONS[type]
}

export function isKnownDataSourceType(value: string): value is DataSourceType {
  return value in DATA_SOURCE_DEFINITIONS
}

export function listAvailableDataSourceDefinitions(mode: AppMode) {
  return Object.values(DATA_SOURCE_DEFINITIONS).filter((definition) => !(definition.localOnly && mode !== 'local'))
}

export function isSqlDataSourceType(type: DataSourceType) {
  return getDataSourceDefinition(type).kind === 'sql'
}
