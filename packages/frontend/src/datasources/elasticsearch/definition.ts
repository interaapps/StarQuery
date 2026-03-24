import ConfigForm from '@/datasources/elasticsearch/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'

export const elasticsearchDataSourceDefinition = defineDataSourceDefinition({
  type: 'elasticsearch',
  kind: 'search',
  label: 'Elasticsearch',
  icon: 'search',
  capabilities: {
    sqlQuery: false,
    tableBrowser: false,
    schemaEditor: false,
    resourceBrowser: true,
  },
  formComponent: ConfigForm,
  secretFields: ['password', 'apiKey'],
  createDefaultConfig() {
    return {
      node: 'http://127.0.0.1:9200',
      username: '',
      password: '',
      apiKey: '',
      index: '',
    }
  },
  canSubmit(input) {
    return Boolean(
      input.name.trim() &&
        String(input.config.node ?? '').trim() &&
        (String(input.config.apiKey ?? '').trim() ||
          String(input.config.password ?? '').trim() ||
          input.redactedSecretFields.includes('apiKey') ||
          input.redactedSecretFields.includes('password') ||
          !String(input.config.username ?? '').trim()),
    )
  },
  getFormProps({ redactedSecretFields }) {
    return { redactedSecretFields }
  },
})
