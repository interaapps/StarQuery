export type AuthUser = {
  id: string
  email: string
  name: string
  authProvider: 'local' | 'openid'
  permissions: string[]
  roleIds: string[]
  roles: Array<{
    id: string
    slug: string
    name: string
    permissions: string[]
  }>
}

export type AuthStatus = {
  enabled: boolean
  onboardingRequired: boolean
  openIdEnabled: boolean
  currentUser: AuthUser | null
}

export type AuthStorageMode = 'local' | 'session'

