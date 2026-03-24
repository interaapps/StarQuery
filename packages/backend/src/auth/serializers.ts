import type { AuthTokenRecord, RoleRecord, UserWithRolesRecord } from '../meta/types.ts'

export function serializeRole(role: RoleRecord) {
  return {
    id: role.id,
    slug: role.slug,
    name: role.name,
    description: role.description,
    permissions: role.permissions,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }
}

export function serializeUser(user: UserWithRolesRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    authProvider: user.authProvider,
    externalSubject: user.externalSubject,
    disabled: user.disabled,
    permissions: user.permissions,
    roleIds: user.roleIds,
    roles: user.roles.map((role) => serializeRole(role)),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export function serializeAuthToken(token: AuthTokenRecord) {
  return {
    id: token.id,
    userId: token.userId,
    kind: token.kind,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    storage: token.storage,
    expiresAt: token.expiresAt,
    lastUsedAt: token.lastUsedAt,
    createdAt: token.createdAt,
  }
}
