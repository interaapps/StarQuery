import ConfigForm from '@/datasources/redis/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'

export const redisDataSourceDefinition = defineDataSourceDefinition({
  type: 'redis',
  kind: 'resource',
  label: 'Redis',
  icon: 'database',
  capabilities: {
    sqlQuery: false,
    queryConsole: true,
    tableBrowser: false,
    dataEditor: false,
    schemaEditor: false,
    resourceBrowser: true,
  },
  formComponent: ConfigForm,
  secretFields: ['password'],
  createDefaultConfig() {
    return {
      host: '127.0.0.1',
      port: 6379,
      username: '',
      password: '',
      database: 0,
      ssl: false,
    }
  },
  canSubmit(input) {
    return Boolean(
      input.name.trim() &&
        String(input.config.host ?? '').trim() &&
        Number(input.config.port ?? 0) > 0,
    )
  },
  getFormProps({ redactedSecretFields }) {
    return { redactedSecretFields }
  },
})
