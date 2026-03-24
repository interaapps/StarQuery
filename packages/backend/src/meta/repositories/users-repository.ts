import crypto from 'node:crypto'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { RoleRecord, UserRecord, UserWithRolesRecord } from '../types.ts'
import type { MetaRepositoryContext } from './context.ts'
import { nowForDriver, parseJsonArray, toSlug } from '../utils.ts'

function mapUserRow(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    authProvider: ((row.authProvider as UserRecord['authProvider']) ?? 'local'),
    externalSubject: (row.externalSubject as string | null | undefined) ?? null,
    passwordHash: (row.passwordHash as string | null | undefined) ?? null,
    passwordSalt: (row.passwordSalt as string | null | undefined) ?? null,
    permissions: parseJsonArray(row.permissionsJson),
    disabled: Boolean(row.disabled),
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
  }
}

function mapRoleRow(row: Record<string, unknown>): RoleRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: (row.description as string | null | undefined) ?? null,
    permissions: parseJsonArray(row.permissionsJson),
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
  }
}

export async function countUsers(context: MetaRepositoryContext) {
  const [row] = await context.db.select({ total: sql<number>`count(*)` }).from(context.schema.users)
  return Number(row?.total ?? 0)
}

export async function listUsers(context: MetaRepositoryContext): Promise<UserRecord[]> {
  const rows = await context.db.select().from(context.schema.users).orderBy(asc(context.schema.users.email))
  return rows.map((row: Record<string, unknown>) => mapUserRow(row))
}

async function getUserByColumn(
  context: MetaRepositoryContext,
  column: any,
  value: string,
): Promise<UserRecord | null> {
  const rows = await context.db.select().from(context.schema.users).where(eq(column, value)).limit(1)
  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function getUserById(context: MetaRepositoryContext, userId: string) {
  return getUserByColumn(context, context.schema.users.id, userId)
}

export async function getUserByEmail(context: MetaRepositoryContext, email: string) {
  return getUserByColumn(context, context.schema.users.email, email)
}

export async function getUserByExternalSubject(
  context: MetaRepositoryContext,
  authProvider: UserRecord['authProvider'],
  externalSubject: string,
) {
  const rows = await context.db
    .select()
    .from(context.schema.users)
    .where(
      sql`${context.schema.users.authProvider} = ${authProvider} and ${context.schema.users.externalSubject} = ${externalSubject}`,
    )
    .limit(1)

  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function createUser(
  context: MetaRepositoryContext,
  input: {
    email: string
    name: string
    passwordHash?: string | null
    passwordSalt?: string | null
    permissions?: string[]
    authProvider?: UserRecord['authProvider']
    externalSubject?: string | null
    disabled?: boolean
  },
): Promise<UserRecord> {
  const now = nowForDriver(context.driver)
  const record: UserRecord = {
    id: crypto.randomUUID(),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    authProvider: input.authProvider ?? 'local',
    externalSubject: input.externalSubject ?? null,
    passwordHash: input.passwordHash ?? null,
    passwordSalt: input.passwordSalt ?? null,
    permissions: input.permissions ?? [],
    disabled: input.disabled ?? false,
    createdAt: now,
    updatedAt: now,
  }

  await context.db.insert(context.schema.users).values({
    id: record.id,
    email: record.email,
    name: record.name,
    authProvider: record.authProvider,
    externalSubject: record.externalSubject,
    passwordHash: record.passwordHash,
    passwordSalt: record.passwordSalt,
    permissionsJson: JSON.stringify(record.permissions),
    disabled: record.disabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })

  return record
}

export async function updateUser(
  context: MetaRepositoryContext,
  userId: string,
  patch: Partial<
    Pick<UserRecord, 'email' | 'name' | 'authProvider' | 'externalSubject' | 'passwordHash' | 'passwordSalt' | 'permissions' | 'disabled'>
  >,
) {
  const current = await getUserById(context, userId)
  if (!current) {
    throw new Error('User not found')
  }

  const next = {
    ...current,
    ...(patch.email !== undefined ? { email: patch.email.trim().toLowerCase() } : {}),
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.authProvider !== undefined ? { authProvider: patch.authProvider } : {}),
    ...(patch.externalSubject !== undefined ? { externalSubject: patch.externalSubject } : {}),
    ...(patch.passwordHash !== undefined ? { passwordHash: patch.passwordHash } : {}),
    ...(patch.passwordSalt !== undefined ? { passwordSalt: patch.passwordSalt } : {}),
    ...(patch.permissions !== undefined ? { permissions: patch.permissions } : {}),
    ...(patch.disabled !== undefined ? { disabled: patch.disabled } : {}),
    updatedAt: nowForDriver(context.driver),
  }

  await context.db
    .update(context.schema.users)
    .set({
      email: next.email,
      name: next.name,
      authProvider: next.authProvider,
      externalSubject: next.externalSubject,
      passwordHash: next.passwordHash,
      passwordSalt: next.passwordSalt,
      permissionsJson: JSON.stringify(next.permissions),
      disabled: next.disabled,
      updatedAt: next.updatedAt,
    })
    .where(eq(context.schema.users.id, userId))

  return next
}

export async function deleteUser(context: MetaRepositoryContext, userId: string) {
  await context.db.delete(context.schema.users).where(eq(context.schema.users.id, userId))
}

export async function listRoles(context: MetaRepositoryContext): Promise<RoleRecord[]> {
  const rows = await context.db.select().from(context.schema.roles).orderBy(asc(context.schema.roles.name))
  return rows.map((row: Record<string, unknown>) => mapRoleRow(row))
}

async function getRoleByColumn(context: MetaRepositoryContext, column: any, value: string) {
  const rows = await context.db.select().from(context.schema.roles).where(eq(column, value)).limit(1)
  return rows[0] ? mapRoleRow(rows[0]) : null
}

export async function getRoleById(context: MetaRepositoryContext, roleId: string) {
  return getRoleByColumn(context, context.schema.roles.id, roleId)
}

export async function getRoleBySlug(context: MetaRepositoryContext, slug: string) {
  return getRoleByColumn(context, context.schema.roles.slug, slug)
}

export async function createRole(
  context: MetaRepositoryContext,
  input: {
    slug?: string
    name: string
    description?: string | null
    permissions?: string[]
  },
): Promise<RoleRecord> {
  const now = nowForDriver(context.driver)
  const record: RoleRecord = {
    id: crypto.randomUUID(),
    slug: input.slug ? toSlug(input.slug) : toSlug(input.name),
    name: input.name.trim(),
    description: input.description ?? null,
    permissions: input.permissions ?? [],
    createdAt: now,
    updatedAt: now,
  }

  await context.db.insert(context.schema.roles).values({
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    permissionsJson: JSON.stringify(record.permissions),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })

  return record
}

export async function updateRole(
  context: MetaRepositoryContext,
  roleId: string,
  patch: Partial<Pick<RoleRecord, 'slug' | 'name' | 'description' | 'permissions'>>,
) {
  const current = await getRoleById(context, roleId)
  if (!current) {
    throw new Error('Role not found')
  }

  const next = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    slug: patch.slug ? toSlug(patch.slug) : current.slug,
    description: patch.description === undefined ? current.description : patch.description,
    ...(patch.permissions !== undefined ? { permissions: patch.permissions } : {}),
    updatedAt: nowForDriver(context.driver),
  }

  await context.db
    .update(context.schema.roles)
    .set({
      slug: next.slug,
      name: next.name,
      description: next.description,
      permissionsJson: JSON.stringify(next.permissions),
      updatedAt: next.updatedAt,
    })
    .where(eq(context.schema.roles.id, roleId))

  return next
}

