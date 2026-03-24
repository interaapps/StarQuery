import type { DataSourceType } from '../datasources/types.ts'

export type AuthProvider = 'local' | 'openid'

export type ProjectRecord = {
  id: string
  slug: string
  name: string
  description: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export type DataSourceRecord = {
  id: string
  projectId: string
  name: string
  type: DataSourceType
  config: Record<string, unknown>
  position: number
  createdAt: string
  updatedAt: string
}

export type RoleRecord = {
  id: string
  slug: string
  name: string
  description: string | null
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export type UserRecord = {
  id: string
  email: string
  name: string
  authProvider: AuthProvider
  externalSubject: string | null
  passwordHash: string | null
  passwordSalt: string | null
  permissions: string[]
  disabled: boolean
  createdAt: string
  updatedAt: string
}

export type UserWithRolesRecord = UserRecord & {
  roleIds: string[]
  roles: RoleRecord[]
}

export type AuthTokenRecord = {
  id: string
  userId: string
  kind: 'session' | 'api_key'
  name: string
  tokenPrefix: string
  tokenHash: string
  storage: 'local' | 'session' | 'api'
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export type OidcStateRecord = {
  id: string
  state: string
  nonce: string
  codeVerifier: string
  returnTo: string
  storage: 'local' | 'session'
  createdAt: string
}

export type BootstrapConfig = {
  users?: Array<{
    email: string
    name: string
    password?: string
    permissions?: string[]
    roles?: string[]
  }>
  projects?: Array<{
    slug?: string
    name: string
    description?: string
    dataSources?: Array<{
      name: string
      type: DataSourceType
      position?: number
      config: Record<string, unknown>
    }>
  }>
}
