import ConfigForm from '@/datasources/postgres/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'

export const postgresDataSourceDefinition = defineDataSourceDefinition({
  type: 'postgres',
  kind: 'sql',
  label: 'Postgres',
  icon: 'brand-postgresql',
  capabilities: {
    sqlQuery: true,
    tableBrowser: true,
    schemaEditor: true,
    resourceBrowser: false,
  },
  formComponent: ConfigForm,
  secretFields: ['password'],
  createDefaultConfig() {
    return {
      host: '127.0.0.1',
      port: 5432,
      user: '',
      password: '',
      database: '',
    }
  },
  canSubmit(input) {
    return Boolean(
      input.name.trim() &&
        String(input.config.host ?? '').trim() &&
        Number(input.config.port ?? 0) > 0 &&
        String(input.config.user ?? '').trim() &&
        String(input.config.database ?? '').trim() &&
        (String(input.config.password ?? '').trim() || input.redactedSecretFields.includes('password')),
    )
  },
  getFormProps({ redactedSecretFields }) {
    return { redactedSecretFields }
  },
})
