import type {
  SQLSaveTableChangesInput,
  SQLTableDetails,
} from '../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import { assertIdentifier } from '../../adapters/database/sql/shared/identifier.ts'
import { QueryOnlySqlAdapter } from './query-only-adapter.ts'

export abstract class ParameterizedSqlAdapter extends QueryOnlySqlAdapter {
  protected normalizeBindingValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null
    }

    if (value instanceof Date) {
      return value
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
      return value
    }

    if (ArrayBuffer.isView(value)) {
      return value
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0
    }

    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return String(value)
  }

  protected buildWhereClause(
    row: Record<string, unknown>,
    keys: string[],
    options: {
      startIndex?: number
      createPlaceholder(index: number): string
      quoteIdentifier(identifier: string): string
      mapValue?: (key: string, value: unknown) => unknown
    },
  ) {
    const clauses: string[] = []
    const params: unknown[] = []
    let parameterIndex = options.startIndex ?? 1

    for (const key of keys) {
      assertIdentifier(key)
      const rawValue = row[key]
      const value = options.mapValue
        ? options.mapValue(key, rawValue)
        : this.normalizeBindingValue(rawValue)

      if (value === null || value === undefined) {
        clauses.push(`${options.quoteIdentifier(key)} IS NULL`)
      } else {
        clauses.push(`${options.quoteIdentifier(key)} = ${options.createPlaceholder(parameterIndex)}`)
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

  protected async normalizePrimaryKeys(table: string, requestedKeys?: string[]) {
    if (requestedKeys?.length) {
      requestedKeys.forEach((key) => assertIdentifier(key))
      return requestedKeys
    }

    const details = await this.getTableDetails(table)
    return details.primaryKeys.length
      ? details.primaryKeys
      : details.columns.map((column) => column.name)
  }

  protected getWritableColumns(details: SQLTableDetails) {
    return details.columns.map((column) => column.name)
  }

  protected abstract beginTransaction(): Promise<void>
  protected abstract commitTransaction(): Promise<void>
  protected abstract rollbackTransaction(): Promise<void>
  protected abstract getQualifiedTableName(table: string): string
  protected abstract runStatement(sql: string, params?: unknown[]): Promise<void>

  async saveTableChanges(input: SQLSaveTableChangesInput) {
    const insertedRows = input.insertedRows ?? []
    const updatedRows = input.updatedRows ?? []
    const deletedRows = input.deletedRows ?? []
    const details = await this.getTableDetails(input.table)
    const writableColumns = this.getWritableColumns(details)
    const keyColumns = await this.normalizePrimaryKeys(input.table, input.primaryKeys)
    const qualifiedTableName = this.getQualifiedTableName(input.table)

    await this.beginTransaction()

    try {
      for (const row of insertedRows) {
        const keys = writableColumns.filter((column) => row[column] !== undefined)

        if (!keys.length) {
          await this.runStatement(`INSERT INTO ${qualifiedTableName} DEFAULT VALUES`)
          continue
        }

        await this.runStatement(
          `INSERT INTO ${qualifiedTableName} (${keys.map((key) => this.quoteIdentifier(key)).join(', ')}) VALUES (${keys.map((_, index) => this.createPlaceholder(index + 1)).join(', ')})`,
          keys.map((key) => this.normalizeBindingValue(row[key])),
        )
      }

      for (const row of updatedRows) {
        const changeKeys = Object.keys(row.changes).filter((key) => row.changes[key] !== undefined)
        if (!changeKeys.length) continue

        const where = this.buildWhereClause(row.original, keyColumns, {
          startIndex: changeKeys.length + 1,
          createPlaceholder: (index) => this.createPlaceholder(index),
          quoteIdentifier: (identifier) => this.quoteIdentifier(identifier),
        })

        const params = [
          ...changeKeys.map((key) => this.normalizeBindingValue(row.changes[key])),
          ...where.params,
        ]

        await this.runStatement(
          `UPDATE ${qualifiedTableName} SET ${changeKeys.map((key, index) => `${this.quoteIdentifier(key)} = ${this.createPlaceholder(index + 1)}`).join(', ')} WHERE ${where.sql}`,
          params,
        )
      }

      for (const row of deletedRows) {
        const where = this.buildWhereClause(row, keyColumns, {
          createPlaceholder: (index) => this.createPlaceholder(index),
          quoteIdentifier: (identifier) => this.quoteIdentifier(identifier),
        })
        await this.runStatement(`DELETE FROM ${qualifiedTableName} WHERE ${where.sql}`, where.params)
      }

      await this.commitTransaction()

      return {
        inserted: insertedRows.length,
        updated: updatedRows.length,
        deleted: deletedRows.length,
      }
    } catch (error) {
      await this.rollbackTransaction()
      throw error
    }
  }

  protected abstract quoteIdentifier(identifier: string): string
  protected abstract createPlaceholder(index: number): string
}
