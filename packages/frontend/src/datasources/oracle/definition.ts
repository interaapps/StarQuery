import ConfigForm from '@/datasources/oracle/ConfigForm.vue'
import { createNetworkSqlDataSourceDefinition } from '@/datasources/shared-sql/definition'

export const oracleDataSourceDefinition = createNetworkSqlDataSourceDefinition({
  type: 'oracle',
  label: 'Oracle',
  icon: 'database',
  formComponent: ConfigForm,
  defaultPort: 1521,
  showSchema: true,
  capabilities: {
    sqlQuery: true,
    tableBrowser: true,
    dataEditor: false,
    schemaEditor: true,
    tableCreate: true,
    resourceBrowser: false,
  },
})
