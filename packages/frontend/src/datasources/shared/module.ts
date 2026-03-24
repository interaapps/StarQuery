import { markRaw, type Component } from 'vue'
import type { DataSourceDefinition, DataSourceType } from '@/types/datasources'
import type { DataSourceRecord } from '@/types/workspace'

export type DataSourceFormInput = {
  name: string
  config: Record<string, unknown>
  redactedSecretFields: string[]
}

export type DataSourceFormContext = {
  definition: DataSourceDefinition
  redactedSecretFields: string[]
  source?: DataSourceRecord | null
}

export type RegisteredDataSourceDefinition = DataSourceDefinition & {
  formComponent: Component
  secretFields: readonly string[]
  createDefaultConfig(): Record<string, unknown>
  canSubmit(input: DataSourceFormInput): boolean
  getFormProps?(context: DataSourceFormContext): Record<string, unknown>
}

export type DataSourceFormState = {
  name: string
  type: DataSourceType
  config: Record<string, unknown>
  redactedSecretFields: string[]
}

export function defineDataSourceDefinition(definition: RegisteredDataSourceDefinition): RegisteredDataSourceDefinition {
  return {
    ...definition,
    formComponent: markRaw(definition.formComponent),
  }
}
