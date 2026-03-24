import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createBackendClient, normalizeServerUrl } from '@/services/backend-api'
import { isElectronDesktop } from '@/services/desktop-config'
import { adminPermissionTargets, permissionPatternMatches } from '@/services/permissions'
import {
  clearStoredAuthTokenForUrl,
  consumeAuthCallbackFromHash,
  getStoredAuthTokenForUrl,
  storeAuthTokenForUrl,
} from '@/services/auth-storage'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { AuthStatus, AuthStorageMode, AuthUser } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const workspaceStore = useWorkspaceStore()
  const loading = ref(false)
  const status = ref<AuthStatus>({
    enabled: false,
    onboardingRequired: false,
    openIdEnabled: false,
    currentUser: null,
  })
  const preferredStorage = ref<AuthStorageMode>('local')

  const currentServerUrl = computed(() =>
    workspaceStore.currentServer?.url ? normalizeServerUrl(workspaceStore.currentServer.url) : null,
  )
  const currentUser = computed<AuthUser | null>(() => status.value.currentUser)
  const isAuthenticated = computed(() => Boolean(currentUser.value) || !status.value.enabled)
  const requiresLogin = computed(
    () => status.value.enabled && !status.value.onboardingRequired && !currentUser.value,
  )
  const requiresOnboarding = computed(
    () => status.value.enabled && status.value.onboardingRequired && !currentUser.value,
  )
  const canAccessAdmin = computed(() => hasPermission(adminPermissionTargets('access', 'read')))

  const getClient = () => {
    if (!currentServerUrl.value) {
      throw new Error('No server selected')
    }

    return createBackendClient(currentServerUrl.value)
  }

  const refreshStatus = async () => {
    if (!currentServerUrl.value) {
      status.value = {
        enabled: false,
        onboardingRequired: false,
        openIdEnabled: false,
        currentUser: null,
      }
      return status.value
    }

    if (isElectronDesktop() && workspaceStore.currentServer?.kind === 'local') {
      clearStoredAuthTokenForUrl(currentServerUrl.value)
      status.value = {
        enabled: false,
        onboardingRequired: false,
        openIdEnabled: false,
        currentUser: null,
      }
      return status.value
    }

    loading.value = true
    try {
      const response = await getClient().get('/api/auth/status')
      status.value = response.data as AuthStatus
      return status.value
    } finally {
      loading.value = false
    }
  }

  const consumeCallback = async () => {
    const callback = consumeAuthCallbackFromHash()
    if (!callback || !currentServerUrl.value) {
      return false
    }

    storeAuthTokenForUrl(currentServerUrl.value, callback.token, callback.storage)
    preferredStorage.value = callback.storage
    await refreshStatus()
    await workspaceStore.loadWorkspaceFromServer()
    return true
  }

  const login = async (payload: { email: string; password: string; storage: AuthStorageMode }) => {
    const response = await getClient().post('/api/auth/login', payload)
    if (currentServerUrl.value) {
      storeAuthTokenForUrl(currentServerUrl.value, response.data.token, payload.storage)
    }
    preferredStorage.value = payload.storage
    await refreshStatus()
    await workspaceStore.loadWorkspaceFromServer()
  }

  const onboard = async (payload: { email: string; name: string; password: string; storage: AuthStorageMode }) => {
    const response = await getClient().post('/api/auth/onboard', payload)
    if (currentServerUrl.value) {
      storeAuthTokenForUrl(currentServerUrl.value, response.data.token, payload.storage)
    }
    preferredStorage.value = payload.storage
    await refreshStatus()
    await workspaceStore.loadWorkspaceFromServer()
  }

  const logout = async () => {
    try {
      await getClient().post('/api/auth/logout')
    } catch {
      // ignore logout errors while clearing local auth state
    }

    if (currentServerUrl.value) {
      clearStoredAuthTokenForUrl(currentServerUrl.value)
    }
    await refreshStatus()
    await workspaceStore.loadWorkspaceFromServer()
  }

  const hasPermission = (requiredPermissions: string | string[]) => {
    if (!status.value.enabled) {
      return true
    }

    const permissions = currentUser.value?.permissions ?? []
    const list = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions]
    return list.some((permission) =>
      permissions.some((pattern) => permissionPatternMatches(pattern, permission)),
    )
  }

  const startOpenIdLogin = () => {
    if (!currentServerUrl.value) {
      throw new Error('No server selected')
    }

    const baseUrl = normalizeServerUrl(currentServerUrl.value)
    const returnTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}${window.location.search}`
        : '/'
    const url = new URL('/api/auth/openid/start', baseUrl)
    url.searchParams.set('storage', preferredStorage.value)
    url.searchParams.set('returnTo', returnTo)
    window.location.href = url.toString()
  }

  const hasStoredToken = computed(() =>
    currentServerUrl.value ? Boolean(getStoredAuthTokenForUrl(currentServerUrl.value)) : false,
  )

  return {
    loading,
    status,
    currentUser,
    isAuthenticated,
    requiresLogin,
    requiresOnboarding,
    preferredStorage,
    canAccessAdmin,
    hasStoredToken,
    refreshStatus,
    consumeCallback,
    login,
    onboard,
    logout,
    hasPermission,
    startOpenIdLogin,
  }
})
