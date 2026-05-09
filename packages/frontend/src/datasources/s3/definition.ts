import ConfigForm from '@/datasources/s3/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'
import {
  canSubmitTransportConfig,
  createDefaultSshTunnelConfig,
  createDefaultTlsConfig,
  getTransportSecretFields,
} from '@/datasources/shared/transport'

export const s3DataSourceDefinition = defineDataSourceDefinition({
  type: 's3',
  kind: 'objectStorage',
  label: 'S3',
  icon: 'cloud',
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
      endPoint: 's3.amazonaws.com',
      port: 443,
      pathStyle: false,
      accessKey: '',
      secretKey: '',
      sessionToken: '',
      region: 'eu-central-1',
      bucket: '',
      tls: {
        ...createDefaultTlsConfig(),
        mode: 'require',
      },
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
