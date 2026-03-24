import type { DataSourceType } from '@/types/datasources'

export type { DataSourceType } from '@/types/datasources'

export type SQLTableColumn = {
  name: string
  field: string
  type?: string
  readOnly?: boolean
  nullable?: boolean
  autoIncrement?: boolean
  primaryKey?: boolean
  defaultValue?: unknown
  enumValues?: string[]
}

export type SQLTableDetails = {
  name: string
  columns: SQLTableColumn[]
  primaryKeys: string[]
}

export type SQLTableRowState = 'clean' | 'new' | 'modified' | 'deleted'

export type SQLTableRowDraft = {
  id: string
  values: Record<string, unknown>
  original: Record<string, unknown> | null
  state: SQLTableRowState
}

export type SQLTableTabData = {
  serverId: string
  serverUrl: string
  projectId: string
  sourceId: string
  sourceName: string
  sourceType?: DataSourceType
  tableName: string
  whereClause?: string
  sortClause?: string
}

export type SQLQueryTabData = {
  serverId: string
  serverUrl: string
  projectId: string
  sourceId: string
  sourceName: string
  sourceType?: DataSourceType
  initialQuery?: string
}

export type SQLExecutionResult =
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
  | {
      type: 'error' | 'close'
      error?: unknown
      result?: {
        affectedRows?: number
      }
    }

export type SQLCreateTableColumnDraft = {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
  autoIncrement: boolean
  defaultValue: string
}

export type SQLEditTableColumnDraft = SQLCreateTableColumnDraft & {
  originalName?: string
}
