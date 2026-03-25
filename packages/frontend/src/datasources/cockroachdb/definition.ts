import ConfigForm from '@/datasources/cockroachdb/ConfigForm.vue'
import { createNetworkSqlDataSourceDefinition } from '@/datasources/shared-sql/definition'

export const cockroachDbDataSourceDefinition = createNetworkSqlDataSourceDefinition({
  type: 'cockroachdb',
  label: 'CockroachDB',
  icon: 'database',
  formComponent: ConfigForm,
  defaultPort: 26257,
  showSchema: true,
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
