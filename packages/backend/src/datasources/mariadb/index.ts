import { MySQLAdapter } from '../../adapters/database/sql/mysql-adapter/MySQLAdapter.ts'
import { normalizeNetworkSqlConfig } from '../shared-sql/network-config.ts'
import type { DataSourceModule } from '../shared/module.ts'

export const mariadbDataSourceModule = {
  definition: {
    type: 'mariadb',
    kind: 'sql',
    label: 'MariaDB',
    icon: 'database',
    capabilities: {
      sqlQuery: true,
      tableBrowser: true,
      dataEditor: true,
      schemaEditor: true,
      resourceBrowser: false,
    },
  },
  secretFields: ['password'],
  normalizeConfig(config) {
    return normalizeNetworkSqlConfig(config, {
      defaultPort: 3306,
      requireUser: true,
      requirePassword: true,
      requireDatabase: true,
    })
  },
  createSqlAdapter(config) {
    return new MySQLAdapter(config as { host: string; port: number; user: string; password: string; database: string })
  },
} satisfies DataSourceModule
