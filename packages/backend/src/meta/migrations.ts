export type MetaStoreDriver = 'sqlite' | 'mysql'

export type MetaMigrationContext = {
  driver: MetaStoreDriver
  execute: (statement: string, params?: unknown[]) => Promise<unknown[]>
  ensureColumn: (tableName: string, columnName: string, definitionByDriver: Record<MetaStoreDriver, string>) => Promise<void>
  tableExists: (tableName: string) => Promise<boolean>
}

export type MetaMigration = {
  id: string
  up: (context: MetaMigrationContext) => Promise<void>
}

async function createInitialTables(context: MetaMigrationContext) {
  if (context.driver === 'mysql') {
    await context.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await context.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        slug VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        position INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await context.execute(`
      CREATE TABLE IF NOT EXISTS data_sources (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        project_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        config_json LONGTEXT NOT NULL,
        position INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_data_sources_project
          FOREIGN KEY (project_id) REFERENCES projects(id)
          ON DELETE CASCADE,
        CONSTRAINT uq_project_source_name UNIQUE (project_id, name)
      )
    `)

    return
  }

  await context.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT NOT NULL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await context.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT NOT NULL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await context.execute(`
    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT NOT NULL PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config_json TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE (project_id, name)
    )
  `)
}

async function createAuthTables(context: MetaMigrationContext) {
  await context.ensureColumn('users', 'password_hash', {
    mysql: 'password_hash VARCHAR(255) NULL',
    sqlite: 'password_hash TEXT NULL',
  })
  await context.ensureColumn('users', 'password_salt', {
    mysql: 'password_salt VARCHAR(255) NULL',
    sqlite: 'password_salt TEXT NULL',
  })
  await context.ensureColumn('users', 'permissions_json', {
    mysql: "permissions_json LONGTEXT NULL",
    sqlite: "permissions_json TEXT NOT NULL DEFAULT '[]'",
  })
  await context.ensureColumn('users', 'auth_provider', {
    mysql: "auth_provider VARCHAR(50) NOT NULL DEFAULT 'local'",
    sqlite: "auth_provider TEXT NOT NULL DEFAULT 'local'",
  })
  await context.ensureColumn('users', 'external_subject', {
    mysql: 'external_subject VARCHAR(255) NULL',
    sqlite: 'external_subject TEXT NULL',
  })
  await context.ensureColumn('users', 'disabled', {
    mysql: 'disabled TINYINT(1) NOT NULL DEFAULT 0',
    sqlite: 'disabled INTEGER NOT NULL DEFAULT 0',
  })

  await context.execute(`UPDATE users SET permissions_json = '[]' WHERE permissions_json IS NULL`)
  await context.execute(`UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL OR auth_provider = ''`)
  await context.execute(`UPDATE users SET disabled = 0 WHERE disabled IS NULL`)

  if (context.driver === 'mysql') {
    await context.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        slug VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        permissions_json LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await context.execute(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id VARCHAR(36) NOT NULL,
        role_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (user_id, role_id),
        CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      )
    `)

    await context.execute(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        kind VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        token_prefix VARCHAR(32) NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        storage VARCHAR(20) NOT NULL,
        expires_at TIMESTAMP NULL,
        last_used_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await context.execute(`
      CREATE TABLE IF NOT EXISTS oidc_states (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        state VARCHAR(255) NOT NULL UNIQUE,
        nonce VARCHAR(255) NOT NULL,
        code_verifier VARCHAR(255) NOT NULL,
        return_to TEXT NOT NULL,
        storage VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    return
  }

  await context.execute(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT NOT NULL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NULL,
      permissions_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await context.execute(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    )
  `)

  await context.execute(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      token_prefix TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      storage TEXT NOT NULL,
      expires_at TEXT NULL,
      last_used_at TEXT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await context.execute(`
    CREATE TABLE IF NOT EXISTS oidc_states (
      id TEXT NOT NULL PRIMARY KEY,
      state TEXT NOT NULL UNIQUE,
      nonce TEXT NOT NULL,
      code_verifier TEXT NOT NULL,
      return_to TEXT NOT NULL,
      storage TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export const META_MIGRATIONS: MetaMigration[] = [
  {
    id: '0001_initial',
    up: createInitialTables,
  },
  {
    id: '0002_auth',
    up: createAuthTables,
  },
]
