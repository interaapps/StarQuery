import { resolveTcpTransportConfig } from '../shared/runtime.ts'
import { getTransportSecretFields } from '../shared/transport.ts'
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
    transportSupport: {
      ssh: true,
    },
  },
  secretFields: ['password', ...getTransportSecretFields({ ssh: true })],
  normalizeConfig(config) {
    return normalizeNetworkSqlConfig(config, {
      defaultPort: 1521,
      requireUser: true,
      requirePassword: true,
      requireDatabase: true,
      includeSchema: true,
      includeSsh: true,
    })
  },
  resolveRuntimeConfig(config, context) {
    return resolveTcpTransportConfig(config as never, context)
  },
  createSqlAdapter(config) {
    return new OracleSqlAdapter(config as never)
  },
} satisfies DataSourceModule
