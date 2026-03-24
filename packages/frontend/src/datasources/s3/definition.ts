import ConfigForm from '@/datasources/s3/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'

export const s3DataSourceDefinition = defineDataSourceDefinition({
  type: 's3',
  kind: 'objectStorage',
  label: 'S3',
  icon: 'cloud',
  capabilities: {
    sqlQuery: false,
    tableBrowser: false,
    schemaEditor: false,
    resourceBrowser: true,
  },
  formComponent: ConfigForm,
  secretFields: ['secretKey', 'sessionToken'],
  createDefaultConfig() {
    return {
      endPoint: 's3.amazonaws.com',
      port: 443,
      useSSL: true,
      pathStyle: false,
      accessKey: '',
      secretKey: '',
      sessionToken: '',
      region: 'eu-central-1',
      bucket: '',
    }
  },
  canSubmit(input) {
    return Boolean(
      input.name.trim() &&
        String(input.config.endPoint ?? '').trim() &&
        Number(input.config.port ?? 0) > 0 &&
        String(input.config.accessKey ?? '').trim() &&
        (String(input.config.secretKey ?? '').trim() || input.redactedSecretFields.includes('secretKey')),
    )
  },
  getFormProps({ redactedSecretFields }) {
    return { redactedSecretFields }
  },
})
