/// <reference types="vite/client" />

declare global {
  interface Window {
    starqueryDesktop?: {
      isElectron: boolean
      getConfig: () => Promise<Record<string, unknown>>
      setConfig: (config: Record<string, unknown>) => Promise<{ ok: boolean }>
      getLocalServerUrl: () => Promise<string | null>
      pickSqliteFile: () => Promise<string | null>
    }
  }
}

export {}
