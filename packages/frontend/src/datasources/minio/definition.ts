import ConfigForm from '@/datasources/minio/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'
import {
  canSubmitTransportConfig,
  createDefaultSshTunnelConfig,
  createDefaultTlsConfig,
  getTransportSecretFields,
} from '@/datasources/shared/transport'

export const minioDataSourceDefinition = defineDataSourceDefinition({
  type: 'minio',
  kind: 'objectStorage',
  label: 'MinIO',
  icon: 'bucket',
  capabilities: {
    sqlQuery: false,
    tableBrowser: false,
    dataEditor: false,
    schemaEditor: false,
    resourceBrowser: true,
  },
  formComponent: ConfigForm,
  transportSupport: {
    ssh: true,
    tls: true,
  },
  secretFields: ['secretKey', 'sessionToken', ...getTransportSecretFields({ ssh: true, tls: true })],
  createDefaultConfig() {
    return {
      endPoint: '127.0.0.1',
      port: 9000,
      pathStyle: true,
      accessKey: '',
      secretKey: '',
      sessionToken: '',
      region: '',
      bucket: '',
      tls: createDefaultTlsConfig(),
      ssh: createDefaultSshTunnelConfig(),
    }
  },
  canSubmit(input) {
    return (
      Boolean(
        input.name.trim() &&
          String(input.config.endPoint ?? '').trim() &&
          Number(input.config.port ?? 0) > 0 &&
          String(input.config.accessKey ?? '').trim() &&
          (String(input.config.secretKey ?? '').trim() || input.redactedSecretFields.includes('secretKey')),
      ) &&
      canSubmitTransportConfig({
        config: input.config,
        redactedSecretFields: input.redactedSecretFields,
      })
    )
  },
  getFormProps({ redactedSecretFields }) {
    return { redactedSecretFields }
  },
})
