import ConfigForm from '@/datasources/clickhouse/ConfigForm.vue'
import { createNetworkSqlDataSourceDefinition } from '@/datasources/shared-sql/definition'

export const clickHouseDataSourceDefinition = createNetworkSqlDataSourceDefinition({
  type: 'clickhouse',
  label: 'ClickHouse',
  icon: 'database',
  formComponent: ConfigForm,
  defaultPort: 8123,
  optionalUser: true,
  optionalPassword: true,
  optionalDatabase: true,
  showSsl: true,
  capabilities: {
    sqlQuery: true,
    tableBrowser: true,
    dataEditor: false,
    schemaEditor: true,
    tableCreate: true,
    resourceBrowser: false,
  },
})
