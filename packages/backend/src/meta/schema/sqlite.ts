import { sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
export const sqliteUsers = sqliteTable('users', {
  id: text('id').notNull().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  authProvider: text('auth_provider').notNull().default('local'),
  externalSubject: text('external_subject'),
  passwordHash: text('password_hash'),
  passwordSalt: text('password_salt'),
  permissionsJson: text('permissions_json').notNull().default('[]'),
  disabled: integer('disabled').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const sqliteRoles = sqliteTable('roles', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  permissionsJson: text('permissions_json').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const sqliteUserRoles = sqliteTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => sqliteUsers.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => sqliteRoles.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
)

export const sqliteAuthTokens = sqliteTable('auth_tokens', {
  id: text('id').notNull().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => sqliteUsers.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  tokenPrefix: text('token_prefix').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  storage: text('storage').notNull(),
  expiresAt: text('expires_at'),
  lastUsedAt: text('last_used_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const sqliteOidcStates = sqliteTable('oidc_states', {
  id: text('id').notNull().primaryKey(),
  state: text('state').notNull().unique(),
  nonce: text('nonce').notNull(),
  codeVerifier: text('code_verifier').notNull(),
  returnTo: text('return_to').notNull(),
  storage: text('storage').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const sqliteProjects = sqliteTable('projects', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const sqliteDataSources = sqliteTable(
  'data_sources',
  {
    id: text('id').notNull().primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => sqliteProjects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    configJson: text('config_json').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [unique('data_sources_project_name_unique').on(table.projectId, table.name)],
)

export const sqliteMetaSchema = {
  users: sqliteUsers,
  roles: sqliteRoles,
  userRoles: sqliteUserRoles,
  authTokens: sqliteAuthTokens,
  oidcStates: sqliteOidcStates,
  projects: sqliteProjects,
  dataSources: sqliteDataSources,
}
