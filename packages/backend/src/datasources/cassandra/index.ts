import { resolveTcpTransportConfig } from '../shared/runtime.ts'
import { getTransportSecretFields } from '../shared/transport.ts'
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
    transportSupport: {
      ssh: true,
      tls: true,
    },
  },
  secretFields: ['password', ...getTransportSecretFields({ ssh: true, tls: true })],
  normalizeConfig(config) {
    return normalizeNetworkSqlConfig(config, {
      defaultPort: 9042,
      requireUser: false,
      requirePassword: false,
      requireDatabase: false,
      includeTls: true,
      includeSsh: true,
    })
  },
  resolveRuntimeConfig(config, context) {
    return resolveTcpTransportConfig(config as never, context)
  },
  createSqlAdapter(config) {
    return new CassandraSqlAdapter(config as never)
  },
} satisfies DataSourceModule
