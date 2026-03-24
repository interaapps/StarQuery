import * as client from 'openid-client'
import type { AppConfig } from '../config/app-config.ts'

let cachedConfiguration: client.Configuration | null = null

export async function getOpenIdConfiguration(config: AppConfig) {
  if (!config.auth.openId) {
    return null
  }

  if (cachedConfiguration) {
    return cachedConfiguration
  }

  cachedConfiguration = await client.discovery(
    new URL(config.auth.openId.issuer),
    config.auth.openId.clientId,
    config.auth.openId.clientSecret || undefined,
  )

  return cachedConfiguration
}

export {
  client,
}
