import { sql } from 'drizzle-orm'
import { boolean, int, mysqlTable, primaryKey, text, timestamp, varchar } from 'drizzle-orm/mysql-core'

export const mysqlMetaMigrations = mysqlTable('meta_migrations', {
  id: varchar('id', { length: 255 }).notNull().primaryKey(),
  executedAt: timestamp('executed_at', { mode: 'string' }).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const mysqlUsers = mysqlTable('users', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  authProvider: varchar('auth_provider', { length: 50 }).notNull(),
  externalSubject: varchar('external_subject', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  passwordSalt: varchar('password_salt', { length: 255 }),
  permissionsJson: text('permissions_json'),
  disabled: boolean('disabled').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull(),
})

export const mysqlRoles = mysqlTable('roles', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  permissionsJson: text('permissions_json').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull(),
})

export const mysqlUserRoles = mysqlTable(
  'user_roles',
  {
    userId: varchar('user_id', { length: 36 }).notNull(),
    roleId: varchar('role_id', { length: 36 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
)

export const mysqlAuthTokens = mysqlTable('auth_tokens', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  kind: varchar('kind', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  tokenPrefix: varchar('token_prefix', { length: 32 }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  storage: varchar('storage', { length: 20 }).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }),
  lastUsedAt: timestamp('last_used_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull(),
})

export const mysqlOidcStates = mysqlTable('oidc_states', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  state: varchar('state', { length: 255 }).notNull(),
  nonce: varchar('nonce', { length: 255 }).notNull(),
  codeVerifier: varchar('code_verifier', { length: 255 }).notNull(),
  returnTo: text('return_to').notNull(),
  storage: varchar('storage', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull(),
})

export const mysqlProjects = mysqlTable('projects', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  position: int('position').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull(),
})

export const mysqlDataSources = mysqlTable('data_sources', {
  id: varchar('id', { length: 36 }).notNull().primaryKey(),
  projectId: varchar('project_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  configJson: text('config_json').notNull(),
  position: int('position').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull(),
})

export const mysqlMetaSchema = {
  metaMigrations: mysqlMetaMigrations,
  users: mysqlUsers,
  roles: mysqlRoles,
  userRoles: mysqlUserRoles,
  authTokens: mysqlAuthTokens,
  oidcStates: mysqlOidcStates,
  projects: mysqlProjects,
  dataSources: mysqlDataSources,
}
