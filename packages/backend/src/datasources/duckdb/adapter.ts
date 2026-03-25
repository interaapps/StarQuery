import { createRequire } from 'node:module'
import type * as DuckDbNamespace from '@duckdb/node-api'
import type {
  QueryResult,
  SQLCreateTableColumnInput,
  SQLTableDetails,
  SQLTableRowPage,
} from '../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import { assertIdentifier } from '../../adapters/database/sql/shared/identifier.ts'
import { normalizeWhereClause } from '../../adapters/database/sql/shared/where-clause.ts'
import { createSelectResultFromRows } from '../shared-sql/query-only-adapter.ts'
import { ParameterizedSqlAdapter } from '../shared-sql/parameterized-adapter.ts'
import type { DuckDBInstance } from '@duckdb/node-api'

type DuckDbConfig = {
  filePath: string
}

type DuckDbModule = typeof DuckDbNamespace

type DuckDbTableInfoRow = {
  name: string
  type: string
  notnull: boolean | number
  dflt_value: unknown
  pk: boolean | number
}

export class DuckDbSqlAdapter extends ParameterizedSqlAdapter {
  private instance!: DuckDBInstance
  private connection!: Awaited<ReturnType<DuckDBInstance['connect']>>
  private static readonly require = createRequire(import.meta.url)

  constructor(private readonly config: DuckDbConfig) {
    super()
  }

  protected quoteIdentifier(identifier: string) {
    assertIdentifier(identifier)
    return `"${identifier.replace(/"/g, '""')}"`
  }

  protected createPlaceholder() {
    return '?'
  }

  protected getQualifiedTableName(table: string) {
    assertIdentifier(table)
    return this.quoteIdentifier(table)
  }

  protected async beginTransaction() {
    await this.connection.run('BEGIN')
  }

  protected async commitTransaction() {
    await this.connection.run('COMMIT')
  }

  protected async rollbackTransaction() {
    await this.connection.run('ROLLBACK').catch(() => undefined)
  }

  protected async runStatement(sqlText: string, params: unknown[] = []) {
    await this.connection.run(sqlText, params.map((value) => this.normalizeBindingValue(value)) as never)
  }

  private async queryRows<T extends Record<string, unknown>>(sqlText: string, params: unknown[] = []) {
    const reader = await this.connection.runAndReadAll(
      sqlText,
      params.map((value) => this.normalizeBindingValue(value)) as never,
    )
    return reader.getRowObjectsJS() as T[]
  }

  private loadDuckDbModule(): DuckDbModule {
    return DuckDbSqlAdapter.require('@duckdb/node-api') as DuckDbModule
  }

  async connect() {
    const { DuckDBInstance } = this.loadDuckDbModule()
    this.instance = await DuckDBInstance.create(this.config.filePath)
    this.connection = await this.instance.connect()
  }

  async close() {
    this.connection?.closeSync()
  }

  async getTables() {
    const rows = await this.queryRows<{ name: string }>(
      `
        SELECT table_name AS name
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ('information_schema', 'pg_catalog')
        ORDER BY table_schema, table_name
      `,
    )

    return rows.map((row) => ({ name: String(row.name) }))
  }

  async getTableDetails(table: string): Promise<SQLTableDetails> {
    assertIdentifier(table)

    const rows = await this.queryRows<DuckDbTableInfoRow>(
      `PRAGMA table_info(${this.quoteIdentifier(table)})`,
    )

    if (!rows.length) {
      throw new Error(`Table ${table} was not found`)
    }

    const columns = rows.map((row) => ({
      name: String(row.name),
      type: String(row.type || 'VARCHAR'),
      nullable: !row.notnull,
      defaultValue: row.dflt_value,
      autoIncrement: false,
      primaryKey: Boolean(row.pk),
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
    const sortBy =
      input.sortBy && details.columns.find((column) => column.name === input.sortBy)
        ? input.sortBy
        : details.primaryKeys[0] ?? details.columns[0]?.name
    const sortDirection = input.sortDirection === 'desc' ? 'desc' : 'asc'
    const whereClause = normalizeWhereClause(input.where)
    const fromSql = `FROM ${this.getQualifiedTableName(input.table)}${whereClause ? ` WHERE ${whereClause}` : ''}`

    const countRows = await this.queryRows<{ total: number }>(`SELECT COUNT(*) AS total ${fromSql}`)
    const rows = await this.queryRows<Record<string, unknown>>(
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
      rows,
    }
  }

  async execute(sqlText: string): Promise<QueryResult> {
    const reader = await this.connection.runAndReadAll(sqlText)
    const rows = reader.getRowObjectsJS() as Record<string, unknown>[]

    if (rows.length || reader.columnCount > 0) {
      return createSelectResultFromRows(rows)
    }

    return {
      type: 'RESULT',
      result: {
        affectedRows: reader.rowsChanged,
      },
    }
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
        return `${this.quoteIdentifier(column.name)} INTEGER PRIMARY KEY`
      }

      const parts = [this.quoteIdentifier(column.name), column.type]
      parts.push(column.nullable ? 'NULL' : 'NOT NULL')

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

    await this.connection.run(`CREATE TABLE ${this.quoteIdentifier(name)} (${definitions.join(', ')})`)
  }

  async dropTable(name: string) {
    assertIdentifier(name)
    await this.connection.run(`DROP TABLE ${this.quoteIdentifier(name)}`)
  }
}
