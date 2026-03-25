import { normalizeNetworkSqlConfig } from '../shared-sql/network-config.ts'
import type { DataSourceModule } from '../shared/module.ts'
import { ClickHouseSqlAdapter } from './adapter.ts'

export const clickHouseDataSourceModule = {
  definition: {
    type: 'clickhouse',
    kind: 'sql',
    label: 'ClickHouse',
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
      defaultPort: 8123,
      requireUser: false,
      requirePassword: false,
      requireDatabase: false,
      includeSsl: true,
    })
  },
  createSqlAdapter(config) {
    return new ClickHouseSqlAdapter(
      config as {
        host: string
        port: number
        user?: string
        password?: string
        database?: string
        ssl?: boolean
      },
    )
  },
} satisfies DataSourceModule
