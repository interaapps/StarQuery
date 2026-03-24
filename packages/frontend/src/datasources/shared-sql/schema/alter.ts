import type { DataSourceType, SQLTableColumn, SQLEditTableColumnDraft } from '@/types/sql'
import { getSqlTableSchemaDialect } from '@/datasources/shared-sql/schema/dialect'

export function buildAlterTableStatements(input: {
  sourceType: DataSourceType
  tableName: string
  originalColumns: SQLTableColumn[]
  nextColumns: SQLEditTableColumnDraft[]
}) {
  return getSqlTableSchemaDialect(input.sourceType).buildAlterTableStatements({
    tableName: input.tableName,
    originalColumns: input.originalColumns,
    nextColumns: input.nextColumns,
  })
}
