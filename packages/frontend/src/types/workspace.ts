import type { DataSourceDefinition, DataSourceType } from '@/types/datasources'
import type { AuthStatus } from '@/types/auth'

export type ServerProfile = {
  id: string
  name: string
  url: string
  kind: 'local' | 'remote'
}

export type ServerInfo = {
  name: string
  mode: 'local' | 'hosted'
  auth: Pick<AuthStatus, 'enabled' | 'onboardingRequired' | 'openIdEnabled'>
  capabilities: {
    projects: boolean
    dataSources: Array<DataSourceDefinition | DataSourceType>
  }
}

export type ProjectRecord = {
  id: string
  slug: string
  name: string
  description: string | null
  position: number
}

export type ProjectUserAccess = 'none' | 'read' | 'write'

export type ProjectUserAccessRecord = {
  id: string
  email: string
  name: string
  authProvider: 'local' | 'openid'
  disabled: boolean
  permissions: string[]
  roleIds: string[]
  roles: Array<{
    id: string
    slug: string
    name: string
    permissions: string[]
  }>
  workspaceAccess: ProjectUserAccess
}

export type DataSourceRecord = {
  id: string
  projectId: string
  name: string
  type: DataSourceType
  config: Record<string, unknown>
  position: number
}
