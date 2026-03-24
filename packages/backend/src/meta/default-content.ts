import { createPasswordHash } from '../auth/passwords.ts'
import type { AppConfig } from '../config/app-config.ts'
import type { MetaDatabaseConnection } from './connection.ts'
import { createProject, listProjects } from './repositories/projects-repository.ts'
import {
  createRole,
  createUser,
  getRoleBySlug,
  getUserByEmail,
  listUserRoleIds,
  setUserRoleIds,
  updateUser,
} from './repositories/users-repository.ts'

async function ensureAdminRole(connection: MetaDatabaseConnection) {
  const existing = await getRoleBySlug(connection, 'admin')
  if (existing) {
    return existing
  }

  return createRole(connection, {
    slug: 'admin',
    name: 'Admin',
    description: 'Full access to StarQuery.',
    permissions: ['*'],
  })
}

async function ensureSeedAdminUser(config: AppConfig, connection: MetaDatabaseConnection) {
  const seedAdmin = config.auth.seedAdmin
  if (!seedAdmin) {
    return
  }

  const email = seedAdmin.email.trim().toLowerCase()
  if (!email) {
    return
  }

  const adminRole = await ensureAdminRole(connection)
  const password = createPasswordHash(seedAdmin.password)
  const existing = await getUserByEmail(connection, email)

  if (!existing) {
    const user = await createUser(connection, {
      email,
      name: seedAdmin.name.trim() || 'Admin',
      passwordHash: password.hash,
      passwordSalt: password.salt,
      permissions: [],
    })

    await setUserRoleIds(connection, user.id, [adminRole.id])
    return
  }

  const roleIds = Array.from(new Set([...(await listUserRoleIds(connection, existing.id)), adminRole.id]))

  await updateUser(connection, existing.id, {
    name: seedAdmin.name.trim() || existing.name,
    passwordHash: password.hash,
    passwordSalt: password.salt,
    disabled: false,
  })
  await setUserRoleIds(connection, existing.id, roleIds)
}

async function ensureDefaultProject(connection: MetaDatabaseConnection) {
  const projects = await listProjects(connection)
  if (projects.length > 0) {
    return
  }

  await createProject(connection, {
    name: 'Default',
    slug: 'default',
    description: 'Default workspace',
    position: 0,
  })
}

export async function ensureDefaultMetaContent(config: AppConfig, connection: MetaDatabaseConnection) {
  await ensureAdminRole(connection)
  await ensureSeedAdminUser(config, connection)
  await ensureDefaultProject(connection)
}
