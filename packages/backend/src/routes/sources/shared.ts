import type { Response } from 'express'
import type { AppContext } from '../../app-context.ts'
import { dataSourcePermissionTargets, hasAnyPermission, projectPermissionTargets } from '../../auth/permissions.ts'
import type { AuthenticatedRequest } from '../../auth/request.ts'
import type { DataSourceRecord } from '../../meta/types.ts'

export async function requireProject(context: AppContext, projectId: string, res: Response) {
  const project = await context.metaStore.getProjectById(projectId)
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return null
  }

  return project
}

export async function requireSource(context: AppContext, projectId: string, sourceId: string, res: Response) {
  const source = await context.metaStore.getDataSource(sourceId)
  if (!source || source.projectId !== projectId) {
    res.status(404).json({ error: 'Datasource not found' })
    return null
  }

  return source
}

export function canViewSource(req: AuthenticatedRequest, projectId: string, sourceId: string) {
  return hasAnyPermission(req.auth.permissions, [
    ...dataSourcePermissionTargets(projectId, sourceId, 'view'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'query'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'manage', 'write'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'table.edit', 'write'),
    ...projectPermissionTargets(projectId, 'manage', 'write'),
  ])
}

function stripSqlComments(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*--.*$/gm, ' ')
}

export function isReadOnlySql(query: string) {
  const statements = stripSqlComments(query)
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

  if (!statements.length) {
    return true
  }

  return statements.every((statement) => {
    const normalized = statement.toLowerCase()
    return /^(select|show|describe|desc|explain|with|pragma)\b/.test(normalized)
  })
}

export function requireManagedSourcePermission(
  authReq: AuthenticatedRequest,
  res: Response,
  source: DataSourceRecord,
) {
  return hasAnyPermission(authReq.auth.permissions, [
    ...dataSourcePermissionTargets(source.projectId, source.id, 'manage', 'write'),
    ...projectPermissionTargets(source.projectId, 'manage', 'write'),
  ])
    ? true
    : (res.status(403).json({ error: 'Forbidden' }), false)
}
