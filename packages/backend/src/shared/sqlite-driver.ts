import { createRequire } from 'node:module'

export type SqliteStatementLike = {
  run: (...params: unknown[]) => unknown
  get: (...params: unknown[]) => unknown
  all: (...params: unknown[]) => unknown[]
}

export type SqliteDatabaseLike = {
  prepare: (query: string) => SqliteStatementLike
  exec: (query: string) => void
  close: () => void
}

type SqliteDatabaseConstructor = new (path: string) => SqliteDatabaseLike

const require = createRequire(import.meta.url)

function isMissingBuiltinSqlite(error: unknown) {
  return (
    error instanceof Error &&
    'code' in error &&
    error.code === 'ERR_UNKNOWN_BUILTIN_MODULE'
  )
}

export async function loadSqliteDatabaseConstructor(): Promise<SqliteDatabaseConstructor> {
  try {
    const sqliteModule = await import('node:sqlite')
    if ('DatabaseSync' in sqliteModule) {
      return sqliteModule.DatabaseSync as SqliteDatabaseConstructor
    }
  } catch (error) {
    if (!isMissingBuiltinSqlite(error)) {
      throw error
    }
  }

  return require('better-sqlite3') as SqliteDatabaseConstructor
}
