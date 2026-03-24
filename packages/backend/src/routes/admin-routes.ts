import type { Express } from 'express'
import type { AppContext } from '../app-context.ts'
import { adminPermissionTargets, hasAnyPermission } from '../auth/permissions.ts'
import { createPasswordHash } from '../auth/passwords.ts'
import type { AuthenticatedRequest } from '../auth/request.ts'
import { serializeAuthToken, serializeRole, serializeUser } from '../auth/serializers.ts'
import { requireAdminAccess, requirePermission } from '../auth/middleware.ts'
import { createRawAuthToken } from '../auth/tokens.ts'
import type { RoleRecord, UserWithRolesRecord } from '../meta/types.ts'
import { sanitizeDataSourceRecord } from './data-source-secrets.ts'

function userHasAdminAccess(user: UserWithRolesRecord, rolesOverride = user.roles, permissionsOverride = user.permissions) {
  return hasAnyPermission(
    Array.from(new Set([...permissionsOverride, ...rolesOverride.flatMap((role) => role.permissions)])),
    adminPermissionTargets('access', 'read'),
  )
}

async function listUsersWithRoles(context: AppContext) {
  const users = await context.metaStore.listUsers()
  return (await Promise.all(users.map((user) => context.metaStore.getUserWithRoles(user.id)))).filter(
    (user): user is UserWithRolesRecord => Boolean(user),
  )
}

function assertAdminUserRemains(users: UserWithRolesRecord[]) {
  const remainingAdmins = users.filter((user) => !user.disabled && userHasAdminAccess(user))
  if (remainingAdmins.length === 0) {
    throw new Error('At least one enabled admin user must remain')
  }
}

