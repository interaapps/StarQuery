import { DatabaseSync } from 'node:sqlite'
import {
  DefaultSQLAdapter,
  type QueryResult,
  type SQLCreateTableColumnInput,
  type SQLSaveTableChangesInput,
  type SQLTableDetails,
  type SQLTableRowPage,
} from '../default-sql-adapter/DefaultSQLAdapter.ts'
import { assertIdentifier } from '../shared/identifier.ts'
import { splitSqlStatements } from '../shared/sql-statements.ts'
import { normalizeWhereClause } from '../shared/where-clause.ts'

export class SqliteAdapter extends DefaultSQLAdapter {
  private db!: DatabaseSync

  constructor(
    private options: {
      filePath: string
    },
  ) {
    super()
  }

  private quoteIdentifier(identifier: string) {
    assertIdentifier(identifier)
    return `"${identifier.replace(/"/g, '""')}"`
  }

  private buildWhereClause(row: Record<string, unknown>, keys: string[]) {
    const clauses: string[] = []
    const params: unknown[] = []

    for (const key of keys) {
      assertIdentifier(key)
      const value = row[key]

      if (value === null || value === undefined) {
        clauses.push(`${this.quoteIdentifier(key)} IS NULL`)
      } else {
        clauses.push(`${this.quoteIdentifier(key)} = ?`)
        params.push(value)
      }
    }

    return {
      sql: clauses.join(' AND '),
      params,
    }
  }

  private async normalizePrimaryKeys(table: string, requestedKeys?: string[]) {
    if (requestedKeys?.length) {
      requestedKeys.forEach((key) => assertIdentifier(key))
      return requestedKeys
    }

    const details = await this.getTableDetails(table)
    return details.primaryKeys.length ? details.primaryKeys : details.columns.map((column) => column.name)
  }

  async connect() {
    this.db = new DatabaseSync(this.options.filePath)
  }

  async close() {
    this.db?.close()
  }

  async getTables() {
    const rows = this.db
      .prepare(
        `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `,
      )
      .all() as Array<{ name: string }>

    return rows
  }

  async getTableDetails(table: string): Promise<SQLTableDetails> {
    assertIdentifier(table)
    const rows = this.db.prepare(`PRAGMA table_info(${this.quoteIdentifier(table)})`).all() as Array<{
      name: string
      type: string
      notnull: number
      dflt_value: unknown
      pk: number
    }>

    if (!rows.length) {
      throw new Error(`Table ${table} was not found`)
    }

    const columns = rows.map((row) => ({
      name: row.name,
      type: row.type || 'TEXT',
      nullable: row.pk > 0 ? false : row.notnull === 0,
      defaultValue: row.dflt_value,
      autoIncrement: row.pk > 0 && /int/i.test(row.type),
      primaryKey: row.pk > 0,
    }))

    return {
      name: table,
      columns,
      primaryKeys: columns.filter((column) => column.primaryKey).map((column) => column.name),
    }
  }

  async getTableRows(input: {
    table: string
    page: number
    pageSize: number
    sortBy?: string
    sortDirection?: 'asc' | 'desc'
    where?: string
  }): Promise<SQLTableRowPage> {
    const page = Math.max(input.page, 1)
    const pageSize = Math.min(Math.max(input.pageSize, 1), 200)
    const details = await this.getTableDetails(input.table)
    const sortBy = input.sortBy && details.columns.find((column) => column.name === input.sortBy) ? input.sortBy : details.primaryKeys[0] ?? details.columns[0]?.name
    const sortDirection = input.sortDirection === 'desc' ? 'desc' : 'asc'
    const whereClause = normalizeWhereClause(input.where)
    const fromSql = `FROM ${this.quoteIdentifier(input.table)}${whereClause ? ` WHERE ${whereClause}` : ''}`

    const count = this.db
      .prepare(`SELECT COUNT(*) AS total ${fromSql}`)
      .get() as { total: number }

    const rows = this.db
      .prepare(
        `
          SELECT *
          ${fromSql}
          ORDER BY ${this.quoteIdentifier(sortBy)} ${sortDirection.toUpperCase()}
          LIMIT ?
          OFFSET ?
        `,
      )
      .all(pageSize, (page - 1) * pageSize) as Record<string, unknown>[]

    return {
      page,
      pageSize,
      total: Number(count?.total ?? 0),
      sortBy,
      sortDirection,
      columns: details.columns,
      rows,
    }
  }

