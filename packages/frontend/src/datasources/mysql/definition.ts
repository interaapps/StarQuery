import ConfigForm from '@/datasources/mysql/ConfigForm.vue'
import { createNetworkSqlDataSourceDefinition } from '@/datasources/shared-sql/definition'

export const mysqlDataSourceDefinition = createNetworkSqlDataSourceDefinition({
  type: 'mysql',
  label: 'MySQL',
  icon: 'brand-mysql',
  formComponent: ConfigForm,
  defaultPort: 3306,
  capabilities: {
    sqlQuery: true,
    tableBrowser: true,
    dataEditor: true,
    schemaEditor: true,
    resourceBrowser: false,
  },
})
