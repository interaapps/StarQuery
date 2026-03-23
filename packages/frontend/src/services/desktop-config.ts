import type { ServerProfile } from '@/types/workspace'

const STORAGE_KEY = 'starquery-workspace'

export type DesktopWorkspaceConfig = {
  servers: ServerProfile[]
  currentServerId?: string
  currentProjectId?: string
}

export function isElectronDesktop() {
  return typeof window !== 'undefined' && window.starqueryDesktop?.isElectron === true
}

function toServerProfile(value: unknown): ServerProfile | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.url !== 'string' ||
    (candidate.kind !== 'local' && candidate.kind !== 'remote')
  ) {
    return null
  }

  return {
    id: candidate.id,
    name: candidate.name,
    url: candidate.url,
    kind: candidate.kind,
  }
}

function normalizeDesktopWorkspaceConfig(config: unknown): DesktopWorkspaceConfig {
  const candidate = config && typeof config === 'object' ? (config as Record<string, unknown>) : {}

  return {
    servers: Array.isArray(candidate.servers)
      ? candidate.servers
          .map((server) => toServerProfile(server))
          .filter((server): server is ServerProfile => server !== null)
      : [],
    currentServerId: typeof candidate.currentServerId === 'string' ? candidate.currentServerId : undefined,
    currentProjectId: typeof candidate.currentProjectId === 'string' ? candidate.currentProjectId : undefined,
  }
}

function readBrowserConfig(): DesktopWorkspaceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeDesktopWorkspaceConfig(JSON.parse(raw)) : { servers: [] }
  } catch {
    return { servers: [] }
  }
}

function writeBrowserConfig(config: DesktopWorkspaceConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeDesktopWorkspaceConfig(config)))
}

export async function loadDesktopWorkspaceConfig(): Promise<DesktopWorkspaceConfig> {
  if (isElectronDesktop()) {
    const desktop = window.starqueryDesktop
    if (!desktop) {
      return { servers: [] }
    }

    return normalizeDesktopWorkspaceConfig(await desktop.getConfig())
  }

  return readBrowserConfig()
}

export async function saveDesktopWorkspaceConfig(config: DesktopWorkspaceConfig) {
  if (isElectronDesktop()) {
    const desktop = window.starqueryDesktop
    if (!desktop) {
      return
    }

    await desktop.setConfig(normalizeDesktopWorkspaceConfig(config) as unknown as Record<string, unknown>)
    return
  }

  writeBrowserConfig(config)
}

export async function getElectronLocalServerUrl() {
  if (!isElectronDesktop()) {
    return null
  }

  return (await window.starqueryDesktop?.getLocalServerUrl()) ?? null
}

export async function pickSqliteFile() {
  if (!isElectronDesktop()) {
    return null
  }

  return (await window.starqueryDesktop?.pickSqliteFile()) ?? null
}
