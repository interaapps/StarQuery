import ConfigForm from '@/datasources/mongodb/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'

export const mongodbDataSourceDefinition = defineDataSourceDefinition({
  type: 'mongodb',
  kind: 'resource',
  label: 'MongoDB',
  icon: 'brand-mongodb',
  capabilities: {
    sqlQuery: false,
    tableBrowser: false,
    dataEditor: true,
    schemaEditor: false,
    resourceBrowser: true,
  },
  formComponent: ConfigForm,
  secretFields: ['password'],
  createDefaultConfig() {
    return {
      uri: '',
      host: '127.0.0.1',
      port: 27017,
      username: '',
      password: '',
      database: 'admin',
      authSource: '',
      ssl: false,
    }
  },
  canSubmit(input) {
    return Boolean(
      input.name.trim() &&
        (String(input.config.uri ?? '').trim() ||
          (String(input.config.host ?? '').trim() && Number(input.config.port ?? 0) > 0)),
    )
  },
  getFormProps({ redactedSecretFields }) {
    return { redactedSecretFields }
  },
})
