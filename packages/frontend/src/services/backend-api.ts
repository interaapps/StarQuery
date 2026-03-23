import axios from 'axios'

export function normalizeServerUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

export function createBackendClient(baseUrl: string) {
  return axios.create({
    baseURL: normalizeServerUrl(baseUrl),
  })
}

export function buildWsUrl(baseUrl: string, path: string) {
  return `${normalizeServerUrl(baseUrl).replace(/^http/i, 'ws')}${path}`
}
