import { sql } from 'drizzle-orm'
import { boolean, int, mysqlTable, primaryKey, text, timestamp, unique, varchar } from 'drizzle-orm/mysql-core'
export const mysqlUsers = mysqlTable('users', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  authProvider: varchar('auth_provider', { length: 50 }).notNull().default('local'),
  externalSubject: varchar('external_subject', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  passwordSalt: varchar('password_salt', { length: 255 }),
  permissionsJson: text('permissions_json').notNull().default('[]'),
  disabled: boolean('disabled').notNull().default(false),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const mysqlRoles = mysqlTable('roles', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  permissionsJson: text('permissions_json').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const mysqlUserRoles = mysqlTable(
  'user_roles',
  {
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => mysqlUsers.id, { onDelete: 'cascade' }),
    roleId: varchar('role_id', { length: 36 })
      .notNull()
      .references(() => mysqlRoles.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
)

export const mysqlAuthTokens = mysqlTable('auth_tokens', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => mysqlUsers.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  tokenPrefix: varchar('token_prefix', { length: 32 }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  storage: varchar('storage', { length: 20 }).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }),
  lastUsedAt: timestamp('last_used_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const mysqlOidcStates = mysqlTable('oidc_states', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  state: varchar('state', { length: 255 }).notNull().unique(),
  nonce: varchar('nonce', { length: 255 }).notNull(),
  codeVerifier: varchar('code_verifier', { length: 255 }).notNull(),
  returnTo: text('return_to').notNull(),
  storage: varchar('storage', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const mysqlProjects = mysqlTable('projects', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  position: int('position').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const mysqlDataSources = mysqlTable(
  'data_sources',
  {
    id: varchar('id', { length: 36 }).notNull().primaryKey(),
    projectId: varchar('project_id', { length: 36 })
      .notNull()
      .references(() => mysqlProjects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    configJson: text('config_json').notNull(),
    position: int('position').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [unique('data_sources_project_name_unique').on(table.projectId, table.name)],
)

export const mysqlMetaSchema = {
  users: mysqlUsers,
  roles: mysqlRoles,
  userRoles: mysqlUserRoles,
  authTokens: mysqlAuthTokens,
  oidcStates: mysqlOidcStates,
  projects: mysqlProjects,
  dataSources: mysqlDataSources,
}
