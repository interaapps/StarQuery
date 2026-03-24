import { createPasswordHash } from '../auth/passwords.ts'
import type { AppConfig } from '../config/app-config.ts'
import { getDataSourceDefinition, isKnownDataSourceType } from '../datasources/definitions.ts'
import { normalizeDataSourceConfig } from '../datasources/config.ts'
import type { MetaDatabaseConnection } from './connection.ts'
import {
  createDataSource,
  listDataSources,
  updateDataSource,
} from './repositories/data-sources-repository.ts'
import {
  createProject,
  getProjectBySlug,
  updateProject,
} from './repositories/projects-repository.ts'
import {
  createUser,
  getRoleBySlug,
  getUserByEmail,
  setUserRoleIds,
  updateUser,
} from './repositories/users-repository.ts'
import type { BootstrapConfig } from './types.ts'
import { toSlug } from './utils.ts'

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function resolveRoleIds(connection: MetaDatabaseConnection, roles: string[]) {
  const roleIds: string[] = []

  for (const roleReference of roles) {
    const normalized = toSlug(roleReference)
    if (!normalized) {
      continue
    }

    const role = await getRoleBySlug(connection, normalized)
    if (role) {
      roleIds.push(role.id)
    }
  }

  return Array.from(new Set(roleIds))
}

async function applyBootstrapUsers(connection: MetaDatabaseConnection, users: NonNullable<BootstrapConfig['users']>) {
  for (const userEntry of users) {
    const email = userEntry.email?.trim().toLowerCase()
    const name = userEntry.name?.trim()
    if (!email || !name) {
      continue
    }

    const password = userEntry.password ? createPasswordHash(userEntry.password) : null
    const existing = await getUserByEmail(connection, email)

    const user = existing
      ? await updateUser(connection, existing.id, {
          name,
          ...(userEntry.permissions !== undefined ? { permissions: userEntry.permissions } : {}),
          ...(password
            ? {
                passwordHash: password.hash,
                passwordSalt: password.salt,
              }
            : {}),
        })
      : await createUser(connection, {
          email,
          name,
          passwordHash: password?.hash ?? null,
          passwordSalt: password?.salt ?? null,
          permissions: userEntry.permissions ?? [],
        })

    if (Array.isArray(userEntry.roles)) {
      const roleIds = await resolveRoleIds(connection, userEntry.roles)
      await setUserRoleIds(connection, user.id, roleIds)
    }
  }
}

async function applyBootstrapProjects(
  config: AppConfig,
  connection: MetaDatabaseConnection,
  projects: NonNullable<BootstrapConfig['projects']>,
) {
  for (const [projectIndex, projectEntry] of projects.entries()) {
    const name = projectEntry.name?.trim()
    if (!name) {
      continue
    }

    const slug = projectEntry.slug?.trim() ? toSlug(projectEntry.slug) : toSlug(name)
    const description = projectEntry.description?.trim() || null
    const existingProject = await getProjectBySlug(connection, slug)
    const project = existingProject
      ? await updateProject(connection, existingProject.id, {
          name,
          slug,
          description,
          position: projectIndex,
        })
      : await createProject(connection, {
          name,
          slug,
          description,
          position: projectIndex,
        })

    if (!Array.isArray(projectEntry.dataSources)) {
      continue
    }

    const existingSources = await listDataSources(connection, project.id)

    for (const [sourceIndex, sourceEntry] of projectEntry.dataSources.entries()) {
      const sourceName = sourceEntry.name?.trim()
      if (!sourceName || !isKnownDataSourceType(sourceEntry.type)) {
        continue
      }

      const definition = getDataSourceDefinition(sourceEntry.type)
      if (config.mode !== 'local' && definition.localOnly) {
        throw new Error(`${definition.label} datasources can only be bootstrapped on local servers`)
      }

      const existingSource = existingSources.find((source) => source.name === sourceName)
      const sourceConfig = normalizeDataSourceConfig(sourceEntry.type, cloneJsonValue(sourceEntry.config ?? {}))
      if (existingSource) {
        await updateDataSource(connection, existingSource.id, {
          name: sourceName,
          type: sourceEntry.type,
          config: sourceConfig,
          position: sourceEntry.position ?? sourceIndex,
        })
        continue
      }

      await createDataSource(connection, {
        projectId: project.id,
        name: sourceName,
        type: sourceEntry.type,
        config: sourceConfig,
        position: sourceEntry.position ?? sourceIndex,
      })
    }
  }
}

export async function applyMetaBootstrapConfig(
  config: AppConfig,
  connection: MetaDatabaseConnection,
  bootstrapConfig: BootstrapConfig,
) {
  if (Array.isArray(bootstrapConfig.users)) {
    await applyBootstrapUsers(connection, bootstrapConfig.users)
  }

  if (Array.isArray(bootstrapConfig.projects)) {
    await applyBootstrapProjects(config, connection, bootstrapConfig.projects)
  }
}
