import ConfigForm from '@/datasources/mysql/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'

export const mysqlDataSourceDefinition = defineDataSourceDefinition({
  type: 'mysql',
  kind: 'sql',
  label: 'MySQL',
  icon: 'brand-mysql',
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
      port: 3306,
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
