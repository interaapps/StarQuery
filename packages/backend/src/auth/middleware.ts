import type { NextFunction, Response } from 'express'
import type { AppContext } from '../app-context.ts'
import { adminPermissionTargets, hasAnyPermission } from './permissions.ts'
import type { AuthenticatedRequest } from './request.ts'
import type { AuthPrincipal, AuthStatusPayload } from './types.ts'
import { hashAuthToken } from './tokens.ts'

function createAnonymousPrincipal(): AuthPrincipal {
  return {
    kind: 'anonymous',
    user: null,
    roles: [],
    permissions: [],
    token: null,
  }
}

function createLocalPrincipal(): AuthPrincipal {
  return {
    kind: 'local',
    user: null,
    roles: [],
    permissions: ['*'],
    token: null,
  }
}

function getBearerToken(req: AuthenticatedRequest) {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim()
}

export async function buildAuthStatus(context: AppContext): Promise<AuthStatusPayload> {
  return {
    enabled: context.config.auth.enabled,
    onboardingRequired: context.config.auth.enabled ? (await context.metaStore.countUsers()) === 0 : false,
    openIdEnabled: Boolean(context.config.auth.openId),
  }
}

export async function authenticateRequest(context: AppContext, req: AuthenticatedRequest) {
  if (!context.config.auth.enabled) {
    req.auth = createLocalPrincipal()
    return req.auth
  }

  const rawToken = getBearerToken(req)
  if (!rawToken) {
    req.auth = createAnonymousPrincipal()
    return req.auth
  }

  const tokenRecord = await context.metaStore.getAuthTokenByHash(hashAuthToken(rawToken))
  if (!tokenRecord) {
    req.auth = createAnonymousPrincipal()
    return req.auth
  }

  if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
    await context.metaStore.deleteAuthToken(tokenRecord.id)
    req.auth = createAnonymousPrincipal()
    return req.auth
  }

  const user = await context.metaStore.getUserWithRoles(tokenRecord.userId)
  if (!user || user.disabled) {
    req.auth = createAnonymousPrincipal()
    return req.auth
  }

  await context.metaStore.updateAuthTokenLastUsed(tokenRecord.id)

  req.auth = {
    kind: tokenRecord.kind,
    user,
    roles: user.roles,
    permissions: Array.from(new Set([...user.permissions, ...user.roles.flatMap((role) => role.permissions)])),
    token: tokenRecord,
  }

  return req.auth
}

export function attachAuth(context: AppContext) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      await authenticateRequest(context, req)
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function getRequestAuth(req: AuthenticatedRequest) {
  return req.auth ?? createAnonymousPrincipal()
}

export function requireAuthenticated(req: AuthenticatedRequest, res: Response) {
  const auth = getRequestAuth(req)
  if (auth.kind === 'anonymous') {
    res.status(401).json({ error: 'Authentication required' })
    return false
  }

  return true
}

export function requirePermission(req: AuthenticatedRequest, res: Response, requiredPermissions: string[]) {
  const auth = getRequestAuth(req)
  if (auth.kind === 'anonymous') {
    res.status(401).json({ error: 'Authentication required' })
    return false
  }

  if (!hasAnyPermission(auth.permissions, requiredPermissions)) {
    res.status(403).json({ error: 'Forbidden', requiredPermissions })
    return false
  }

  return true
}

export function requireAdminAccess(req: AuthenticatedRequest, res: Response) {
  return requirePermission(req, res, adminPermissionTargets('access', 'read'))
}
