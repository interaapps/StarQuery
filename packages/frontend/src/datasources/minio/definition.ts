import ConfigForm from '@/datasources/minio/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'

export const minioDataSourceDefinition = defineDataSourceDefinition({
  type: 'minio',
  kind: 'objectStorage',
  label: 'MinIO',
  icon: 'bucket',
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
      endPoint: '127.0.0.1',
      port: 9000,
      useSSL: false,
      pathStyle: true,
      accessKey: '',
      secretKey: '',
      sessionToken: '',
      region: '',
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
