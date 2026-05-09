import ConfigForm from '@/datasources/redis/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'
import {
  canSubmitTransportConfig,
  createDefaultSshTunnelConfig,
  createDefaultTlsConfig,
  getTransportSecretFields,
} from '@/datasources/shared/transport'

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
  transportSupport: {
    ssh: true,
    tls: true,
  },
  secretFields: ['password', ...getTransportSecretFields({ ssh: true, tls: true })],
  createDefaultConfig() {
    return {
      host: '127.0.0.1',
      port: 6379,
      username: '',
      password: '',
      database: 0,
      tls: createDefaultTlsConfig(),
      ssh: createDefaultSshTunnelConfig(),
    }
  },
  canSubmit(input) {
    return (
      Boolean(
        input.name.trim() &&
          String(input.config.host ?? '').trim() &&
          Number(input.config.port ?? 0) > 0,
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
