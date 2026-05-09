import ConfigForm from '@/datasources/mongodb/ConfigForm.vue'
import MongoDbSidebarResourceExtension from '@/datasources/mongodb/components/MongoDbSidebarResourceExtension.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'
import {
  canSubmitTransportConfig,
  createDefaultSshTunnelConfig,
  createDefaultTlsConfig,
  getTransportSecretFields,
} from '@/datasources/shared/transport'

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
  sidebarResourceExtensionComponent: MongoDbSidebarResourceExtension,
  transportSupport: {
    ssh: true,
    tls: true,
  },
  secretFields: ['password', ...getTransportSecretFields({ ssh: true, tls: true })],
  createDefaultConfig() {
    return {
      uri: '',
      host: '127.0.0.1',
      port: 27017,
      username: '',
      password: '',
      database: 'admin',
      authSource: '',
      tls: createDefaultTlsConfig(),
      ssh: createDefaultSshTunnelConfig(),
    }
  },
  canSubmit(input) {
    const sshEnabled =
      !!input.config.ssh &&
      typeof input.config.ssh === 'object' &&
      (input.config.ssh as Record<string, unknown>).enabled === true

    return (
      Boolean(
        input.name.trim() &&
          (String(input.config.uri ?? '').trim() ||
            (String(input.config.host ?? '').trim() && Number(input.config.port ?? 0) > 0)) &&
          !(String(input.config.uri ?? '').trim() && sshEnabled),
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
