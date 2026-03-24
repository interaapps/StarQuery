import { fileURLToPath } from 'node:url'
import { migrate as migrateMySql } from 'drizzle-orm/mysql2/migrator'
import { migrate as migrateSqliteProxy } from 'drizzle-orm/sqlite-proxy/migrator'
import type { MetaDatabaseConnection } from './connection.ts'

const MYSQL_MIGRATIONS_FOLDER = fileURLToPath(new URL('./drizzle/mysql', import.meta.url))
const SQLITE_MIGRATIONS_FOLDER = fileURLToPath(new URL('./drizzle/sqlite', import.meta.url))
const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations'
const META_TABLES = ['users', 'projects', 'data_sources', 'roles', 'user_roles', 'auth_tokens', 'oidc_states']

function getMigrationsFolder(connection: MetaDatabaseConnection) {
  return connection.driver === 'mysql' ? MYSQL_MIGRATIONS_FOLDER : SQLITE_MIGRATIONS_FOLDER
}

async function tableExists(connection: MetaDatabaseConnection, tableName: string) {
  if (connection.driver === 'mysql') {
    const rows = await connection.execute(
      `
        SELECT COUNT(*) AS total
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
      `,
      [tableName],
    )

    const total = Array.isArray(rows) && rows[0] && typeof rows[0] === 'object' ? (rows[0] as any).total : 0
    return Number(total ?? 0) > 0
  }

  const rows = await connection.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`, [tableName])
  return Array.isArray(rows) && rows.length > 0
}

async function countRows(connection: MetaDatabaseConnection, tableName: string) {
  const rows = await connection.execute(`SELECT COUNT(*) AS total FROM ${tableName}`)
  const total = Array.isArray(rows) && rows[0] && typeof rows[0] === 'object' ? (rows[0] as any).total : 0
  return Number(total ?? 0)
}

async function hasExistingMetaTables(connection: MetaDatabaseConnection) {
  for (const tableName of META_TABLES) {
    if (await tableExists(connection, tableName)) {
      return true
    }
  }

  return false
}

async function hasDrizzleMigrationEntries(connection: MetaDatabaseConnection) {
  if (!(await tableExists(connection, DRIZZLE_MIGRATIONS_TABLE))) {
    return false
  }

  return (await countRows(connection, DRIZZLE_MIGRATIONS_TABLE)) > 0
}

async function applyDrizzleMigrations(connection: MetaDatabaseConnection) {
  const config = { migrationsFolder: getMigrationsFolder(connection) }

  if (connection.driver === 'mysql') {
    await migrateMySql(connection.db, config)
    return
  }

  await migrateSqliteProxy(
    connection.db,
    async (queries) => {
      for (const query of queries) {
        const statement = query.trim()
        if (!statement) {
          continue
        }

        await connection.execute(statement)
      }
    },
    config,
  )
}

export async function runMetaMigrations(connection: MetaDatabaseConnection) {
  if (await hasDrizzleMigrationEntries(connection)) {
    await applyDrizzleMigrations(connection)
    return
  }

  if (await hasExistingMetaTables(connection)) {
    throw new Error(
      `Existing meta tables were found without ${DRIZZLE_MIGRATIONS_TABLE}. This pre-Drizzle meta schema is no longer supported. Please reset the meta database and try again.`,
    )
  }

  await applyDrizzleMigrations(connection)
}
