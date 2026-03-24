import { normalizeServerUrl } from '@/services/backend-api'
import type { AuthStorageMode } from '@/types/auth'

const AUTH_STORAGE_KEY = 'starquery-auth-tokens'

type AuthTokenMap = Record<string, string>

function safeRead(storage: Storage) {
  try {
    const raw = storage.getItem(AUTH_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as AuthTokenMap) : {}
  } catch {
    return {}
  }
}

function safeWrite(storage: Storage, value: AuthTokenMap) {
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value))
}

function getStorage(mode: AuthStorageMode) {
  return mode === 'session' ? sessionStorage : localStorage
}

export function getStoredAuthTokenForUrl(serverUrl: string) {
  if (typeof window === 'undefined') {
    return null
  }

  const key = normalizeServerUrl(serverUrl)
  return safeRead(localStorage)[key] ?? safeRead(sessionStorage)[key] ?? null
}

export function storeAuthTokenForUrl(serverUrl: string, token: string, mode: AuthStorageMode) {
  if (typeof window === 'undefined') {
    return
  }

  const key = normalizeServerUrl(serverUrl)
  const target = getStorage(mode)
  const current = safeRead(target)
  current[key] = token
  safeWrite(target, current)

  const other = getStorage(mode === 'local' ? 'session' : 'local')
  const otherCurrent = safeRead(other)
  delete otherCurrent[key]
  safeWrite(other, otherCurrent)
}

export function clearStoredAuthTokenForUrl(serverUrl: string) {
  if (typeof window === 'undefined') {
    return
  }

  const key = normalizeServerUrl(serverUrl)
  for (const storage of [localStorage, sessionStorage]) {
    const current = safeRead(storage)
    delete current[key]
    safeWrite(storage, current)
  }
}

export function consumeAuthCallbackFromHash() {
  if (typeof window === 'undefined') {
    return null
  }

  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.includes('authToken=')) {
    return null
  }

  const params = new URLSearchParams(hash)
  const token = params.get('authToken')
  const storage = params.get('storage') === 'session' ? 'session' : 'local'

  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)

  return token
    ? {
        token,
        storage: storage as AuthStorageMode,
      }
    : null
}

