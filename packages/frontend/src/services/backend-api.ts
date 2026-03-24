import axios from 'axios'
import { getStoredAuthTokenForUrl } from '@/services/auth-storage'

export function normalizeServerUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

export function createBackendClient(baseUrl: string) {
  const normalizedBaseUrl = normalizeServerUrl(baseUrl)

  const client = axios.create({
    baseURL: normalizedBaseUrl,
  })

  client.interceptors.request.use((config) => {
    const token = getStoredAuthTokenForUrl(normalizedBaseUrl)
    if (token) {
      config.headers = config.headers ?? {}
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  })

  return client
}

export function buildWsUrl(baseUrl: string, path: string) {
  return `${normalizeServerUrl(baseUrl).replace(/^http/i, 'ws')}${path}`
}
