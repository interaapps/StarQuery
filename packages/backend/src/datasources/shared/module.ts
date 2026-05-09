import type { DefaultSQLAdapter } from '../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import type { AppContext } from '../../app-context.ts'
import type { ResourceDataSourceAdapter } from '../shared-resource/types.ts'
import type { DataSourceConfig, DataSourceDefinition, DataSourceType } from '../types.ts'

export type ResolvedRuntimeConfig = {
  config: Record<string, unknown>
  cleanup?: () => Promise<void>
}

export type DataSourceModule = {
  definition: DataSourceDefinition
  secretFields?: readonly string[]
  normalizeConfig(config: Record<string, unknown>): DataSourceConfig
  resolveRuntimeConfig?(config: DataSourceConfig, context: AppContext): Promise<ResolvedRuntimeConfig>
  createSqlAdapter?(config: Record<string, unknown>): DefaultSQLAdapter
  createResourceAdapter?(config: Record<string, unknown>): ResourceDataSourceAdapter
}

export type DataSourceModuleRegistry = Record<DataSourceType, DataSourceModule>
