import type { DataSourceRecord, ProjectRecord } from '@/types/workspace'

export type AdminRoleRecord = {
  id: string
  slug: string
  name: string
  description: string | null
  permissions: string[]
  createdAt?: string
  updatedAt?: string
}

export type AdminUserRecord = {
  id: string
  email: string
  name: string
  authProvider: 'local' | 'openid'
  externalSubject?: string | null
  disabled: boolean
  permissions: string[]
  roleIds: string[]
  roles?: AdminRoleRecord[]
  createdAt?: string
  updatedAt?: string
}

export type AdminApiKeyRecord = {
  id: string
  userId: string
  kind: 'session' | 'api_key'
  name: string
  tokenPrefix: string
  storage: 'local' | 'session' | 'api'
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export type AdminBootstrapPayload = {
  users: AdminUserRecord[]
  roles: AdminRoleRecord[]
  projects: ProjectRecord[]
  dataSources: DataSourceRecord[]
  apiKeys: AdminApiKeyRecord[]
}

export type PermissionTemplate = {
  label: string
  value: string
}
