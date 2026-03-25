import { PostgresAdapter } from '../../adapters/database/sql/postgres-adapter/PostgresAdapter.ts'
import { normalizeNetworkSqlConfig } from '../shared-sql/network-config.ts'
import type { DataSourceModule } from '../shared/module.ts'

export const cockroachDbDataSourceModule = {
  definition: {
    type: 'cockroachdb',
    kind: 'sql',
    label: 'CockroachDB',
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
      defaultPort: 26257,
      requireUser: true,
      requirePassword: true,
      requireDatabase: true,
      includeSchema: true,
      includeSsl: true,
    })
  },
  createSqlAdapter(config) {
    return new PostgresAdapter(
      config as {
        host: string
        port?: number
        user: string
        password: string
        database: string
        schema?: string
      },
    )
  },
} satisfies DataSourceModule
