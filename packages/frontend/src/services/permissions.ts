export type PermissionAccess = 'read' | 'write'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parsePermission(value: string) {
  const match = value.match(/^(.*?)(?::(read|write))?$/)
  return {
    path: match?.[1] ?? value,
    access: (match?.[2] as PermissionAccess | undefined) ?? null,
  }
}

function applyPermissionAccess(target: string, access?: PermissionAccess) {
  if (!access || target === '*') {
    return parsePermission(target).path
  }

  return `${parsePermission(target).path}:${access}`
}

function withPermissionAccess(targets: string[], access?: PermissionAccess) {
  return Array.from(new Set(targets.map((target) => applyPermissionAccess(target, access))))
}

function uniqueTargets(targets: string[]) {
  return Array.from(new Set(targets))
}

export function permissionPatternMatches(pattern: string, requiredPermission: string) {
  if (pattern === '*') {
    return true
  }

  const parsedPattern = parsePermission(pattern)
  const parsedRequired = parsePermission(requiredPermission)
  const regex = new RegExp(`^${escapeRegex(parsedPattern.path).replace(/\\\*/g, '.*')}$`)
  if (!regex.test(parsedRequired.path)) {
    return false
  }

  if (!parsedRequired.access) {
    return true
  }

  return !parsedPattern.access || parsedPattern.access === parsedRequired.access
}

export function projectPermissionTargets(
  projectId: string,
  action: 'view' | 'manage' | 'create' | 'users',
  access?: PermissionAccess,
) {
  const targets = [`project.${action}`, `project.${action}.*`]

  if (action !== 'create') {
    targets.push(`project.${action}.${projectId}`)
  }

  return withPermissionAccess(targets, access)
}

export function dataSourcePermissionTargets(
  projectId: string,
  sourceId: string | '*',
  action: 'view' | 'manage' | 'query' | 'table.edit',
  access?: PermissionAccess,
) {
  return withPermissionAccess(
    [
      `datasource.${action}`,
      `datasource.${action}.*`,
      `datasource.${action}.${projectId}.*`,
      `datasource.${action}.${projectId}.${sourceId}`,
    ],
    access,
  )
}

export function projectDataSourcePermissionTargets(
  projectId: string,
  sourceId: string | '*',
  access?: PermissionAccess,
) {
  const targets = [
    `project.manage.${projectId}.datasources`,
    `project.manage.${projectId}.datasources.*`,
  ]

  if (sourceId !== '*') {
    targets.push(`project.manage.${projectId}.datasources.${sourceId}`)
  }

  return withPermissionAccess(targets, access)
}

export function dataSourceReadPermissionTargets(projectId: string, sourceId: string | '*') {
  return uniqueTargets([
    ...projectDataSourcePermissionTargets(projectId, sourceId, 'read'),
    ...projectDataSourcePermissionTargets(projectId, sourceId, 'write'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'view', 'read'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'query', 'read'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'query', 'write'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'manage', 'write'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'table.edit', 'write'),
    ...projectPermissionTargets(projectId, 'manage', 'write'),
  ])
}

export function dataSourceWritePermissionTargets(projectId: string, sourceId: string | '*') {
  return uniqueTargets([
    ...projectDataSourcePermissionTargets(projectId, sourceId, 'write'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'query', 'write'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'manage', 'write'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'table.edit', 'write'),
    ...projectPermissionTargets(projectId, 'manage', 'write'),
  ])
}

export function dataSourceConfigPermissionTargets(projectId: string, sourceId: string | '*') {
  return uniqueTargets([
    ...projectDataSourcePermissionTargets(projectId, sourceId, 'write'),
    ...dataSourcePermissionTargets(projectId, sourceId, 'manage', 'write'),
    ...projectPermissionTargets(projectId, 'manage', 'write'),
  ])
}

export function adminPermissionTargets(
  action: 'access' | 'users' | 'roles' | 'apiKeys',
  access?: PermissionAccess,
) {
  return withPermissionAccess([`admin.${action}`, 'admin.*', '*'], access)
}
