import { sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const sqliteMetaMigrations = sqliteTable('meta_migrations', {
  id: text('id').notNull().primaryKey(),
  executedAt: text('executed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const sqliteUsers = sqliteTable('users', {
  id: text('id').notNull().primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  authProvider: text('auth_provider').notNull(),
  externalSubject: text('external_subject'),
  passwordHash: text('password_hash'),
  passwordSalt: text('password_salt'),
  permissionsJson: text('permissions_json'),
  disabled: integer('disabled').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sqliteRoles = sqliteTable('roles', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  permissionsJson: text('permissions_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sqliteUserRoles = sqliteTable(
  'user_roles',
  {
    userId: text('user_id').notNull(),
    roleId: text('role_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
)

export const sqliteAuthTokens = sqliteTable('auth_tokens', {
  id: text('id').notNull().primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  tokenPrefix: text('token_prefix').notNull(),
  tokenHash: text('token_hash').notNull(),
  storage: text('storage').notNull(),
  expiresAt: text('expires_at'),
  lastUsedAt: text('last_used_at'),
  createdAt: text('created_at').notNull(),
})

export const sqliteOidcStates = sqliteTable('oidc_states', {
  id: text('id').notNull().primaryKey(),
  state: text('state').notNull(),
  nonce: text('nonce').notNull(),
  codeVerifier: text('code_verifier').notNull(),
  returnTo: text('return_to').notNull(),
  storage: text('storage').notNull(),
  createdAt: text('created_at').notNull(),
})

export const sqliteProjects = sqliteTable('projects', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sqliteDataSources = sqliteTable('data_sources', {
  id: text('id').notNull().primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  configJson: text('config_json').notNull(),
  position: integer('position').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sqliteMetaSchema = {
  metaMigrations: sqliteMetaMigrations,
  users: sqliteUsers,
  roles: sqliteRoles,
  userRoles: sqliteUserRoles,
  authTokens: sqliteAuthTokens,
  oidcStates: sqliteOidcStates,
  projects: sqliteProjects,
  dataSources: sqliteDataSources,
}
