import type { Express } from 'express'
import type { AppContext } from '../app-context.ts'
import { serializeUser } from '../auth/serializers.ts'
import {
  adminPermissionTargets,
  dataSourceReadPermissionTargets,
  hasAnyPermission,
  projectPermissionTargets,
} from '../auth/permissions.ts'
import type { AuthenticatedRequest } from '../auth/request.ts'
import { requireAuthenticated, requirePermission } from '../auth/middleware.ts'
import { toSlug } from '../meta/utils.ts'
import { applyProjectUserAccess, getProjectUserAccess, type ProjectUserAccess } from './project-user-access.ts'
import { requireProject } from './sources/shared.ts'

function canViewProject(req: AuthenticatedRequest, projectId: string) {
  return hasAnyPermission(req.auth.permissions, [
    ...projectPermissionTargets(projectId, 'view'),
    ...projectPermissionTargets(projectId, 'manage'),
    ...projectPermissionTargets(projectId, 'users'),
    ...dataSourceReadPermissionTargets(projectId, '*'),
  ])
}

function canManageProjectUsers(req: AuthenticatedRequest, projectId: string) {
  return hasAnyPermission(req.auth.permissions, [
    ...projectPermissionTargets(projectId, 'users', 'write'),
    ...projectPermissionTargets(projectId, 'manage', 'write'),
    ...adminPermissionTargets('users', 'write'),
  ])
}

export function registerProjectRoutes(app: Express, context: AppContext) {
  app.get('/api/projects', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requireAuthenticated(authReq, res)) return

    const projects = await context.metaStore.listProjects()
    res.json(projects.filter((project) => canViewProject(authReq, project.id)))
  })

  app.post('/api/projects', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (
      !requirePermission(authReq, res, [
        'project.create:write',
        'project.create.*:write',
        'project.manage:write',
        'project.manage.*:write',
        '*',
      ])
    ) {
      return
    }

    const { name, slug, description } = req.body as {
      name?: string
      slug?: string
      description?: string | null
    }

    if (!name?.trim()) {
      res.status(400).json({ error: 'Project name is required' })
      return
    }

    const nextSlug = toSlug(slug?.trim() || name.trim())
    const existingProject = await context.metaStore.getProjectBySlug(nextSlug)
    if (existingProject) {
      res.status(409).json({ error: `A workspace with the slug "${nextSlug}" already exists` })
      return
    }

    const projects = await context.metaStore.listProjects()
    const project = await context.metaStore.createProject({
      name: name.trim(),
      slug: nextSlug,
      description: description?.trim() || null,
      position: projects.length,
    })

    res.status(201).json(project)
  })

  app.put('/api/projects/:projectId', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const existing = await context.metaStore.getProjectById(req.params.projectId)
    if (!existing) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    if (!requirePermission(authReq, res, projectPermissionTargets(existing.id, 'manage', 'write'))) {
      return
    }

    const { name, slug, description } = req.body as {
      name?: string
      slug?: string
      description?: string | null
    }

    if (!name?.trim()) {
      res.status(400).json({ error: 'Project name is required' })
      return
    }

    const nextSlug = toSlug(slug?.trim() || existing.slug)
    const conflictingProject = await context.metaStore.getProjectBySlug(nextSlug)
    if (conflictingProject && conflictingProject.id !== existing.id) {
      res.status(409).json({ error: `A workspace with the slug "${nextSlug}" already exists` })
      return
    }

    const project = await context.metaStore.updateProject(existing.id, {
      name: name.trim(),
      slug: nextSlug,
      description: description?.trim() || null,
    })

    res.json(project)
  })

  app.delete('/api/projects/:projectId', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const existing = await context.metaStore.getProjectById(req.params.projectId)
    if (!existing) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    if (!requirePermission(authReq, res, projectPermissionTargets(existing.id, 'manage', 'write'))) {
      return
    }

    await context.metaStore.deleteProject(existing.id)
    res.json({ ok: true })
  })

  app.get('/api/projects/:projectId/users', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requireAuthenticated(authReq, res)) return

    const project = await requireProject(context, req.params.projectId, res)
    if (!project) return

    if (!canManageProjectUsers(authReq, project.id)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const users = await context.metaStore.listUsers()
    const usersWithRoles = await Promise.all(users.map((user) => context.metaStore.getUserWithRoles(user.id)))
    res.json(
      usersWithRoles
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map((user) => ({
          ...serializeUser(user),
          workspaceAccess: getProjectUserAccess(
            Array.from(new Set([...user.permissions, ...user.roles.flatMap((role) => role.permissions)])),
            project.id,
          ),
        })),
    )
  })

  app.put('/api/projects/:projectId/users/:userId', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requireAuthenticated(authReq, res)) return

    const project = await requireProject(context, req.params.projectId, res)
    if (!project) return

    if (!canManageProjectUsers(authReq, project.id)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const user = await context.metaStore.getUserWithRoles(req.params.userId)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const access = (req.body?.access ?? 'none') as ProjectUserAccess
    if (!['none', 'read', 'write'].includes(access)) {
      res.status(400).json({ error: 'access must be one of none, read, or write' })
      return
    }

    const updated = await context.metaStore.updateUser(user.id, {
      permissions: applyProjectUserAccess(user.permissions, project.id, access),
    })
    const refreshed = await context.metaStore.getUserWithRoles(updated.id)

    res.json(
      refreshed
        ? {
            ...serializeUser(refreshed),
            workspaceAccess: getProjectUserAccess(
              Array.from(new Set([...refreshed.permissions, ...refreshed.roles.flatMap((role) => role.permissions)])),
              project.id,
            ),
          }
        : null,
    )
  })
}
