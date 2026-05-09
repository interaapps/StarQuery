import { MySQLAdapter } from '../../adapters/database/sql/mysql-adapter/MySQLAdapter.ts'
import { resolveTcpTransportConfig } from '../shared/runtime.ts'
import { getTransportSecretFields } from '../shared/transport.ts'
import { normalizeNetworkSqlConfig } from '../shared-sql/network-config.ts'
import type { DataSourceModule } from '../shared/module.ts'

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
    transportSupport: {
      ssh: true,
      tls: true,
    },
  },
  secretFields: ['password', ...getTransportSecretFields({ ssh: true, tls: true })],
  normalizeConfig(config) {
    return normalizeNetworkSqlConfig(config, {
      defaultPort: 3306,
      requireUser: true,
      requirePassword: true,
      requireDatabase: true,
      includeTls: true,
      includeSsh: true,
    })
  },
  resolveRuntimeConfig(config, context) {
    return resolveTcpTransportConfig(config as never, context)
  },
  createSqlAdapter(config) {
    return new MySQLAdapter(config as never)
  },
} satisfies DataSourceModule
