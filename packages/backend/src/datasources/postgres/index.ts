import { PostgresAdapter } from '../../adapters/database/sql/postgres-adapter/PostgresAdapter.ts'
import { requirePort, requireString } from '../shared/config-helpers.ts'
import type { DataSourceModule } from '../shared/module.ts'

type PostgresConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
}

function normalizePostgresConfig(config: Record<string, unknown>): PostgresConfig {
  return {
    host: requireString(config, 'host'),
    port: requirePort(config, 5432),
    user: requireString(config, 'user'),
    password: requireString(config, 'password'),
    database: requireString(config, 'database'),
  }
}

export const postgresDataSourceModule = {
  definition: {
    type: 'postgres',
    kind: 'sql',
    label: 'Postgres',
    icon: 'database',
    capabilities: {
      sqlQuery: true,
      tableBrowser: true,
      dataEditor: true,
      schemaEditor: true,
      resourceBrowser: false,
    },
  },
  secretFields: ['password'],
  normalizeConfig: normalizePostgresConfig,
  createSqlAdapter(config) {
    return new PostgresAdapter(config as PostgresConfig)
  },
} satisfies DataSourceModule
