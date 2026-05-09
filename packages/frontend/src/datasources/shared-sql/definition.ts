import type { Component } from 'vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'
import {
  canSubmitTransportConfig,
  createDefaultSshTunnelConfig,
  createDefaultTlsConfig,
  getTransportSecretFields,
} from '@/datasources/shared/transport'
import type { DataSourceType } from '@/types/datasources'

export function createNetworkSqlDataSourceDefinition(input: {
  type: DataSourceType
  label: string
  icon: string
  formComponent: Component
  defaultPort: number
  defaultHost?: string
  localOnly?: boolean
  capabilities: {
    sqlQuery: boolean
    tableBrowser: boolean
    dataEditor: boolean
    schemaEditor: boolean
    tableCreate?: boolean
    resourceBrowser: boolean
  }
  optionalUser?: boolean
  optionalPassword?: boolean
  optionalDatabase?: boolean
  showSchema?: boolean
  showSsl?: boolean
  showSsh?: boolean
  defaultDatabase?: string
  defaultSchema?: string
}) {
  return defineDataSourceDefinition({
    type: input.type,
    kind: 'sql',
    label: input.label,
    icon: input.icon,
    localOnly: input.localOnly,
    capabilities: input.capabilities,
    formComponent: input.formComponent,
    transportSupport: {
      ssh: input.showSsh ?? true,
      tls: input.showSsl ?? false,
    },
    secretFields: [
      'password',
      ...getTransportSecretFields({
        ssh: input.showSsh ?? true,
        tls: input.showSsl ?? false,
      }),
    ],
    createDefaultConfig() {
      return {
        host: input.defaultHost ?? '127.0.0.1',
        port: input.defaultPort,
        user: '',
        password: '',
        database: input.defaultDatabase ?? '',
        ...(input.showSchema ? { schema: input.defaultSchema ?? '' } : {}),
        ...((input.showSsh ?? true) ? { ssh: createDefaultSshTunnelConfig() } : {}),
        ...(input.showSsl ? { tls: createDefaultTlsConfig() } : {}),
      }
    },
    canSubmit(inputState) {
      return (
        Boolean(
        inputState.name.trim() &&
          String(inputState.config.host ?? '').trim() &&
          Number(inputState.config.port ?? 0) > 0 &&
          (input.optionalUser || String(inputState.config.user ?? '').trim()) &&
          (input.optionalDatabase || String(inputState.config.database ?? '').trim()) &&
          (input.optionalPassword ||
            String(inputState.config.password ?? '').trim() ||
            inputState.redactedSecretFields.includes('password')),
        ) &&
        canSubmitTransportConfig({
          config: inputState.config,
          redactedSecretFields: inputState.redactedSecretFields,
        })
      )
    },
    getFormProps({ redactedSecretFields }) {
      return {
        redactedSecretFields,
        showTls: input.showSsl,
        showSsh: input.showSsh ?? true,
      }
    },
  })
}
