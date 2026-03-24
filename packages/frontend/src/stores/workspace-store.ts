import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'
import { createBackendClient, normalizeServerUrl } from '@/services/backend-api'
import {
  getElectronLocalServerUrl,
  isElectronDesktop,
  loadDesktopWorkspaceConfig,
  saveDesktopWorkspaceConfig,
} from '@/services/desktop-config'
import type {
  DataSourceRecord,
  ProjectRecord,
  ProjectUserAccess,
  ProjectUserAccessRecord,
  ServerInfo,
  ServerProfile,
} from '@/types/workspace'

const DEFAULT_LOCAL_SERVER_URL = (import.meta.env.VITE_APP_BASE_URL as string) || 'http://127.0.0.1:3000'
const DEFAULT_HOSTED_SERVER_ID = 'hosted-default'
const LOCKED_SERVER_ID = 'locked-server'
const LOCAL_COMPUTER_SERVER_ID = 'local-computer'

function normalizeSelectedId(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const trimmedValue = value.trim()
  if (!trimmedValue || trimmedValue === 'undefined' || trimmedValue === 'null') {
    return null
  }

  return trimmedValue
}

function getLockedServerUrl() {
  const configuredUrl = import.meta.env.VITE_LOCKED_SERVER_URL as string | undefined
  if (!configuredUrl?.trim()) {
    return null
  }

  if (configuredUrl.trim() === '/') {
    if (typeof window === 'undefined' || !/^https?:$/i.test(window.location.protocol)) {
      return null
    }

    return normalizeServerUrl(window.location.origin)
  }

  return normalizeServerUrl(configuredUrl)
}

function getLockedServerName() {
  return (import.meta.env.VITE_LOCKED_SERVER_NAME as string | undefined)?.trim() || 'Configured Server'
}

function getDefaultHostedServerUrl() {
  const configuredUrl = import.meta.env.VITE_DEFAULT_SERVER_URL as string | undefined
  if (configuredUrl?.trim()) {
    return normalizeServerUrl(configuredUrl)
  }

  if (!import.meta.env.PROD || typeof window === 'undefined') {
    return null
  }

  if (!/^https?:$/i.test(window.location.protocol)) {
    return null
  }

  return normalizeServerUrl(window.location.origin)
}

async function createDefaultLocalServer(name = 'Local computer'): Promise<ServerProfile> {
  const localServerUrl = (await getElectronLocalServerUrl()) ?? DEFAULT_LOCAL_SERVER_URL

  return {
    id: LOCAL_COMPUTER_SERVER_ID,
    name,
    url: normalizeServerUrl(localServerUrl),
    kind: 'local',
  }
}

function createDefaultHostedServer(name = 'Hosted Server'): ServerProfile | null {
  const hostedServerUrl = getDefaultHostedServerUrl()
  if (!hostedServerUrl) {
    return null
  }

  return {
    id: DEFAULT_HOSTED_SERVER_ID,
    name,
    url: hostedServerUrl,
    kind: 'remote',
  }
}

