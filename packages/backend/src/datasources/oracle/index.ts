import { normalizeNetworkSqlConfig } from '../shared-sql/network-config.ts'
import type { DataSourceModule } from '../shared/module.ts'
import { OracleSqlAdapter } from './adapter.ts'

export const oracleDataSourceModule = {
  definition: {
    type: 'oracle',
    kind: 'sql',
    label: 'Oracle',
    icon: 'database',
    capabilities: {
      sqlQuery: true,
      tableBrowser: true,
      dataEditor: false,
      schemaEditor: true,
      tableCreate: true,
      resourceBrowser: false,
    },
  },
  secretFields: ['password'],
  normalizeConfig(config) {
    return normalizeNetworkSqlConfig(config, {
      defaultPort: 1521,
      requireUser: true,
      requirePassword: true,
      requireDatabase: true,
      includeSchema: true,
    })
  },
  createSqlAdapter(config) {
    return new OracleSqlAdapter(
      config as {
        host: string
        port: number
        user: string
        password: string
        database: string
        schema?: string
      },
    )
  },
} satisfies DataSourceModule
