import type { AppMode } from '../config/app-config.ts'
import { elasticsearchDataSourceModule } from './elasticsearch/index.ts'
import { minioDataSourceModule } from './minio/index.ts'
import { mysqlDataSourceModule } from './mysql/index.ts'
import { postgresDataSourceModule } from './postgres/index.ts'
import { s3DataSourceModule } from './s3/index.ts'
import { sqliteDataSourceModule } from './sqlite/index.ts'
import type { DataSourceModule, DataSourceModuleRegistry } from './shared/module.ts'
import type { DataSourceConfig, DataSourceDefinition, DataSourceType } from './types.ts'

export const DATA_SOURCE_MODULES = {
  mysql: mysqlDataSourceModule,
  postgres: postgresDataSourceModule,
  sqlite: sqliteDataSourceModule,
  elasticsearch: elasticsearchDataSourceModule,
  s3: s3DataSourceModule,
  minio: minioDataSourceModule,
} satisfies DataSourceModuleRegistry

export function isKnownDataSourceType(value: string): value is DataSourceType {
  return value in DATA_SOURCE_MODULES
}

export function getDataSourceModule(type: DataSourceType): DataSourceModule {
  return DATA_SOURCE_MODULES[type]
}

export function getDataSourceDefinition(type: DataSourceType): DataSourceDefinition {
  return getDataSourceModule(type).definition
}

export function listAvailableDataSourceDefinitions(mode: AppMode) {
  return Object.values(DATA_SOURCE_MODULES)
    .map((module): DataSourceDefinition => module.definition)
    .filter((definition) => !(definition.localOnly && mode !== 'local'))
}

export function isSqlDataSourceType(type: DataSourceType) {
  return getDataSourceDefinition(type).kind === 'sql'
}

export function normalizeDataSourceConfig(type: DataSourceType, config: Record<string, unknown>): DataSourceConfig {
  return getDataSourceModule(type).normalizeConfig(config)
}

export function validateDataSourceConfig(type: DataSourceType, config: Record<string, unknown>) {
  normalizeDataSourceConfig(type, config)
}

export function getSecretFields(type: DataSourceType) {
  return [...(getDataSourceModule(type).secretFields ?? [])]
}
