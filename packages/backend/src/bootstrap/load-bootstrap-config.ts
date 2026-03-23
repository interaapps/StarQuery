import fs from 'node:fs'
import type { AppConfig } from '../config/app-config.ts'
import type { BootstrapConfig } from '../meta/types.ts'

export function loadBootstrapConfig(config: AppConfig): BootstrapConfig | null {
  if (!config.bootstrapConfigPath) {
    return null
  }

  if (!fs.existsSync(config.bootstrapConfigPath)) {
    throw new Error(`Bootstrap config was not found at ${config.bootstrapConfigPath}`)
  }

  return JSON.parse(fs.readFileSync(config.bootstrapConfigPath, 'utf-8')) as BootstrapConfig
}
