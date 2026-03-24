import {
  dataSourcePermissionTargets,
  hasAnyPermission,
  projectDataSourcePermissionTargets,
  projectPermissionTargets,
} from '../auth/permissions.ts'

export type ProjectUserAccess = 'none' | 'read' | 'write'

function stripAccessSuffix(permission: string) {
  return permission.replace(/:(read|write)$/u, '')
}

function managedProjectPermissionBases(projectId: string) {
  return new Set([
    stripAccessSuffix(projectPermissionTargets(projectId, 'view', 'read').at(-1) ?? `project.view.${projectId}:read`),
    stripAccessSuffix(projectPermissionTargets(projectId, 'manage', 'write').at(-1) ?? `project.manage.${projectId}:write`),
    stripAccessSuffix(projectPermissionTargets(projectId, 'users', 'write').at(-1) ?? `project.users.${projectId}:write`),
    ...projectDataSourcePermissionTargets(projectId, '*', 'read').map((permission) => stripAccessSuffix(permission)),
    ...projectDataSourcePermissionTargets(projectId, '*', 'write').map((permission) => stripAccessSuffix(permission)),
    stripAccessSuffix(
      dataSourcePermissionTargets(projectId, '*', 'view', 'read').at(-1) ?? `datasource.view.${projectId}.*:read`,
    ),
    stripAccessSuffix(
      dataSourcePermissionTargets(projectId, '*', 'query', 'read').at(-1) ?? `datasource.query.${projectId}.*:read`,
    ),
    stripAccessSuffix(
      dataSourcePermissionTargets(projectId, '*', 'query', 'write').at(-1) ?? `datasource.query.${projectId}.*:write`,
    ),
    stripAccessSuffix(
      dataSourcePermissionTargets(projectId, '*', 'manage', 'write').at(-1) ?? `datasource.manage.${projectId}.*:write`,
    ),
    stripAccessSuffix(
      dataSourcePermissionTargets(projectId, '*', 'table.edit', 'write').at(-1) ??
        `datasource.table.edit.${projectId}.*:write`,
    ),
  ])
}

export function buildProjectAccessPermissions(projectId: string, access: Exclude<ProjectUserAccess, 'none'>) {
  const permissions = [
    ...projectPermissionTargets(projectId, 'view', 'read').slice(-1),
    ...projectDataSourcePermissionTargets(projectId, '*', 'read').slice(-1),
    ...dataSourcePermissionTargets(projectId, '*', 'view', 'read').slice(-1),
    ...dataSourcePermissionTargets(projectId, '*', 'query', 'read').slice(-1),
  ]

  if (access === 'write') {
    permissions.push(
      ...projectPermissionTargets(projectId, 'manage', 'write').slice(-1),
      ...projectPermissionTargets(projectId, 'users', 'write').slice(-1),
      ...projectDataSourcePermissionTargets(projectId, '*', 'write').slice(-1),
      ...dataSourcePermissionTargets(projectId, '*', 'query', 'write').slice(-1),
      ...dataSourcePermissionTargets(projectId, '*', 'manage', 'write').slice(-1),
      ...dataSourcePermissionTargets(projectId, '*', 'table.edit', 'write').slice(-1),
    )
  }

  return Array.from(new Set(permissions))
}

export function applyProjectUserAccess(
  permissions: string[],
  projectId: string,
  access: ProjectUserAccess,
) {
  const managedBases = managedProjectPermissionBases(projectId)
  const remainingPermissions = permissions.filter((permission) => !managedBases.has(stripAccessSuffix(permission)))

  if (access === 'none') {
    return remainingPermissions
  }

  return Array.from(new Set([...remainingPermissions, ...buildProjectAccessPermissions(projectId, access)]))
}

export function getProjectUserAccess(permissions: string[], projectId: string): ProjectUserAccess {
  if (
    hasAnyPermission(permissions, [
      ...projectPermissionTargets(projectId, 'manage', 'write'),
      ...projectPermissionTargets(projectId, 'users', 'write'),
      ...projectDataSourcePermissionTargets(projectId, '*', 'write'),
      ...dataSourcePermissionTargets(projectId, '*', 'query', 'write'),
      ...dataSourcePermissionTargets(projectId, '*', 'manage', 'write'),
      ...dataSourcePermissionTargets(projectId, '*', 'table.edit', 'write'),
    ])
  ) {
    return 'write'
  }

  if (
    hasAnyPermission(permissions, [
      ...projectPermissionTargets(projectId, 'view', 'read'),
      ...projectDataSourcePermissionTargets(projectId, '*', 'read'),
      ...dataSourcePermissionTargets(projectId, '*', 'view', 'read'),
      ...dataSourcePermissionTargets(projectId, '*', 'query', 'read'),
    ])
  ) {
    return 'read'
  }

  return 'none'
}
