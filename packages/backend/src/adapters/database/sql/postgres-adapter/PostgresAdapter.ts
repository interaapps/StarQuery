import { Client } from 'pg'
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

export class PostgresAdapter extends DefaultSQLAdapter {
  private client!: Client

  constructor(
    private options: {
      host: string
      port?: number
      user: string
      password: string
      database: string
      schema?: string
    },
  ) {
    super()
  }

  private get schema() {
    return this.options.schema ?? 'public'
  }

  private quoteIdentifier(identifier: string) {
    assertIdentifier(identifier)
    return `"${identifier.replace(/"/g, '""')}"`
  }

  private buildWhereClause(row: Record<string, unknown>, keys: string[], startIndex = 1) {
    const clauses: string[] = []
    const params: unknown[] = []
    let parameterIndex = startIndex

    for (const key of keys) {
      assertIdentifier(key)
      const value = row[key]

      if (value === null || value === undefined) {
        clauses.push(`${this.quoteIdentifier(key)} IS NULL`)
      } else {
        clauses.push(`${this.quoteIdentifier(key)} = $${parameterIndex}`)
        params.push(value)
        parameterIndex += 1
      }
    }

    return {
      sql: clauses.join(' AND '),
      params,
      nextIndex: parameterIndex,
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
    this.client = new Client({
      host: this.options.host,
      port: this.options.port,
      user: this.options.user,
      password: this.options.password,
      database: this.options.database,
    })

    await this.client.connect()
  }

  async close() {
    await this.client?.end()
  }

  async getTables() {
    const result = await this.client.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `,
      [this.schema],
    )

    return result.rows.map((row) => ({
      name: row.table_name as string,
    }))
  }

  async getTableDetails(table: string): Promise<SQLTableDetails> {
    assertIdentifier(table)

    const result = await this.client.query(
      `
        SELECT
          columns.column_name,
          columns.data_type,
          columns.udt_name,
          columns.udt_schema,
          columns.is_nullable,
          columns.column_default,
          EXISTS (
            SELECT 1
            FROM information_schema.table_constraints constraints
            JOIN information_schema.key_column_usage key_usage
              ON key_usage.constraint_name = constraints.constraint_name
             AND key_usage.table_schema = constraints.table_schema
             AND key_usage.table_name = constraints.table_name
            WHERE constraints.constraint_type = 'PRIMARY KEY'
              AND constraints.table_schema = columns.table_schema
              AND constraints.table_name = columns.table_name
              AND key_usage.column_name = columns.column_name
          ) AS is_primary_key,
          (
            SELECT array_agg(enum_value.enumlabel ORDER BY enum_value.enumsortorder)
            FROM pg_type enum_type
            JOIN pg_namespace enum_namespace
              ON enum_namespace.oid = enum_type.typnamespace
            JOIN pg_enum enum_value
              ON enum_value.enumtypid = enum_type.oid
            WHERE enum_type.typname = columns.udt_name
              AND enum_namespace.nspname = columns.udt_schema
          ) AS enum_values
        FROM information_schema.columns columns
        WHERE columns.table_schema = $1
          AND columns.table_name = $2
        ORDER BY columns.ordinal_position
      `,
      [this.schema, table],
    )

    if (!result.rows.length) {
      throw new Error(`Table ${table} was not found`)
    }

    const columns = result.rows.map((row) => ({
      name: row.column_name as string,
      type: ((row.udt_name as string) || (row.data_type as string) || 'text').replace(/^_/, ''),
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
      autoIncrement: typeof row.column_default === 'string' && row.column_default.includes('nextval('),
      primaryKey: Boolean(row.is_primary_key),
      enumValues: Array.isArray(row.enum_values) ? (row.enum_values as string[]) : undefined,
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
    const pageSize = Math.max(input.pageSize, 1)
    const details = await this.getTableDetails(input.table)
    const sortBy = input.sortBy && details.columns.find((column) => column.name === input.sortBy) ? input.sortBy : details.primaryKeys[0] ?? details.columns[0]?.name
    const sortDirection = input.sortDirection === 'desc' ? 'desc' : 'asc'
    const whereClause = normalizeWhereClause(input.where)
    const fromSql = `FROM ${this.quoteIdentifier(this.schema)}.${this.quoteIdentifier(input.table)}${whereClause ? ` WHERE ${whereClause}` : ''}`

    const count = await this.client.query(`SELECT COUNT(*)::int AS total ${fromSql}`)

    const rows = await this.client.query(
      `
        SELECT *
        ${fromSql}
        ORDER BY ${this.quoteIdentifier(sortBy)} ${sortDirection.toUpperCase()}
        LIMIT $1
        OFFSET $2
      `,
      [pageSize, (page - 1) * pageSize],
    )

    return {
      page,
      pageSize,
      total: Number(count.rows[0]?.total ?? 0),
      sortBy,
      sortDirection,
      columns: details.columns,
      rows: rows.rows as Record<string, unknown>[],
    }
  }

  async execute(sqlText: string, params?: unknown[]): Promise<QueryResult> {
    const result = await this.client.query(sqlText, params)

    if (result.command === 'SELECT' || result.fields.length) {
      return {
        type: 'SELECT',
        rows: result.rows as Record<string, unknown>[],
        columns: result.fields.map((field) => field.name),
      }
    }

    return {
      type: 'RESULT',
      result: {
        affectedRows: result.rowCount,
        command: result.command,
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
      const parts = [
        this.quoteIdentifier(column.name),
        column.autoIncrement && /^int/i.test(column.type) ? 'SERIAL' : column.type,
      ]

      if (!column.nullable) {
        parts.push('NOT NULL')
      }

      if (column.defaultValue) {
        parts.push(`DEFAULT ${column.defaultValue}`)
      }

      return parts.join(' ')
    })

    const primaryKeys = normalized
      .filter((column) => column.primaryKey)
      .map((column) => this.quoteIdentifier(column.name))

    if (primaryKeys.length) {
      definitions.push(`PRIMARY KEY (${primaryKeys.join(', ')})`)
    }

    await this.client.query(
      `CREATE TABLE ${this.quoteIdentifier(this.schema)}.${this.quoteIdentifier(name)} (${definitions.join(', ')})`,
    )
  }

  async dropTable(name: string) {
    assertIdentifier(name)
    await this.client.query(
      `DROP TABLE ${this.quoteIdentifier(this.schema)}.${this.quoteIdentifier(name)}`,
    )
  }

  async saveTableChanges(input: SQLSaveTableChangesInput) {
    const insertedRows = input.insertedRows ?? []
    const updatedRows = input.updatedRows ?? []
    const deletedRows = input.deletedRows ?? []
    const details = await this.getTableDetails(input.table)
    const writableColumns = details.columns.map((column) => column.name)
    const keyColumns = await this.normalizePrimaryKeys(input.table, input.primaryKeys)

    await this.client.query('BEGIN')

    try {
      for (const row of insertedRows) {
        const keys = writableColumns.filter((column) => row[column] !== undefined)

        if (!keys.length) {
          await this.client.query(
            `INSERT INTO ${this.quoteIdentifier(this.schema)}.${this.quoteIdentifier(input.table)} DEFAULT VALUES`,
          )
          continue
        }

        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ')
        await this.client.query(
          `INSERT INTO ${this.quoteIdentifier(this.schema)}.${this.quoteIdentifier(input.table)} (${keys.map((key) => this.quoteIdentifier(key)).join(', ')}) VALUES (${placeholders})`,
          keys.map((key) => row[key]),
        )
      }

      for (const row of updatedRows) {
        const changeKeys = Object.keys(row.changes).filter((key) => row.changes[key] !== undefined)
        if (!changeKeys.length) continue

        const setClause = changeKeys
          .map((key, index) => `${this.quoteIdentifier(key)} = $${index + 1}`)
          .join(', ')
        const where = this.buildWhereClause(row.original, keyColumns, changeKeys.length + 1)

        await this.client.query(
          `UPDATE ${this.quoteIdentifier(this.schema)}.${this.quoteIdentifier(input.table)} SET ${setClause} WHERE ${where.sql}`,
          [...changeKeys.map((key) => row.changes[key]), ...where.params],
        )
      }

      for (const row of deletedRows) {
        const where = this.buildWhereClause(row, keyColumns)
        await this.client.query(
          `DELETE FROM ${this.quoteIdentifier(this.schema)}.${this.quoteIdentifier(input.table)} WHERE ${where.sql}`,
          where.params,
        )
      }

      await this.client.query('COMMIT')
      return {
        inserted: insertedRows.length,
        updated: updatedRows.length,
        deleted: deletedRows.length,
      }
    } catch (error) {
      await this.client.query('ROLLBACK')
      throw error
    }
  }
}
