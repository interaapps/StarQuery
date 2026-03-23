import mysql from 'mysql2/promise'
import { escapeId } from 'mysql2'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
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

export class MySQLAdapter extends DefaultSQLAdapter {
  private connection!: mysql.Connection

  constructor(
    private options: {
      host: string
      port?: number
      user: string
      password: string
      database: string
    },
  ) {
    super()
  }

  private quoteIdentifier(identifier: string) {
    assertIdentifier(identifier)
    return escapeId(identifier)
  }

  private parseEnumValues(columnType: string) {
    const match = columnType.match(/^enum\((.*)\)$/i)
    if (!match) return undefined

    const values: string[] = []
    const input = match[1]
    const valuePattern = /'((?:\\'|''|[^'])*)'/g

    for (const enumMatch of input.matchAll(valuePattern)) {
      values.push(enumMatch[1].replace(/\\'/g, "'").replace(/''/g, "'"))
    }

    return values.length ? values : undefined
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
    this.connection = await mysql.createConnection({
      host: this.options.host,
      port: this.options.port,
      user: this.options.user,
      password: this.options.password,
      database: this.options.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
  }

  async close() {
    await this.connection?.end()
  }

  async getTables() {
    const [rows] = await this.connection.query<RowDataPacket[]>(
      `
        SELECT TABLE_NAME
        FROM information_schema.tables
        WHERE table_schema = ?
        ORDER BY TABLE_NAME
      `,
      [this.options.database],
    )

    return rows.map((row) => ({
      name: row.TABLE_NAME as string,
    }))
  }

  async getTableDetails(table: string): Promise<SQLTableDetails> {
    assertIdentifier(table)

    const [rows] = await this.connection.query<RowDataPacket[]>(
      `
        SELECT
          COLUMN_NAME,
          COLUMN_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          EXTRA,
          COLUMN_KEY
        FROM information_schema.columns
        WHERE table_schema = ?
          AND table_name = ?
        ORDER BY ORDINAL_POSITION
      `,
      [this.options.database, table],
    )

    if (!rows.length) {
      throw new Error(`Table ${table} was not found`)
    }

    const columns = rows.map((row) => ({
      name: row.COLUMN_NAME as string,
      type: row.COLUMN_TYPE as string,
      nullable: row.IS_NULLABLE === 'YES',
      defaultValue: row.COLUMN_DEFAULT,
      autoIncrement: typeof row.EXTRA === 'string' && row.EXTRA.includes('auto_increment'),
      primaryKey: row.COLUMN_KEY === 'PRI',
      enumValues: this.parseEnumValues(row.COLUMN_TYPE as string),
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

    const [countRows] = await this.connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total ${fromSql}`,
    )

    const [rows] = await this.connection.query<RowDataPacket[]>(
      `
        SELECT *
        ${fromSql}
        ORDER BY ${this.quoteIdentifier(sortBy)} ${sortDirection.toUpperCase()}
        LIMIT ?
        OFFSET ?
      `,
      [pageSize, (page - 1) * pageSize],
    )

    return {
      page,
      pageSize,
      total: Number(countRows[0]?.total ?? 0),
      sortBy,
      sortDirection,
      columns: details.columns,
      rows: rows as unknown as Record<string, unknown>[],
    }
  }

  async execute(sqlText: string, params?: unknown[]): Promise<QueryResult> {
    const [result, fields] = await this.connection.query(sqlText, params)

    if (Array.isArray(result)) {
      return {
        type: 'SELECT',
        rows: result as Record<string, unknown>[],
        columns: fields.map((field) => field.name),
      }
    }

    const header = result as ResultSetHeader
    return {
      type: 'RESULT',
      result: {
        affectedRows: header.affectedRows,
        insertId: header.insertId,
        changedRows: header.changedRows,
        warningStatus: header.warningStatus,
      },
    }
  }

  async executeStatements(sqlText: string) {
    const statements = splitSqlStatements(sqlText)
    const results: QueryResult[] = []

    for (const statement of statements) {
      results.push(await this.execute(statement))
    }

    return results
  }

  async createTable(name: string, columns: SQLCreateTableColumnInput[]) {
    assertIdentifier(name)

    if (!columns.length) {
      throw new Error('At least one column is required')
    }

    const normalizedColumns = columns.map((column) => {
      assertIdentifier(column.name)

      if (!column.type?.trim()) {
        throw new Error(`Column ${column.name} requires a SQL type`)
      }

      return {
        ...column,
        nullable: column.nullable ?? true,
        autoIncrement: column.autoIncrement ?? false,
        primaryKey: column.primaryKey ?? false,
        type: column.type.trim(),
      }
    })

    const definitions = normalizedColumns.map((column) => {
      const parts = [
        this.quoteIdentifier(column.name),
        column.type,
        column.nullable ? 'NULL' : 'NOT NULL',
      ]

      if (column.defaultValue) {
        parts.push(`DEFAULT ${column.defaultValue}`)
      }

      if (column.autoIncrement) {
        parts.push('AUTO_INCREMENT')
      }

      return parts.join(' ')
    })

    const primaryKeys = normalizedColumns
      .filter((column) => column.primaryKey)
      .map((column) => this.quoteIdentifier(column.name))

    if (primaryKeys.length) {
      definitions.push(`PRIMARY KEY (${primaryKeys.join(', ')})`)
    }

    await this.connection.query(`CREATE TABLE ${this.quoteIdentifier(name)} (${definitions.join(', ')})`)
  }

  async dropTable(name: string) {
    assertIdentifier(name)
    await this.connection.query(`DROP TABLE ${this.quoteIdentifier(name)}`)
  }

  async saveTableChanges(input: SQLSaveTableChangesInput) {
    const insertedRows = input.insertedRows ?? []
    const updatedRows = input.updatedRows ?? []
    const deletedRows = input.deletedRows ?? []
    const details = await this.getTableDetails(input.table)
    const writableColumns = details.columns.map((column) => column.name)
    const keyColumns = await this.normalizePrimaryKeys(input.table, input.primaryKeys)

    await this.connection.beginTransaction()

    try {
      for (const row of insertedRows) {
        const keys = writableColumns.filter((column) => row[column] !== undefined)

        if (!keys.length) {
          await this.connection.query(`INSERT INTO ${this.quoteIdentifier(input.table)} () VALUES ()`)
          continue
        }

        const placeholders = keys.map(() => '?').join(', ')
        await this.connection.query(
          `INSERT INTO ${this.quoteIdentifier(input.table)} (${keys.map((key) => this.quoteIdentifier(key)).join(', ')}) VALUES (${placeholders})`,
          keys.map((key) => row[key]),
        )
      }

      for (const row of updatedRows) {
        const changeKeys = Object.keys(row.changes).filter((key) => row.changes[key] !== undefined)
        if (!changeKeys.length) continue

        const where = this.buildWhereClause(row.original, keyColumns)
        const setClause = changeKeys.map((key) => `${this.quoteIdentifier(key)} = ?`).join(', ')

        await this.connection.query(
          `UPDATE ${this.quoteIdentifier(input.table)} SET ${setClause} WHERE ${where.sql}`,
          [...changeKeys.map((key) => row.changes[key]), ...where.params],
        )
      }

      for (const row of deletedRows) {
        const where = this.buildWhereClause(row, keyColumns)
        await this.connection.query(
          `DELETE FROM ${this.quoteIdentifier(input.table)} WHERE ${where.sql}`,
          where.params,
        )
      }

      await this.connection.commit()
      return {
        inserted: insertedRows.length,
        updated: updatedRows.length,
        deleted: deletedRows.length,
      }
    } catch (error) {
      await this.connection.rollback()
      throw error
    }
  }
}
