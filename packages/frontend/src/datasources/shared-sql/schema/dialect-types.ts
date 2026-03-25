import type { SQLTableColumn, SQLEditTableColumnDraft } from '@/types/sql'
import type {
  TableCheckDraft,
  TableColumnDraft,
  TableForeignKeyDraft,
  TableIndexDraft,
  TableKeyDraft,
  TableTriggerDraft,
  TableVirtualColumnDraft,
} from '@/types/table-schema'
import type { DataSourceRecord } from '@/types/workspace'
import type { SqlDataSourceType } from '@/datasources/shared-sql/dialect-types'

export type SqlTableSchemaSourceRecord = Pick<DataSourceRecord, 'type' | 'config'>

export type RegisteredSqlTableSchemaDialect = {
  type: SqlDataSourceType
  buildMetadataQuery(input: {
    tableName: string
    source: SqlTableSchemaSourceRecord
  }): string
  buildCreateTableStatement?(input: {
    tableName: string
    definitions: string[]
  }): string
  buildTriggerSql(tableName: string, row: Record<string, unknown>): string
  parseCheckExpression(row: Record<string, unknown>): string
  getVirtualColumnStorage(row: Record<string, unknown>): TableVirtualColumnDraft['storage']
  buildColumnDefinition(column: TableColumnDraft | SQLEditTableColumnDraft): string
  buildVirtualColumnDefinition(column: TableVirtualColumnDraft): string
  buildKeyDefinition(key: TableKeyDraft): string
  buildForeignKeyDefinition(foreignKey: TableForeignKeyDraft): string
  buildCheckDefinition(check: TableCheckDraft): string
  buildIndexStatement(tableName: string, index: TableIndexDraft): string
  buildDropKeyStatement(tableName: string, key: TableKeyDraft): string
  buildDropForeignKeyStatement(tableName: string, key: TableForeignKeyDraft): string
  buildDropCheckStatement(tableName: string, check: TableCheckDraft): string
  buildDropIndexStatement(tableName: string, index: TableIndexDraft): string
  buildDropVirtualColumnStatement(tableName: string, column: TableVirtualColumnDraft): string
  buildDropTriggerStatement(tableName: string, trigger: TableTriggerDraft): string
  buildAlterTableStatements(input: {
    tableName: string
    originalColumns: SQLTableColumn[]
    nextColumns: SQLEditTableColumnDraft[]
  }): string[]
}

export function defineSqlTableSchemaDialect(dialect: RegisteredSqlTableSchemaDialect) {
  return dialect
}
