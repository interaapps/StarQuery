import { PostgresAdapter } from '../../adapters/database/sql/postgres-adapter/PostgresAdapter.ts'
import { resolveTcpTransportConfig } from '../shared/runtime.ts'
import { getTransportSecretFields } from '../shared/transport.ts'
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
    transportSupport: {
      ssh: true,
      tls: true,
    },
  },
  secretFields: ['password', ...getTransportSecretFields({ ssh: true, tls: true })],
  normalizeConfig(config) {
    return normalizeNetworkSqlConfig(config, {
      defaultPort: 26257,
      requireUser: true,
      requirePassword: true,
      requireDatabase: true,
      includeSchema: true,
      includeTls: true,
      includeSsh: true,
    })
  },
  resolveRuntimeConfig(config, context) {
    return resolveTcpTransportConfig(config as never, context)
  },
  createSqlAdapter(config) {
    return new PostgresAdapter(config as never)
  },
} satisfies DataSourceModule
