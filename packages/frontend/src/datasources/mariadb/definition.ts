import ConfigForm from '@/datasources/mariadb/ConfigForm.vue'
import { createNetworkSqlDataSourceDefinition } from '@/datasources/shared-sql/definition'

export const mariadbDataSourceDefinition = createNetworkSqlDataSourceDefinition({
  type: 'mariadb',
  label: 'MariaDB',
  icon: 'database',
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
