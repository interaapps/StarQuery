import ConfigForm from '@/datasources/elasticsearch/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'
import {
  canSubmitTransportConfig,
  createDefaultSshTunnelConfig,
  createDefaultTlsConfig,
  getTransportSecretFields,
} from '@/datasources/shared/transport'

export const elasticsearchDataSourceDefinition = defineDataSourceDefinition({
  type: 'elasticsearch',
  kind: 'search',
  label: 'Elasticsearch',
  icon: 'search',
  capabilities: {
    sqlQuery: false,
    tableBrowser: false,
    dataEditor: true,
    schemaEditor: false,
    resourceBrowser: true,
  },
  formComponent: ConfigForm,
  transportSupport: {
    ssh: true,
    tls: true,
  },
  secretFields: ['password', 'apiKey', ...getTransportSecretFields({ ssh: true, tls: true })],
  createDefaultConfig() {
    return {
      node: 'http://127.0.0.1:9200',
      username: '',
      password: '',
      apiKey: '',
      index: '',
      tls: createDefaultTlsConfig(),
      ssh: createDefaultSshTunnelConfig(),
    }
  },
  canSubmit(input) {
    const tlsMode =
      !!input.config.tls &&
      typeof input.config.tls === 'object' &&
      typeof (input.config.tls as Record<string, unknown>).mode === 'string'
        ? String((input.config.tls as Record<string, unknown>).mode)
        : 'disable'
    const tlsCompatible =
      tlsMode === 'disable' || /^https:\/\//i.test(String(input.config.node ?? '').trim())

    return (
      Boolean(
        input.name.trim() &&
          String(input.config.node ?? '').trim() &&
          tlsCompatible &&
          (String(input.config.apiKey ?? '').trim() ||
            String(input.config.password ?? '').trim() ||
            input.redactedSecretFields.includes('apiKey') ||
            input.redactedSecretFields.includes('password') ||
            !String(input.config.username ?? '').trim()),
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
