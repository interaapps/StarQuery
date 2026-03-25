import ConfigForm from '@/datasources/postgres/ConfigForm.vue'
import { createNetworkSqlDataSourceDefinition } from '@/datasources/shared-sql/definition'

export const postgresDataSourceDefinition = createNetworkSqlDataSourceDefinition({
  type: 'postgres',
  label: 'Postgres',
  icon: 'brand-postgresql',
  formComponent: ConfigForm,
  defaultPort: 5432,
  capabilities: {
    sqlQuery: true,
    tableBrowser: true,
    dataEditor: true,
    schemaEditor: true,
    resourceBrowser: false,
  },
})
