import { MySQLAdapter } from '../../adapters/database/sql/mysql-adapter/MySQLAdapter.ts'
import { requirePort, requireString } from '../shared/config-helpers.ts'
import type { DataSourceModule } from '../shared/module.ts'

type MySqlConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
}

function normalizeMySqlConfig(config: Record<string, unknown>): MySqlConfig {
  return {
    host: requireString(config, 'host'),
    port: requirePort(config, 3306),
    user: requireString(config, 'user'),
    password: requireString(config, 'password'),
    database: requireString(config, 'database'),
  }
}

export const mysqlDataSourceModule = {
  definition: {
    type: 'mysql',
    kind: 'sql',
    label: 'MySQL',
    icon: 'brand-mysql',
    capabilities: {
      sqlQuery: true,
      tableBrowser: true,
      dataEditor: true,
      schemaEditor: true,
      resourceBrowser: false,
    },
  },
  secretFields: ['password'],
  normalizeConfig: normalizeMySqlConfig,
  createSqlAdapter(config) {
    return new MySQLAdapter(config as MySqlConfig)
  },
} satisfies DataSourceModule
