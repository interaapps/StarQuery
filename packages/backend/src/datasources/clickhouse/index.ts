import { resolveTcpTransportConfig } from '../shared/runtime.ts'
import { getTransportSecretFields } from '../shared/transport.ts'
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
    transportSupport: {
      ssh: true,
      tls: true,
    },
  },
  secretFields: ['password', ...getTransportSecretFields({ ssh: true, tls: true })],
  normalizeConfig(config) {
    return normalizeNetworkSqlConfig(config, {
      defaultPort: 8123,
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
    return new ClickHouseSqlAdapter(config as never)
  },
} satisfies DataSourceModule
