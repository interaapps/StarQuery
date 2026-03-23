export type SQLTableColumn = {
  name: string
  type: string
  nullable: boolean
  defaultValue: unknown
  autoIncrement: boolean
  primaryKey: boolean
  enumValues?: string[]
}

export type SQLTableDetails = {
  name: string
  columns: SQLTableColumn[]
  primaryKeys: string[]
}

export type SQLTableRowPage = {
  page: number
  pageSize: number
  total: number
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  columns: SQLTableColumn[]
  rows: Record<string, unknown>[]
}

export type SQLCreateTableColumnInput = {
  name: string
  type: string
  nullable?: boolean
  defaultValue?: string | null
  autoIncrement?: boolean
  primaryKey?: boolean
}

export type SQLSaveTableChangesInput = {
  table: string
  primaryKeys?: string[]
  insertedRows?: Record<string, unknown>[]
  updatedRows?: Array<{
    original: Record<string, unknown>
    changes: Record<string, unknown>
  }>
  deletedRows?: Record<string, unknown>[]
}

export type QueryResult =
  | {
      type: 'SELECT'
      columns: string[]
      rows: Record<string, unknown>[]
    }
  | {
      type: 'RESULT'
      result: {
        affectedRows?: number
        insertId?: number | string
        changedRows?: number
        warningStatus?: number
        command?: string
      }
    }

export abstract class DefaultSQLAdapter {
  abstract connect(): Promise<void>
  abstract close(): Promise<void>

  abstract getTables(): Promise<Array<{ name: string }>>
  abstract getTableDetails(table: string): Promise<SQLTableDetails>
  abstract getTableRows(input: {
    table: string
    page: number
    pageSize: number
    sortBy?: string
    sortDirection?: 'asc' | 'desc'
    where?: string
  }): Promise<SQLTableRowPage>
  abstract execute(sql: string, params?: unknown[]): Promise<QueryResult>
  abstract executeStatements(sql: string): Promise<QueryResult[]>
  abstract createTable(name: string, columns: SQLCreateTableColumnInput[]): Promise<void>
  abstract dropTable(name: string): Promise<void>
  abstract saveTableChanges(input: SQLSaveTableChangesInput): Promise<{
    inserted: number
    updated: number
    deleted: number
  }>
}