function createLockedServer(): ServerProfile | null {
  const lockedServerUrl = getLockedServerUrl()
  if (!lockedServerUrl) {
    return null
  }

  return {
    id: LOCKED_SERVER_ID,
    name: getLockedServerName(),
    url: lockedServerUrl,
    kind: 'remote',
  }
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const hydrated = ref(false)
  const servers = ref<ServerProfile[]>([])
  const currentServerId = ref<string>('')
  const serverInfo = ref<ServerInfo | null>(null)
  const serverError = ref<string | null>(null)
  const projects = ref<ProjectRecord[]>([])
  const currentProjectId = ref<string | null>(null)
  const dataSources = ref<DataSourceRecord[]>([])

  const currentServer = computed(
    () => servers.value.find((server) => server.id === currentServerId.value) ?? servers.value[0] ?? null,
  )
  const currentProject = computed(
    () => projects.value.find((project) => project.id === currentProjectId.value) ?? null,
  )
  const lockedServer = computed(() => createLockedServer())
  const isServerSelectionLocked = computed(() => Boolean(lockedServer.value))
  const isBuiltInLocalServer = (server: ServerProfile | null | undefined) => {
    if (!server) {
      return false
    }

    return server.id === LOCAL_COMPUTER_SERVER_ID && server.kind === 'local'
  }

  const resolveCurrentServer = async () => {
    const server = currentServer.value
    if (!server) {
      throw new Error('No active server selected')
    }

    if (server.kind !== 'local' || !isElectronDesktop()) {
      return server
    }

    const localServerUrl = await getElectronLocalServerUrl()
    if (!localServerUrl) {
      throw new Error('The local StarQuery backend is unavailable. Please restart the Electron app.')
    }

    const normalizedLocalUrl = normalizeServerUrl(localServerUrl)
    if (server.url !== normalizedLocalUrl) {
      server.url = normalizedLocalUrl
      await persistServers()
    }

    return server
  }

  const getClient = async () => {
    const server = await resolveCurrentServer()
    return createBackendClient(server.url)
  }

  const persistServers = async () => {
    const persistedServers =
      isElectronDesktop()
        ? servers.value.filter((server) => !isBuiltInLocalServer(server))
        : servers.value

    await saveDesktopWorkspaceConfig({
      servers: persistedServers,
      currentServerId: normalizeSelectedId(currentServerId.value) ?? undefined,
      currentProjectId: normalizeSelectedId(currentProjectId.value) ?? undefined,
    })
  }

  const rethrowWorkspaceRouteError = (error: unknown, action: 'update' | 'delete') => {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error(
        action === 'delete'
          ? 'Workspace removal is not available on the currently running backend. Restart the Electron app or backend and try again.'
          : 'Workspace editing is not available on the currently running backend. Restart the Electron app or backend and try again.',
      )
    }

    throw error
  }

  const ensureDefaultServer = async () => {
    if (lockedServer.value) {
      servers.value = [lockedServer.value]
      currentServerId.value = lockedServer.value.id
      return
    }

    if (!isElectronDesktop()) {
      servers.value = servers.value.filter(
        (server) => server.kind !== 'local' && server.id !== LOCAL_COMPUTER_SERVER_ID,
      )
      const defaultHostedServer = createDefaultHostedServer()
      const existingHostedDefault = servers.value.find((server) => server.id === DEFAULT_HOSTED_SERVER_ID)

      if (defaultHostedServer) {
        if (!existingHostedDefault && servers.value.length === 0) {
          servers.value.unshift(defaultHostedServer)
        } else if (existingHostedDefault) {
          existingHostedDefault.url = defaultHostedServer.url
          existingHostedDefault.name = defaultHostedServer.name
        }
      }

      if (!servers.value.find((server) => server.id === currentServerId.value)) {
        currentServerId.value = servers.value[0]?.id ?? ''
      }

      currentServerId.value = normalizeSelectedId(currentServerId.value) ?? servers.value[0]?.id ?? ''
      return
    }

    const defaultLocalServer = await createDefaultLocalServer(
      servers.value.find((server) => server.id === LOCAL_COMPUTER_SERVER_ID)?.name ?? 'Local computer',
    )
    const remoteServers = servers.value.filter(
      (server) => server.kind === 'remote' && server.id !== LOCAL_COMPUTER_SERVER_ID,
    )
    servers.value = [defaultLocalServer, ...remoteServers]

    currentServerId.value = normalizeSelectedId(currentServerId.value) ?? servers.value[0]?.id ?? defaultLocalServer.id
  }

  const refreshServerInfo = async () => {
    serverInfo.value = (await (await getClient()).get('/api/server/info')).data
    serverError.value = null
    return serverInfo.value
  }

  const refreshProjects = async () => {
    projects.value = (await (await getClient()).get('/api/projects')).data
    currentProjectId.value = normalizeSelectedId(currentProjectId.value)

    if (!projects.value.find((project) => project.id === currentProjectId.value)) {
      currentProjectId.value = projects.value[0]?.id ?? null
      await persistServers()
    }

    return projects.value
  }

  const refreshDataSources = async () => {
    currentProjectId.value = normalizeSelectedId(currentProjectId.value)

    if (!currentProjectId.value) {
      dataSources.value = []
      return dataSources.value
    }

    dataSources.value = (
      await (await getClient()).get(`/api/projects/${currentProjectId.value}/sources`)
    ).data

    return dataSources.value
  }

  const hydrate = async () => {
    if (hydrated.value) return

    const config = await loadDesktopWorkspaceConfig()
    servers.value = config.servers ?? []
    currentServerId.value = normalizeSelectedId(config.currentServerId) ?? ''
    currentProjectId.value = normalizeSelectedId(config.currentProjectId)
    await ensureDefaultServer()
    hydrated.value = true

    await persistServers()
    await loadWorkspaceFromServer()
  }

  const loadWorkspaceFromServer = async () => {
    if (!currentServer.value) {
      serverInfo.value = null
      serverError.value = null
      projects.value = []
      currentProjectId.value = null
      dataSources.value = []
      return
    }

    try {
      await refreshServerInfo()
      await refreshProjects()
      await refreshDataSources()
      serverError.value = null
    } catch (error) {
      if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
        projects.value = []
        dataSources.value = []
        serverError.value = null
        return
      }

      serverInfo.value = null
      projects.value = []
      currentProjectId.value = null
      dataSources.value = []
      serverError.value =
        error instanceof Error ? error.message : 'The selected server is currently unreachable'
    }
  }

  const setCurrentServer = async (serverId: string) => {
    if (isServerSelectionLocked.value) {
      currentServerId.value = lockedServer.value?.id ?? currentServerId.value
      currentProjectId.value = normalizeSelectedId(currentProjectId.value)
      await persistServers()
      await loadWorkspaceFromServer()
      return
    }

    currentServerId.value = normalizeSelectedId(serverId) ?? ''
    currentProjectId.value = null
    dataSources.value = []
    await persistServers()
    await loadWorkspaceFromServer()
  }

  const setCurrentProject = async (projectId: string | null) => {
    currentProjectId.value = normalizeSelectedId(projectId)
    await persistServers()
    await refreshDataSources()
  }

  const addServer = async (server: Omit<ServerProfile, 'id'>) => {
    if (isServerSelectionLocked.value) {
      throw new Error('The server is locked by the frontend configuration')
    }

    if (server.kind === 'local') {
      throw new Error('Local computer is managed automatically by the Electron app')
    }

    const record: ServerProfile = {
      ...server,
      id: crypto.randomUUID(),
      url: normalizeServerUrl(server.url),
    }

    servers.value.push(record)
    await persistServers()
    await setCurrentServer(record.id)
    return record
  }

  const updateServer = async (
    serverId: string,
    patch: Pick<ServerProfile, 'name' | 'url' | 'kind'>,
  ) => {
    if (isServerSelectionLocked.value) {
      throw new Error('The server is locked by the frontend configuration')
    }

    const existing = servers.value.find((server) => server.id === serverId)
    if (!existing) {
      throw new Error('Server not found')
    }

    if (isBuiltInLocalServer(existing)) {
      throw new Error('Local computer is managed automatically by the Electron app')
    }

    if (patch.kind === 'local') {
      throw new Error('Local computer is managed automatically by the Electron app')
    } else {
      existing.name = patch.name.trim()
      existing.kind = 'remote'
      existing.url = normalizeServerUrl(patch.url)
    }

    await persistServers()

    if (currentServerId.value === serverId) {
      await loadWorkspaceFromServer()
    }

    return servers.value.find((server) => server.id === serverId) ?? null
  }

  const removeServer = async (serverId: string) => {
    if (isServerSelectionLocked.value) {
      throw new Error('The server is locked by the frontend configuration')
    }

    const existing = servers.value.find((server) => server.id === serverId)
    if (isBuiltInLocalServer(existing)) {
      throw new Error('Local computer cannot be removed')
    }

    if (servers.value.length === 1) {
      throw new Error('At least one server must remain configured')
    }

    servers.value = servers.value.filter((server) => server.id !== serverId)
    if (!servers.value.find((server) => server.id === currentServerId.value)) {
      currentServerId.value = servers.value[0]?.id ?? ''
    }

    await persistServers()
    await loadWorkspaceFromServer()
  }

  const createProject = async (payload: { name: string; slug?: string; description?: string }) => {
    const project = (
      await (await getClient()).post('/api/projects', {
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
      })
    ).data as ProjectRecord

    await refreshProjects()
    currentProjectId.value = project.id
    await persistServers()
    await refreshDataSources()
    return project
  }

  const updateProject = async (projectId: string, payload: { name: string; slug?: string; description?: string }) => {
    let project: ProjectRecord | null = null
    try {
      project = (
        await (await getClient()).put(`/api/projects/${projectId}`, {
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
        })
      ).data as ProjectRecord
    } catch (error) {
      rethrowWorkspaceRouteError(error, 'update')
    }

    if (!project) {
      throw new Error('The workspace could not be updated')
    }

    await refreshProjects()
    if (currentProjectId.value === project.id) {
      await refreshDataSources()
    }
    return project
  }

  const deleteProject = async (projectId: string) => {
    try {
      await (await getClient()).delete(`/api/projects/${projectId}`)
    } catch (error) {
      rethrowWorkspaceRouteError(error, 'delete')
    }

    if (currentProjectId.value === projectId) {
      currentProjectId.value = null
    }

    await refreshProjects()
    await refreshDataSources()
    await persistServers()
  }

  const listProjectUsers = async (projectId: string) => {
    return (await (await getClient()).get(`/api/projects/${projectId}/users`)).data as ProjectUserAccessRecord[]
  }

  const updateProjectUserAccess = async (projectId: string, userId: string, access: ProjectUserAccess) => {
    return (
      await (await getClient()).put(`/api/projects/${projectId}/users/${userId}`, {
        access,
      })
    ).data as ProjectUserAccessRecord
  }

  const createDataSource = async (payload: {
    name: string
    type: DataSourceRecord['type']
    config: Record<string, unknown>
  }) => {
    currentProjectId.value = normalizeSelectedId(currentProjectId.value)
    if (!currentProjectId.value) {
      throw new Error('No project selected')
    }

    const dataSource = (
      await (await getClient()).post(`/api/projects/${currentProjectId.value}/sources`, payload)
    ).data as DataSourceRecord

    await refreshDataSources()
    return dataSource
  }

  const updateDataSource = async (
    dataSourceId: string,
    payload: {
      name?: string
      type?: DataSourceRecord['type']
      config?: Record<string, unknown>
      position?: number
    },
  ) => {
    currentProjectId.value = normalizeSelectedId(currentProjectId.value)
    if (!currentProjectId.value) {
      throw new Error('No project selected')
    }

    const dataSource = (
      await (await getClient()).put(`/api/projects/${currentProjectId.value}/sources/${dataSourceId}`, payload)
    ).data as DataSourceRecord

    await refreshDataSources()
    return dataSource
  }

  const deleteDataSource = async (dataSourceId: string) => {
    currentProjectId.value = normalizeSelectedId(currentProjectId.value)
    if (!currentProjectId.value) {
      throw new Error('No project selected')
    }

    await (await getClient()).delete(`/api/projects/${currentProjectId.value}/sources/${dataSourceId}`)
    await refreshDataSources()
  }

  return {
    hydrated,
    servers,
    isServerSelectionLocked,
    currentServerId,
    currentServer,
    serverInfo,
    serverError,
    projects,
    currentProjectId,
    currentProject,
    isBuiltInLocalServer,
    dataSources,
    getClient,
    resolveCurrentServer,
    hydrate,
    refreshServerInfo,
    refreshProjects,
    refreshDataSources,
    loadWorkspaceFromServer,
    setCurrentServer,
    setCurrentProject,
    addServer,
    updateServer,
    removeServer,
    createProject,
    updateProject,
    deleteProject,
    listProjectUsers,
    updateProjectUserAccess,
    createDataSource,
    updateDataSource,
    deleteDataSource,
  }
})
