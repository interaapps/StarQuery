import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2'
import { drizzle as drizzleSqliteProxy } from 'drizzle-orm/sqlite-proxy'
import type { AppConfig } from '../config/app-config.ts'
import { loadSqliteDatabaseConstructor, type SqliteDatabaseLike } from '../shared/sqlite-driver.ts'
import { mysqlMetaSchema } from './schema/mysql.ts'
import { sqliteMetaSchema } from './schema/sqlite.ts'

type SqliteMethod = 'run' | 'all' | 'values' | 'get'
type SqliteConnection = SqliteDatabaseLike

export type MetaDatabaseConnection = {
  driver: AppConfig['metaStore']['driver']
  db: any
  schema: any
  execute: (statement: string, params?: unknown[]) => Promise<unknown[]>
  close: () => Promise<void>
}

function normalizeSqliteRows(rows: unknown[]) {
  return rows.map((row) => {
    if (Array.isArray(row)) {
      return row
    }

    if (!row || typeof row !== 'object') {
      return [row]
    }

    return Object.values(row)
  })
}

function normalizeSqliteParam(param: unknown) {
  if (typeof param === 'boolean') {
    return param ? 1 : 0
  }

  if (param instanceof Date) {
    return param.toISOString()
  }

  return param
}

function normalizeSqliteParams(params: unknown[]) {
  return params.map((param) => normalizeSqliteParam(param))
}

function normalizeSqliteRow(row: unknown) {
  return normalizeSqliteRows([row])[0] ?? []
}

function createSqliteProxyCallback(connection: SqliteConnection) {
  return async (query: string, params: unknown[], method: SqliteMethod) => {
    const statement = connection.prepare(query)
    const normalizedParams = normalizeSqliteParams(params)

    if (method === 'run') {
      statement.run(...normalizedParams)
      return { rows: [] }
    }

    if (method === 'get') {
      const row = statement.get(...normalizedParams)
      return { rows: row === undefined ? [] : [normalizeSqliteRow(row)] }
    }

    const rows = statement.all(...normalizedParams)
    return { rows: normalizeSqliteRows(rows as unknown[]) }
  }
}

function executeSqlite(connection: SqliteConnection, statement: string, params: unknown[] = []) {
  const prepared = connection.prepare(statement)
  const normalizedParams = normalizeSqliteParams(params)
  const normalizedStatement = statement.trim().toLowerCase()
  if (
    normalizedStatement.startsWith('select') ||
    normalizedStatement.startsWith('pragma') ||
    normalizedStatement.startsWith('with')
  ) {
    return prepared.all(...normalizedParams) as unknown[]
  }

  prepared.run(...normalizedParams)
  return []
}

async function createSqliteConnection(config: AppConfig): Promise<MetaDatabaseConnection> {
  const DatabaseSync = await loadSqliteDatabaseConstructor()
  const sqlitePath = config.metaStore.sqlitePath
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true })

  const sqlite = new DatabaseSync(sqlitePath)
  sqlite.exec('PRAGMA foreign_keys = ON')
  sqlite.exec('PRAGMA journal_mode = WAL')

  const db = drizzleSqliteProxy(createSqliteProxyCallback(sqlite), {
    schema: sqliteMetaSchema,
  })

  return {
    driver: 'sqlite',
    db,
    schema: sqliteMetaSchema,
    execute: async (statement, params = []) => executeSqlite(sqlite, statement, params),
    close: async () => {
      sqlite.close()
    },
  }
}

async function createMySqlConnection(config: AppConfig): Promise<MetaDatabaseConnection> {
  const pool = mysql.createPool({
    host: config.metaStore.mysql.host,
    port: config.metaStore.mysql.port,
    user: config.metaStore.mysql.user,
    password: config.metaStore.mysql.password,
    database: config.metaStore.mysql.database,
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })

  const db = drizzleMysql(pool, {
    schema: mysqlMetaSchema,
    mode: 'default',
  })

  return {
    driver: 'mysql',
    db,
    schema: mysqlMetaSchema,
    execute: async (statement, params = []) => {
      const [result] = await pool.query(statement, params)
      return result as unknown[]
    },
    close: async () => {
      await pool.end()
    },
  }
}

export async function createMetaDatabaseConnection(config: AppConfig): Promise<MetaDatabaseConnection> {
  if (config.metaStore.driver === 'mysql') {
    return createMySqlConnection(config)
  }

  return createSqliteConnection(config)
}
