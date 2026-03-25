import ConfigForm from '@/datasources/mssql/ConfigForm.vue'
import { createNetworkSqlDataSourceDefinition } from '@/datasources/shared-sql/definition'

export const mssqlDataSourceDefinition = createNetworkSqlDataSourceDefinition({
  type: 'mssql',
  label: 'Microsoft SQL Server',
  icon: 'database',
  formComponent: ConfigForm,
  defaultPort: 1433,
  showSchema: true,
  defaultSchema: 'dbo',
  showSsl: true,
  capabilities: {
    sqlQuery: true,
    tableBrowser: true,
    dataEditor: true,
    schemaEditor: true,
    tableCreate: true,
    resourceBrowser: false,
  },
})
