import type { DataSourceType } from '@/types/sql'

export type ServerProfile = {
  id: string
  name: string
  url: string
  kind: 'local' | 'remote'
}

export type ServerInfo = {
  name: string
  mode: 'local' | 'hosted'
  capabilities: {
    projects: boolean
    dataSources: DataSourceType[]
  }
}

export type ProjectRecord = {
  id: string
  slug: string
  name: string
  description: string | null
  position: number
}

export type DataSourceRecord = {
  id: string
  projectId: string
  name: string
  type: DataSourceType
  config: Record<string, unknown>
  position: number
}
