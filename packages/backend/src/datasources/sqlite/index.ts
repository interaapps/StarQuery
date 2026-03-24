import { SqliteAdapter } from '../../adapters/database/sql/sqlite-adapter/SqliteAdapter.ts'
import { requireString } from '../shared/config-helpers.ts'
import type { DataSourceModule } from '../shared/module.ts'

type SqliteConfig = {
  filePath: string
}

function normalizeSqliteConfig(config: Record<string, unknown>): SqliteConfig {
  return {
    filePath: requireString(config, 'filePath'),
  }
}

export const sqliteDataSourceModule = {
  definition: {
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
  normalizeConfig: normalizeSqliteConfig,
  createSqlAdapter(config) {
    return new SqliteAdapter(config as SqliteConfig)
  },
} satisfies DataSourceModule
