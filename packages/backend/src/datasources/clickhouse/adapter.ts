import { createClient, type ClickHouseClient } from '@clickhouse/client'
import type {
  QueryResult,
  SQLCreateTableColumnInput,
  SQLTableDetails,
  SQLTableRowPage,
} from '../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import { assertIdentifier } from '../../adapters/database/sql/shared/identifier.ts'
import { normalizeWhereClause } from '../../adapters/database/sql/shared/where-clause.ts'
import { createSelectResultFromRows, QueryOnlySqlAdapter } from '../shared-sql/query-only-adapter.ts'

type ClickHouseConfig = {
  host: string
  port: number
  user?: string
  password?: string
  database?: string
  ssl?: boolean
}

type ClickHouseTableRow = {
  name: string
}

type ClickHouseColumnRow = {
  name: string
  type: string
  defaultExpression?: string | null
  isInPrimaryKey?: number | string
}

function isSelectLikeStatement(sqlText: string) {
  return /^(select|show|describe|desc|with|explain)\b/i.test(sqlText.trim())
}

export class ClickHouseSqlAdapter extends QueryOnlySqlAdapter {
  private client!: ClickHouseClient

  constructor(private readonly config: ClickHouseConfig) {
    super()
  }

  private get database() {
    return this.config.database?.trim() || 'default'
  }

  private quoteIdentifier(identifier: string) {
    assertIdentifier(identifier)
    return `\`${identifier.replace(/`/g, '``')}\``
  }

  private async queryRows<T extends Record<string, unknown>>(sqlText: string, queryParams?: Record<string, unknown>) {
    const response = await this.client.query({
      query: `${sqlText} FORMAT JSON`,
      format: 'JSON',
      query_params: queryParams,
    })
    const body = (await response.json()) as {
      data?: T[]
    }

    return Array.isArray(body.data) ? body.data : []
  }

  async connect() {
    const protocol = this.config.ssl ? 'https' : 'http'
    this.client = createClient({
      url: `${protocol}://${this.config.host}:${this.config.port}`,
      username: this.config.user,
      password: this.config.password,
      database: this.database,
    })
  }

  async close() {
    await this.client?.close()
  }

  async getTables() {
    const rows = await this.queryRows<ClickHouseTableRow>(
      `
        SELECT name
        FROM system.tables
        WHERE database = {database:String}
        ORDER BY name
      `,
      { database: this.database },
    )

    return rows.map((row) => ({ name: String(row.name) }))
  }

  async getTableDetails(table: string): Promise<SQLTableDetails> {
    assertIdentifier(table)

    const rows = await this.queryRows<ClickHouseColumnRow>(
      `
        SELECT
          name,
          type,
          default_expression AS defaultExpression,
          is_in_primary_key AS isInPrimaryKey
        FROM system.columns
        WHERE database = {database:String}
          AND table = {table:String}
        ORDER BY position
      `,
      { database: this.database, table },
    )

    if (!rows.length) {
      throw new Error(`Table ${table} was not found`)
    }

    const columns = rows.map((row) => ({
      name: String(row.name),
      type: String(row.type),
      nullable: /^Nullable\(/.test(String(row.type)),
      defaultValue: row.defaultExpression ?? null,
      autoIncrement: false,
      primaryKey:
        row.isInPrimaryKey === 1 ||
        row.isInPrimaryKey === '1' ||
        String(row.isInPrimaryKey ?? '') === 'true',
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
    const quotedTableName = this.quoteIdentifier(input.table)
    const whereSql = whereClause ? ` WHERE ${whereClause}` : ''

    const countRows = await this.queryRows<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ${quotedTableName}${whereSql}`,
    )
    const rows = await this.queryRows<Record<string, unknown>>(
      `
        SELECT *
        FROM ${quotedTableName}${whereSql}
        ORDER BY ${this.quoteIdentifier(sortBy)} ${sortDirection.toUpperCase()}
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
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
    if (isSelectLikeStatement(sqlText)) {
      const rows = await this.queryRows<Record<string, unknown>>(sqlText)
      return createSelectResultFromRows(rows)
    }

    await this.client.command({ query: sqlText })
    return {
      type: 'RESULT',
      result: {
        command: 'COMMAND',
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
      }
    })

    const definitions = normalized.map((column) => {
      const nextType =
        column.nullable && !/^Nullable\(/i.test(column.type) ? `Nullable(${column.type})` : column.type
      const parts = [this.quoteIdentifier(column.name), nextType]

      if (column.defaultValue) {
        parts.push(`DEFAULT ${column.defaultValue}`)
      }

      return parts.join(' ')
    })

    const orderByColumns = normalized
      .filter((column) => column.primaryKey)
      .map((column) => this.quoteIdentifier(column.name))

    await this.client.command({
      query: `CREATE TABLE ${this.quoteIdentifier(name)} (${definitions.join(', ')}) ENGINE = MergeTree ORDER BY ${orderByColumns.length ? `(${orderByColumns.join(', ')})` : 'tuple()'}`,
    })
  }

  async dropTable(name: string) {
    assertIdentifier(name)
    await this.client.command({
      query: `DROP TABLE ${this.quoteIdentifier(name)}`,
    })
  }
}
