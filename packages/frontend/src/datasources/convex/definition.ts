import ConfigForm from '@/datasources/convex/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'

export const convexDataSourceDefinition = defineDataSourceDefinition({
  type: 'convex',
  kind: 'resource',
  label: 'Convex',
  icon: 'stack-2',
  capabilities: {
    sqlQuery: false,
    queryConsole: true,
    tableBrowser: false,
    dataEditor: false,
    schemaEditor: false,
    resourceBrowser: true,
  },
  formComponent: ConfigForm,
  secretFields: ['adminKey', 'authToken'],
  createDefaultConfig() {
    return {
      deploymentUrl: '',
      adminKey: '',
      authToken: '',
    }
  },
  canSubmit(input) {
    return Boolean(
      input.name.trim() &&
        String(input.config.deploymentUrl ?? '').trim() &&
        (String(input.config.adminKey ?? '').trim() ||
          input.redactedSecretFields.includes('adminKey')),
    )
  },
  getFormProps({ redactedSecretFields }) {
    return { redactedSecretFields }
  },
})
