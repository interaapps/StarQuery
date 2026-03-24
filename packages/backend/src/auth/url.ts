import { URL } from 'node:url'
import type { AuthenticatedRequest } from './request.ts'
import type { AppConfig } from '../config/app-config.ts'

function normalizeBaseUrl(value: string) {
  const url = new URL(value)
  url.hash = ''
  url.search = ''
  return url.toString()
}

export function getAppBaseUrl(config: AppConfig, req: AuthenticatedRequest) {
  if (config.publicUrl) {
    return normalizeBaseUrl(config.publicUrl)
  }

  const host = req.get('host')
  if (!host) {
    throw new Error('Unable to resolve request host')
  }

  return `${req.protocol}://${host}`
}

export function resolveSafeReturnTo(config: AppConfig, req: AuthenticatedRequest, requestedReturnTo?: string | null) {
  const baseUrl = getAppBaseUrl(config, req)
  const fallback = new URL('/', baseUrl).toString()
  if (!requestedReturnTo?.trim()) {
    return fallback
  }

  const candidate = new URL(requestedReturnTo, baseUrl)
  const allowedOrigin = new URL(baseUrl).origin
  if (candidate.origin !== allowedOrigin) {
    throw new Error('returnTo must stay on the same origin as the current StarQuery server')
  }

  return candidate.toString()
}
