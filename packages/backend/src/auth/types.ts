import type { AuthTokenRecord, RoleRecord, UserRecord } from '../meta/types.ts'

export type AuthPrincipal =
  | {
      kind: 'local'
      user: UserRecord | null
      roles: RoleRecord[]
      permissions: string[]
      token: null
    }
  | {
      kind: 'anonymous'
      user: null
      roles: []
      permissions: []
      token: null
    }
  | {
      kind: 'session' | 'api_key'
      user: UserRecord
      roles: RoleRecord[]
      permissions: string[]
      token: AuthTokenRecord
    }

export type AuthStatusPayload = {
  enabled: boolean
  onboardingRequired: boolean
  openIdEnabled: boolean
}