export async function deleteRole(context: MetaRepositoryContext, roleId: string) {
  await context.db.delete(context.schema.roles).where(eq(context.schema.roles.id, roleId))
}

export async function listUserRoleIds(context: MetaRepositoryContext, userId: string) {
  const rows = await context.db
    .select({ roleId: context.schema.userRoles.roleId })
    .from(context.schema.userRoles)
    .where(eq(context.schema.userRoles.userId, userId))

  return rows.map((row: Record<string, unknown>) => String(row.roleId))
}

export async function setUserRoleIds(context: MetaRepositoryContext, userId: string, roleIds: string[]) {
  await context.db.delete(context.schema.userRoles).where(eq(context.schema.userRoles.userId, userId))

  if (!roleIds.length) {
    return
  }

  await context.db.insert(context.schema.userRoles).values(
    roleIds.map((roleId) => ({
      userId,
      roleId,
    })),
  )
}

export async function getRolesByIds(context: MetaRepositoryContext, roleIds: string[]) {
  if (!roleIds.length) {
    return []
  }

  const rows = await context.db
    .select()
    .from(context.schema.roles)
    .where(inArray(context.schema.roles.id, roleIds))

  const roleMap = new Map(rows.map((row: Record<string, unknown>) => [String(row.id), mapRoleRow(row)]))
  return roleIds.map((roleId) => roleMap.get(roleId)).filter((role): role is RoleRecord => Boolean(role))
}

export async function getUserWithRoles(context: MetaRepositoryContext, userId: string): Promise<UserWithRolesRecord | null> {
  const user = await getUserById(context, userId)
  if (!user) {
    return null
  }

  const roleIds = await listUserRoleIds(context, userId)
  const roles = await getRolesByIds(context, roleIds)

  return {
    ...user,
    roleIds,
    roles,
  }
}