export function registerAdminRoutes(app: Express, context: AppContext) {
  app.get('/api/admin/bootstrap', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requireAdminAccess(authReq, res)) return

    const [users, roles, projects] = await Promise.all([
      context.metaStore.listUsers(),
      context.metaStore.listRoles(),
      context.metaStore.listProjects(),
    ])

    const usersWithRoles = await Promise.all(users.map((user) => context.metaStore.getUserWithRoles(user.id)))
    const allSources = await Promise.all(projects.map((project) => context.metaStore.listDataSources(project.id)))
    const apiKeys = await Promise.all(users.map((user) => context.metaStore.listAuthTokens(user.id, 'api_key')))

    res.json({
      users: usersWithRoles.filter(Boolean).map((user) => serializeUser(user!)),
      roles: roles.map((role) => serializeRole(role)),
      projects,
      dataSources: allSources.flat().map(sanitizeDataSourceRecord),
      apiKeys: apiKeys.flat().map((token) => serializeAuthToken(token)),
    })
  })

  app.post('/api/admin/roles', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requirePermission(authReq, res, adminPermissionTargets('roles', 'write'))) return

    const { name, slug, description, permissions } = req.body as {
      name?: string
      slug?: string
      description?: string | null
      permissions?: string[]
    }

    if (!name?.trim()) {
      res.status(400).json({ error: 'Role name is required' })
      return
    }

    const role = await context.metaStore.createRole({
      name,
      slug,
      description: description ?? null,
      permissions: Array.isArray(permissions) ? permissions : [],
    })

    res.status(201).json(serializeRole(role))
  })

  app.put('/api/admin/roles/:roleId', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requirePermission(authReq, res, adminPermissionTargets('roles', 'write'))) return

    const role = await context.metaStore.updateRole(req.params.roleId, {
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description,
      permissions: Array.isArray(req.body.permissions) ? req.body.permissions : [],
    })

    res.json(serializeRole(role))
  })

  app.delete('/api/admin/roles/:roleId', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requirePermission(authReq, res, adminPermissionTargets('roles', 'write'))) return

    const users = await listUsersWithRoles(context)
    const nextUsers = users.map((user) => ({
      ...user,
      roleIds: user.roleIds.filter((roleId) => roleId !== req.params.roleId),
      roles: user.roles.filter((role) => role.id !== req.params.roleId),
    }))

    try {
      assertAdminUserRemains(nextUsers)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'The role could not be removed' })
      return
    }

    await context.metaStore.deleteRole(req.params.roleId)
    res.json({ ok: true })
  })

  app.post('/api/admin/users', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requirePermission(authReq, res, adminPermissionTargets('users', 'write'))) return

    const { email, name, password, permissions, roleIds } = req.body as {
      email?: string
      name?: string
      password?: string
      permissions?: string[]
      roleIds?: string[]
    }

    if (!email?.trim() || !name?.trim() || !password || password.length < 8) {
      res.status(400).json({ error: 'email, name, and a password with at least 8 characters are required' })
      return
    }

    const passwordResult = createPasswordHash(password)
    const user = await context.metaStore.createUser({
      email,
      name,
      passwordHash: passwordResult.hash,
      passwordSalt: passwordResult.salt,
      permissions: Array.isArray(permissions) ? permissions : [],
    })

    await context.metaStore.setUserRoleIds(user.id, Array.isArray(roleIds) ? roleIds : [])
    const created = await context.metaStore.getUserWithRoles(user.id)
    res.status(201).json(created ? serializeUser(created) : null)
  })

  app.put('/api/admin/users/:userId', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requirePermission(authReq, res, adminPermissionTargets('users', 'write'))) return

    const { email, name, password, permissions, roleIds, disabled } = req.body as {
      email?: string
      name?: string
      password?: string
      permissions?: string[]
      roleIds?: string[]
      disabled?: boolean
    }

    const passwordPatch =
      password && password.length >= 8
        ? createPasswordHash(password)
        : null

    const currentUser = await context.metaStore.getUserWithRoles(req.params.userId)
    if (!currentUser) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    if (Array.isArray(roleIds) || permissions !== undefined || disabled !== undefined) {
      const allRoles = await context.metaStore.listRoles()
      const nextRoleIds = Array.isArray(roleIds) ? roleIds : currentUser.roleIds
      const nextRoles = nextRoleIds
        .map((roleId) => allRoles.find((role) => role.id === roleId))
        .filter((role): role is RoleRecord => Boolean(role))
      const nextPermissions = Array.isArray(permissions) ? permissions : currentUser.permissions
      const nextDisabled = disabled ?? currentUser.disabled

      const users = await listUsersWithRoles(context)
      const nextUsers = users.map((user) =>
        user.id !== currentUser.id
          ? user
          : {
              ...user,
              permissions: nextPermissions,
              disabled: nextDisabled,
              roleIds: nextRoleIds,
              roles: nextRoles,
            },
      )

      try {
        assertAdminUserRemains(nextUsers)
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'The user could not be updated' })
        return
      }
    }

    const user = await context.metaStore.updateUser(req.params.userId, {
      ...(email !== undefined ? { email } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(permissions !== undefined ? { permissions } : {}),
      ...(disabled !== undefined ? { disabled } : {}),
      ...(passwordPatch
        ? {
            passwordHash: passwordPatch.hash,
            passwordSalt: passwordPatch.salt,
          }
        : {}),
    })

    if (Array.isArray(roleIds)) {
      await context.metaStore.setUserRoleIds(user.id, roleIds)
    }

    const updated = await context.metaStore.getUserWithRoles(user.id)
    res.json(updated ? serializeUser(updated) : null)
  })

  app.delete('/api/admin/users/:userId', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requirePermission(authReq, res, adminPermissionTargets('users', 'write'))) return

    const users = await listUsersWithRoles(context)
    const nextUsers = users.filter((user) => user.id !== req.params.userId)

    try {
      assertAdminUserRemains(nextUsers)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'The user could not be removed' })
      return
    }

    await context.metaStore.deleteUser(req.params.userId)
    res.json({ ok: true })
  })

  app.post('/api/admin/users/:userId/api-keys', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requirePermission(authReq, res, adminPermissionTargets('apiKeys', 'write'))) return

    const { name, expiresInDays } = req.body as {
      name?: string
      expiresInDays?: number
    }

    if (!name?.trim()) {
      res.status(400).json({ error: 'API key name is required' })
      return
    }

    const token = createRawAuthToken()
    const expiryDays =
      typeof expiresInDays === 'number' && Number.isFinite(expiresInDays)
        ? expiresInDays
        : context.config.auth.apiKeyTtlDays
    const expiresAt =
      expiryDays > 0
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : null

    const record = await context.metaStore.createAuthToken({
      userId: req.params.userId,
      kind: 'api_key',
      name: name.trim(),
      tokenPrefix: token.prefix,
      tokenHash: token.hash,
      storage: 'api',
      expiresAt,
    })

    res.status(201).json({
      ...serializeAuthToken(record),
      token: token.raw,
    })
  })

  app.delete('/api/admin/api-keys/:tokenId', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requirePermission(authReq, res, adminPermissionTargets('apiKeys', 'write'))) return

    await context.metaStore.deleteAuthToken(req.params.tokenId)
    res.json({ ok: true })
  })
}
