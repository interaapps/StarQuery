import type { Component } from 'vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'
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
    secretFields: ['password'],
    createDefaultConfig() {
      return {
        host: input.defaultHost ?? '127.0.0.1',
        port: input.defaultPort,
        user: '',
        password: '',
        database: input.defaultDatabase ?? '',
        ...(input.showSchema ? { schema: input.defaultSchema ?? '' } : {}),
        ...(input.showSsl ? { ssl: false } : {}),
      }
    },
    canSubmit(inputState) {
      return Boolean(
        inputState.name.trim() &&
          String(inputState.config.host ?? '').trim() &&
          Number(inputState.config.port ?? 0) > 0 &&
          (input.optionalUser || String(inputState.config.user ?? '').trim()) &&
          (input.optionalDatabase || String(inputState.config.database ?? '').trim()) &&
          (input.optionalPassword ||
            String(inputState.config.password ?? '').trim() ||
            inputState.redactedSecretFields.includes('password')),
      )
    },
    getFormProps({ redactedSecretFields }) {
      return {
        redactedSecretFields,
      }
    },
  })
}
