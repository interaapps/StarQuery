import type { DefaultSQLAdapter } from '../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import type { ResourceDataSourceAdapter } from '../shared-resource/types.ts'
import type { DataSourceConfig, DataSourceDefinition, DataSourceType } from '../types.ts'

export type DataSourceModule = {
  definition: DataSourceDefinition
  secretFields?: readonly string[]
  normalizeConfig(config: Record<string, unknown>): DataSourceConfig
  createSqlAdapter?(config: DataSourceConfig): DefaultSQLAdapter
  createResourceAdapter?(config: DataSourceConfig): ResourceDataSourceAdapter
}

export type DataSourceModuleRegistry = Record<DataSourceType, DataSourceModule>
