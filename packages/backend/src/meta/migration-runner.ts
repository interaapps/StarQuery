import type { MetaDatabaseConnection } from './connection.ts'
import { META_MIGRATIONS, type MetaMigrationContext } from './migrations.ts'

function quoteIdentifier(connection: MetaDatabaseConnection, identifier: string) {
  if (connection.driver === 'mysql') {
    return `\`${identifier.replace(/`/g, '``')}\``
  }

  return `"${identifier.replace(/"/g, '""')}"`
}

async function ensureMigrationTable(connection: MetaDatabaseConnection) {
  if (connection.driver === 'mysql') {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS meta_migrations (
        id VARCHAR(255) NOT NULL PRIMARY KEY,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    return
  }

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS meta_migrations (
      id TEXT NOT NULL PRIMARY KEY,
      executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function getExecutedMigrationIds(connection: MetaDatabaseConnection) {
  const rows = await connection.db
    .select({ id: connection.schema.metaMigrations.id })
    .from(connection.schema.metaMigrations)
    .orderBy(connection.schema.metaMigrations.id)

  return rows
    .map((row: Record<string, unknown>) => row.id)
    .filter((value: unknown): value is string => typeof value === 'string')
}

async function markMigrationExecuted(connection: MetaDatabaseConnection, migrationId: string) {
  await connection.db.insert(connection.schema.metaMigrations).values({
    id: migrationId,
  })
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

  const rows = await connection.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    [tableName],
  )

  return Array.isArray(rows) && rows.length > 0
}

async function columnExists(connection: MetaDatabaseConnection, tableName: string, columnName: string) {
  if (connection.driver === 'mysql') {
    const rows = await connection.execute(
      `
        SELECT COUNT(*) AS total
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
      `,
      [tableName, columnName],
    )

    const total = Array.isArray(rows) && rows[0] && typeof rows[0] === 'object' ? (rows[0] as any).total : 0
    return Number(total ?? 0) > 0
  }

  const rows = await connection.execute(`PRAGMA table_info(${quoteIdentifier(connection, tableName)})`)
  if (!Array.isArray(rows)) {
    return false
  }

  return rows.some((row) => row && typeof row === 'object' && (row as Record<string, unknown>).name === columnName)
}

function createMigrationContext(connection: MetaDatabaseConnection): MetaMigrationContext {
  return {
    driver: connection.driver,
    execute: async (statement, params = []) => {
      const result = await connection.execute(statement, params)
      return Array.isArray(result) ? result : []
    },
    ensureColumn: async (tableName, columnName, definitionByDriver) => {
      if (!(await tableExists(connection, tableName))) {
        throw new Error(`Cannot add column ${columnName} because table ${tableName} does not exist`)
      }

      if (await columnExists(connection, tableName, columnName)) {
        return
      }

      await connection.execute(
        `ALTER TABLE ${quoteIdentifier(connection, tableName)} ADD COLUMN ${definitionByDriver[connection.driver]}`,
      )
    },
    tableExists: (tableName) => tableExists(connection, tableName),
  }
}

export async function runMetaMigrations(connection: MetaDatabaseConnection) {
  await ensureMigrationTable(connection)
  const executedMigrationIds = new Set(await getExecutedMigrationIds(connection))
  const context = createMigrationContext(connection)

  for (const migration of META_MIGRATIONS) {
    if (executedMigrationIds.has(migration.id)) {
      continue
    }

    await migration.up(context)
    await markMigrationExecuted(connection, migration.id)
  }
}
