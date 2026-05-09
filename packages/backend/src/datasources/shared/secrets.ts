import type { DataSourceRecord } from '../../meta/types.ts'
import { getSecretFields } from '../registry.ts'
import { deleteValueAtPath, getValueAtPath, mergePlainObjects, setValueAtPath } from './object-path.ts'

export const REDACTED_PASSWORD = '__STARQUERY_REDACTED__'

export function sanitizeDataSourceRecord(source: DataSourceRecord): DataSourceRecord {
  const secretFields = getSecretFields(source.type)
  if (!secretFields.length) {
    return source
  }

  let nextConfig = source.config
  let changed = false

  for (const key of secretFields) {
    const secretValue = getValueAtPath(nextConfig, key)
    if (secretValue === undefined || secretValue === null || secretValue === '') {
      continue
    }

    nextConfig = setValueAtPath(nextConfig, key, REDACTED_PASSWORD)
    changed = true
  }

  return changed ? { ...source, config: nextConfig } : source
}

export function mergeDataSourceConfig(
  source: DataSourceRecord,
  nextType: DataSourceRecord['type'],
  configPatch?: Record<string, unknown>,
) {
  if (!configPatch) {
    return source.config
  }

  const currentConfig = source.config ?? {}
  let nextConfig = mergePlainObjects(currentConfig, configPatch)

  for (const key of getSecretFields(nextType)) {
    const patchValue = getValueAtPath(configPatch, key)
    if (patchValue === undefined || patchValue === REDACTED_PASSWORD) {
      const currentValue = getValueAtPath(currentConfig, key)
      if (currentValue === undefined) {
        nextConfig = deleteValueAtPath(nextConfig, key)
      } else {
        nextConfig = setValueAtPath(nextConfig, key, currentValue)
      }
    }
  }

  return nextConfig
}
