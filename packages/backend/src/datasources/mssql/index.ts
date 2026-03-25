import { normalizeNetworkSqlConfig } from '../shared-sql/network-config.ts'
import type { DataSourceModule } from '../shared/module.ts'
import { MssqlSqlAdapter } from './adapter.ts'

export const mssqlDataSourceModule = {
  definition: {
    type: 'mssql',
    kind: 'sql',
    label: 'Microsoft SQL Server',
    icon: 'database',
    capabilities: {
      sqlQuery: true,
      tableBrowser: true,
      dataEditor: true,
      schemaEditor: true,
      tableCreate: true,
      resourceBrowser: false,
    },
  },
  secretFields: ['password'],
  normalizeConfig(config) {
    return normalizeNetworkSqlConfig(config, {
      defaultPort: 1433,
      requireUser: true,
      requirePassword: true,
      requireDatabase: true,
      includeSchema: true,
      includeSsl: true,
    })
  },
  createSqlAdapter(config) {
    return new MssqlSqlAdapter(
      config as {
        host: string
        port: number
        user: string
        password: string
        database: string
        schema?: string
        ssl?: boolean
      },
    )
  },
} satisfies DataSourceModule
