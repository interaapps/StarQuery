import { createRequire } from 'node:module'
import type oracledb from 'oracledb'
import type * as OracleDbNamespace from 'oracledb'
import type {
  QueryResult,
  SQLCreateTableColumnInput,
  SQLTableDetails,
  SQLTableRowPage,
} from '../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import { assertIdentifier } from '../../adapters/database/sql/shared/identifier.ts'
import { normalizeWhereClause } from '../../adapters/database/sql/shared/where-clause.ts'
import { createSelectResultFromRows, QueryOnlySqlAdapter } from '../shared-sql/query-only-adapter.ts'

type OracleConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
  schema?: string
}

type OracleDbModule = typeof OracleDbNamespace

type OracleColumnRow = {
  columnName: string
  dataType: string
  dataLength: number | null
  dataPrecision: number | null
  dataScale: number | null
  nullable: string
  dataDefault: string | null
  identityColumn: string | null
  isPrimaryKey: number | null
}

export class OracleSqlAdapter extends QueryOnlySqlAdapter {
  private static readonly require = createRequire(import.meta.url)
  private oracleDb!: OracleDbModule
  private connection!: oracledb.Connection

  constructor(private readonly config: OracleConfig) {
    super()
  }

  private loadOracleDbModule() {
    if (!this.oracleDb) {
      this.oracleDb = OracleSqlAdapter.require('oracledb') as OracleDbModule
    }

    return this.oracleDb
  }

  private get schema() {
    return (this.config.schema?.trim() || this.config.user).toUpperCase()
  }

  private quoteIdentifier(identifier: string) {
    assertIdentifier(identifier)
    return `"${identifier.replace(/"/g, '""')}"`
  }

  private getQualifiedTableName(table: string) {
    assertIdentifier(table)
    return `${this.quoteIdentifier(this.schema)}.${this.quoteIdentifier(table.toUpperCase())}`
  }

  private async queryRows<T extends Record<string, unknown>>(sqlText: string, binds: Record<string, unknown> = {}) {
    const oracleDb = this.loadOracleDbModule()
    const result = await this.connection.execute<T>(sqlText, binds, {
      outFormat: oracleDb.OUT_FORMAT_OBJECT,
      autoCommit: false,
    })

    return (result.rows ?? []) as T[]
  }

  private formatColumnType(row: OracleColumnRow) {
    const dataType = String(row.dataType || 'VARCHAR2').toUpperCase()

    if (['VARCHAR2', 'NVARCHAR2', 'CHAR', 'NCHAR'].includes(dataType) && row.dataLength) {
      return `${dataType}(${row.dataLength})`
    }

    if (dataType === 'NUMBER' && row.dataPrecision) {
      return `${dataType}(${row.dataPrecision}${row.dataScale !== null ? `,${row.dataScale}` : ''})`
    }

    return dataType
  }

  async connect() {
    const oracleDb = this.loadOracleDbModule()
    this.connection = await oracleDb.getConnection({
      user: this.config.user,
      password: this.config.password,
      connectString: `${this.config.host}:${this.config.port}/${this.config.database}`,
    })
  }

  async close() {
    await this.connection?.close()
  }

  async getTables() {
    const rows = await this.queryRows<{ NAME: string }>(
      `
        SELECT table_name AS "NAME"
        FROM all_tables
        WHERE owner = :schema
        ORDER BY table_name
      `,
      { schema: this.schema },
    )

    return rows.map((row) => ({ name: String(row.NAME) }))
  }

  async getTableDetails(table: string): Promise<SQLTableDetails> {
    assertIdentifier(table)
    const normalizedTable = table.toUpperCase()

    const rows = await this.queryRows<OracleColumnRow>(
      `
        SELECT
          c.column_name AS "columnName",
          c.data_type AS "dataType",
          c.data_length AS "dataLength",
          c.data_precision AS "dataPrecision",
          c.data_scale AS "dataScale",
          c.nullable AS "nullable",
          c.data_default AS "dataDefault",
          c.identity_column AS "identityColumn",
          CASE WHEN pk.column_name IS NULL THEN 0 ELSE 1 END AS "isPrimaryKey"
        FROM all_tab_columns c
        LEFT JOIN (
          SELECT cols.owner, cols.table_name, cols.column_name
          FROM all_constraints cons
          JOIN all_cons_columns cols
            ON cols.owner = cons.owner
           AND cols.constraint_name = cons.constraint_name
          WHERE cons.constraint_type = 'P'
        ) pk
          ON pk.owner = c.owner
         AND pk.table_name = c.table_name
         AND pk.column_name = c.column_name
        WHERE c.owner = :schema
          AND c.table_name = :table
        ORDER BY c.column_id
      `,
      { schema: this.schema, table: normalizedTable },
    )

    if (!rows.length) {
      throw new Error(`Table ${table} was not found`)
    }

    const columns = rows.map((row) => ({
      name: String(row.columnName),
      type: this.formatColumnType(row),
      nullable: String(row.nullable).toUpperCase() === 'Y',
      defaultValue: row.dataDefault,
      autoIncrement: String(row.identityColumn ?? '').toUpperCase() === 'YES',
      primaryKey: Boolean(row.isPrimaryKey),
    }))

    return {
      name: normalizedTable,
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

    const countRows = await this.queryRows<{ TOTAL: number }>(
      `SELECT COUNT(*) AS "TOTAL" FROM ${qualifiedTableName}${whereSql}`,
    )
    const rows = await this.queryRows<Record<string, unknown>>(
      `
        SELECT *
        FROM ${qualifiedTableName}${whereSql}
        ORDER BY ${this.quoteIdentifier(sortBy)} ${sortDirection.toUpperCase()}
        OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
      `,
      {
        offset: (page - 1) * pageSize,
        limit: pageSize,
      },
    )

    return {
      page,
      pageSize,
      total: Number(countRows[0]?.TOTAL ?? 0),
      sortBy,
      sortDirection,
      columns: details.columns,
      rows,
    }
  }

  async execute(sqlText: string): Promise<QueryResult> {
    const oracleDb = this.loadOracleDbModule()
    const result = await this.connection.execute<Record<string, unknown>>(sqlText, [], {
      outFormat: oracleDb.OUT_FORMAT_OBJECT,
      autoCommit: true,
    })

    if (Array.isArray(result.rows)) {
      return createSelectResultFromRows(result.rows as Record<string, unknown>[])
    }

    return {
      type: 'RESULT',
      result: {
        affectedRows: typeof result.rowsAffected === 'number' ? result.rowsAffected : undefined,
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
        parts.push('GENERATED BY DEFAULT AS IDENTITY')
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

    await this.connection.execute(`CREATE TABLE ${this.getQualifiedTableName(name)} (${definitions.join(', ')})`, [], {
      autoCommit: true,
    })
  }

  async dropTable(name: string) {
    assertIdentifier(name)
    await this.connection.execute(`DROP TABLE ${this.getQualifiedTableName(name)}`, [], {
      autoCommit: true,
    })
  }
}
