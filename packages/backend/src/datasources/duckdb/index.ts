import { requireString } from '../shared/config-helpers.ts'
import type { DataSourceModule } from '../shared/module.ts'
import { DuckDbSqlAdapter } from './adapter.ts'

export const duckDbDataSourceModule = {
  definition: {
    type: 'duckdb',
    kind: 'sql',
    label: 'DuckDB',
    icon: 'database',
    localOnly: true,
    capabilities: {
      sqlQuery: true,
      tableBrowser: true,
      dataEditor: true,
      schemaEditor: true,
      tableCreate: true,
      resourceBrowser: false,
    },
  },
  normalizeConfig(config) {
    return {
      filePath: requireString(config, 'filePath'),
    }
  },
  createSqlAdapter(config) {
    return new DuckDbSqlAdapter(config as { filePath: string })
  },
} satisfies DataSourceModule
