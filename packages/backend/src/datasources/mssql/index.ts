import { resolveTcpTransportConfig } from '../shared/runtime.ts'
import { getTransportSecretFields } from '../shared/transport.ts'
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
    transportSupport: {
      ssh: true,
      tls: true,
    },
  },
  secretFields: ['password', ...getTransportSecretFields({ ssh: true, tls: true })],
  normalizeConfig(config) {
    return normalizeNetworkSqlConfig(config, {
      defaultPort: 1433,
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
    return new MssqlSqlAdapter(config as never)
  },
} satisfies DataSourceModule