  async execute(sqlText: string, params: unknown[] = []): Promise<QueryResult> {
    const trimmed = sqlText.trim().toLowerCase()
    const statement = this.db.prepare(sqlText)

    if (trimmed.startsWith('select') || trimmed.startsWith('pragma') || trimmed.startsWith('with')) {
      const rows = statement.all(...params) as Record<string, unknown>[]
      const columns = statement.columns().map((column) => column.name)

      return {
        type: 'SELECT',
        columns,
        rows,
      }
    }

    const result = statement.run(...params)
    return {
      type: 'RESULT',
      result: {
        affectedRows: result.changes,
        insertId: result.lastInsertRowid,
      },
    }
  }

  async executeStatements(sqlText: string) {
    const results: QueryResult[] = []

    for (const statement of splitSqlStatements(sqlText)) {
      results.push(await this.execute(statement))
    }

    return results
  }

  async createTable(name: string, columns: SQLCreateTableColumnInput[]) {
    assertIdentifier(name)

    const normalized = columns.map((column) => {
      assertIdentifier(column.name)
      if (!column.type?.trim()) {
        throw new Error(`Column ${column.name} requires a SQL type`)
      }

      return {
        ...column,
        type: column.type.trim(),
        nullable: column.nullable ?? true,
        primaryKey: column.primaryKey ?? false,
        autoIncrement: column.autoIncrement ?? false,
      }
    })

    const definitions = normalized.map((column) => {
      if (column.autoIncrement && column.primaryKey) {
        return `${this.quoteIdentifier(column.name)} INTEGER PRIMARY KEY AUTOINCREMENT`
      }

      const parts = [
        this.quoteIdentifier(column.name),
        column.type,
        column.nullable ? 'NULL' : 'NOT NULL',
      ]

      if (column.defaultValue) {
        parts.push(`DEFAULT ${column.defaultValue}`)
      }

      return parts.join(' ')
    })

    const primaryKeys = normalized
      .filter((column) => column.primaryKey && !column.autoIncrement)
      .map((column) => this.quoteIdentifier(column.name))

    if (primaryKeys.length) {
      definitions.push(`PRIMARY KEY (${primaryKeys.join(', ')})`)
    }

    this.db.prepare(`CREATE TABLE ${this.quoteIdentifier(name)} (${definitions.join(', ')})`).run()
  }

  async dropTable(name: string) {
    assertIdentifier(name)
    this.db.prepare(`DROP TABLE ${this.quoteIdentifier(name)}`).run()
  }

  async saveTableChanges(input: SQLSaveTableChangesInput) {
    const insertedRows = input.insertedRows ?? []
    const updatedRows = input.updatedRows ?? []
    const deletedRows = input.deletedRows ?? []
    const details = await this.getTableDetails(input.table)
    const writableColumns = details.columns.map((column) => column.name)
    const keyColumns = await this.normalizePrimaryKeys(input.table, input.primaryKeys)

    this.db.exec('BEGIN')
    try {
      for (const row of insertedRows) {
        const keys = writableColumns.filter((column) => row[column] !== undefined)

        if (!keys.length) {
          this.db.prepare(`INSERT INTO ${this.quoteIdentifier(input.table)} DEFAULT VALUES`).run()
          continue
        }

        this.db
          .prepare(
            `INSERT INTO ${this.quoteIdentifier(input.table)} (${keys.map((key) => this.quoteIdentifier(key)).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          )
          .run(...keys.map((key) => row[key]))
      }

      for (const row of updatedRows) {
        const changeKeys = Object.keys(row.changes).filter((key) => row.changes[key] !== undefined)
        if (!changeKeys.length) continue

        const where = this.buildWhereClause(row.original, keyColumns)
        this.db
          .prepare(
            `UPDATE ${this.quoteIdentifier(input.table)} SET ${changeKeys.map((key) => `${this.quoteIdentifier(key)} = ?`).join(', ')} WHERE ${where.sql}`,
          )
          .run(...changeKeys.map((key) => row.changes[key]), ...where.params)
      }

      for (const row of deletedRows) {
        const where = this.buildWhereClause(row, keyColumns)
        this.db
          .prepare(`DELETE FROM ${this.quoteIdentifier(input.table)} WHERE ${where.sql}`)
          .run(...where.params)
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }

    return {
      inserted: insertedRows.length,
      updated: updatedRows.length,
      deleted: deletedRows.length,
    }
  }
}
