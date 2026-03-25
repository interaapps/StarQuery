import {
  DefaultSQLAdapter,
  type QueryResult,
  type SQLCreateTableColumnInput,
  type SQLSaveTableChangesInput,
  type SQLTableDetails,
  type SQLTableRowPage,
} from '../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import { splitSqlStatements } from '../../adapters/database/sql/shared/sql-statements.ts'

export abstract class QueryOnlySqlAdapter extends DefaultSQLAdapter {
  protected unsupported(operation: string): never {
    throw new Error(`${operation} is not supported by this datasource yet`)
  }

  async getTables(): Promise<Array<{ name: string }>> {
    this.unsupported('Listing tables')
  }

  async getTableDetails(_table: string): Promise<SQLTableDetails> {
    this.unsupported('Inspecting table details')
  }

  async getTableRows(_input: {
    table: string
    page: number
    pageSize: number
    sortBy?: string
    sortDirection?: 'asc' | 'desc'
    where?: string
  }): Promise<SQLTableRowPage> {
    this.unsupported('Browsing table rows')
  }

  async createTable(_name: string, _columns: SQLCreateTableColumnInput[]): Promise<void> {
    this.unsupported('Creating tables')
  }

  async dropTable(_name: string): Promise<void> {
    this.unsupported('Dropping tables')
  }

  async saveTableChanges(_input: SQLSaveTableChangesInput): Promise<{
    inserted: number
    updated: number
    deleted: number
  }> {
    this.unsupported('Saving table changes')
  }

  async executeStatements(sqlText: string): Promise<QueryResult[]> {
    const results: QueryResult[] = []

    for (const statement of splitSqlStatements(sqlText)) {
      results.push(await this.execute(statement))
    }

    return results
  }
}

export function createSelectResultFromRows(rows: Record<string, unknown>[]): QueryResult {
  const columns = rows.length ? Object.keys(rows[0] ?? {}) : []

  return {
    type: 'SELECT',
    columns,
    rows,
  }
}
