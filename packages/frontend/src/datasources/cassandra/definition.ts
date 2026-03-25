import ConfigForm from '@/datasources/cassandra/ConfigForm.vue'
import { createNetworkSqlDataSourceDefinition } from '@/datasources/shared-sql/definition'

export const cassandraDataSourceDefinition = createNetworkSqlDataSourceDefinition({
  type: 'cassandra',
  label: 'Cassandra',
  icon: 'database',
  formComponent: ConfigForm,
  defaultPort: 9042,
  optionalUser: true,
  optionalPassword: true,
  optionalDatabase: true,
  showSsl: true,
  capabilities: {
    sqlQuery: true,
    tableBrowser: false,
    dataEditor: false,
    schemaEditor: false,
    resourceBrowser: false,
  },
})
