import mssql from 'mssql'
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

type MssqlConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
  schema?: string
  ssl?: boolean
}

type MssqlMetadataRow = {
  columnName: string
  dataType: string
  characterMaximumLength: number | null
  numericPrecision: number | null
  numericScale: number | null
  isNullable: string
  columnDefault: unknown
  isIdentity: number | null
  isPrimaryKey: number | null
}

export class MssqlSqlAdapter extends ParameterizedSqlAdapter {
  private pool!: mssql.ConnectionPool
  private transaction: mssql.Transaction | null = null

  constructor(private readonly config: MssqlConfig) {
    super()
  }

  private get schema() {
    return this.config.schema?.trim() || 'dbo'
  }

  protected quoteIdentifier(identifier: string) {
    assertIdentifier(identifier)
    return `[${identifier.replace(/]/g, ']]')}]`
  }

  protected createPlaceholder(index: number) {
    return `@p${index}`
  }

  protected getQualifiedTableName(table: string) {
    assertIdentifier(table)
    return `${this.quoteIdentifier(this.schema)}.${this.quoteIdentifier(table)}`
  }

  private createRequest(
    params: unknown[] = [],
    source: mssql.ConnectionPool | mssql.Transaction = this.transaction ?? this.pool,
  ) {
    const request = source.request()
    params.forEach((value, index) => {
      request.input(`p${index + 1}`, this.normalizeBindingValue(value) as never)
    })
    return request
  }

  private async queryRows<T extends Record<string, unknown>>(sqlText: string, params: unknown[] = []) {
    const result = await this.createRequest(params).query<T>(sqlText)
    return result.recordset
  }

  private formatColumnType(row: MssqlMetadataRow) {
    const dataType = String(row.dataType || 'nvarchar').toLowerCase()

    if (
      ['varchar', 'nvarchar', 'char', 'nchar', 'binary', 'varbinary'].includes(dataType) &&
      row.characterMaximumLength !== null
    ) {
      return `${dataType}(${row.characterMaximumLength === -1 ? 'max' : row.characterMaximumLength})`
    }

    if (['decimal', 'numeric'].includes(dataType) && row.numericPrecision !== null) {
      return `${dataType}(${row.numericPrecision},${row.numericScale ?? 0})`
    }

    return dataType
  }

  async connect() {
    this.pool = await new mssql.ConnectionPool({
      server: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      options: {
        trustServerCertificate: true,
        encrypt: this.config.ssl ?? false,
      },
    }).connect()
  }

  async close() {
    await this.transaction?.rollback().catch(() => undefined)
    this.transaction = null
    await this.pool?.close()
  }

  protected async beginTransaction() {
    this.transaction = new mssql.Transaction(this.pool)
    await this.transaction.begin()
  }

  protected async commitTransaction() {
    if (!this.transaction) {
      return
    }

    await this.transaction.commit()
    this.transaction = null
  }

  protected async rollbackTransaction() {
    if (!this.transaction) {
      return
    }

    await this.transaction.rollback().catch(() => undefined)
    this.transaction = null
  }

  protected async runStatement(sqlText: string, params: unknown[] = []) {
    await this.createRequest(params).query(sqlText)
  }

  async getTables() {
    const rows = await this.queryRows<{ name: string }>(
      `
        SELECT TABLE_NAME AS name
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
          AND TABLE_SCHEMA = @p1
        ORDER BY TABLE_NAME
      `,
      [this.schema],
    )

    return rows.map((row) => ({ name: String(row.name) }))
  }

  async getTableDetails(table: string): Promise<SQLTableDetails> {
    assertIdentifier(table)

    const rows = await this.queryRows<MssqlMetadataRow>(
      `
        SELECT
          c.COLUMN_NAME AS columnName,
          c.DATA_TYPE AS dataType,
          c.CHARACTER_MAXIMUM_LENGTH AS characterMaximumLength,
          c.NUMERIC_PRECISION AS numericPrecision,
          c.NUMERIC_SCALE AS numericScale,
          c.IS_NULLABLE AS isNullable,
          c.COLUMN_DEFAULT AS columnDefault,
          COLUMNPROPERTY(OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME)), c.COLUMN_NAME, 'IsIdentity') AS isIdentity,
          CASE WHEN pk.COLUMN_NAME IS NULL THEN 0 ELSE 1 END AS isPrimaryKey
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
          SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON ku.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
           AND ku.TABLE_SCHEMA = tc.TABLE_SCHEMA
           AND ku.TABLE_NAME = tc.TABLE_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        ) pk
          ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA
         AND pk.TABLE_NAME = c.TABLE_NAME
         AND pk.COLUMN_NAME = c.COLUMN_NAME
        WHERE c.TABLE_SCHEMA = @p1
          AND c.TABLE_NAME = @p2
        ORDER BY c.ORDINAL_POSITION
      `,
      [this.schema, table],
    )

    if (!rows.length) {
      throw new Error(`Table ${table} was not found`)
    }

    const columns = rows.map((row) => ({
      name: String(row.columnName),
      type: this.formatColumnType(row),
      nullable: String(row.isNullable).toUpperCase() === 'YES',
      defaultValue: row.columnDefault,
      autoIncrement: Boolean(row.isIdentity),
      primaryKey: Boolean(row.isPrimaryKey),
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
    const whereSql = whereClause ? ` WHERE ${whereClause}` : ''
    const qualifiedTableName = this.getQualifiedTableName(input.table)

    const countRows = await this.queryRows<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ${qualifiedTableName}${whereSql}`,
    )
    const rows = await this.queryRows<Record<string, unknown>>(
      `
        SELECT *
        FROM ${qualifiedTableName}${whereSql}
        ORDER BY ${this.quoteIdentifier(sortBy)} ${sortDirection.toUpperCase()}
        OFFSET @p1 ROWS FETCH NEXT @p2 ROWS ONLY
      `,
      [(page - 1) * pageSize, pageSize],
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
    const result = await this.pool.request().query(sqlText)

    if (Array.isArray(result.recordset)) {
      return createSelectResultFromRows(result.recordset as Record<string, unknown>[])
    }

    return {
      type: 'RESULT',
      result: {
        affectedRows: Array.isArray(result.rowsAffected)
          ? result.rowsAffected.reduce((total, value) => total + Number(value ?? 0), 0)
          : undefined,
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
      const parts = [this.quoteIdentifier(column.name), column.type]

      if (column.autoIncrement) {
        parts.push('IDENTITY(1,1)')
      }

      parts.push(column.nullable ? 'NULL' : 'NOT NULL')

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

    await this.pool.request().query(`CREATE TABLE ${this.getQualifiedTableName(name)} (${definitions.join(', ')})`)
  }

  async dropTable(name: string) {
    assertIdentifier(name)
    await this.pool.request().query(`DROP TABLE ${this.getQualifiedTableName(name)}`)
  }
}
