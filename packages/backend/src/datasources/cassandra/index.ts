import { normalizeNetworkSqlConfig } from '../shared-sql/network-config.ts'
import type { DataSourceModule } from '../shared/module.ts'
import { CassandraSqlAdapter } from './adapter.ts'

export const cassandraDataSourceModule = {
  definition: {
    type: 'cassandra',
    kind: 'sql',
    label: 'Cassandra',
    icon: 'database',
    capabilities: {
      sqlQuery: true,
      tableBrowser: false,
      dataEditor: false,
      schemaEditor: false,
      resourceBrowser: false,
    },
  },
  secretFields: ['password'],
  normalizeConfig(config) {
    return normalizeNetworkSqlConfig(config, {
      defaultPort: 9042,
      requireUser: false,
      requirePassword: false,
      requireDatabase: false,
      includeSsl: true,
    })
  },
  createSqlAdapter(config) {
    return new CassandraSqlAdapter(
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
