import type { DataSourceType, SQLTableColumn, SQLEditTableColumnDraft } from '@/types/sql'
import { quoteIdentifier } from '@/utils/sql-table-query'

function normalizeDefaultValue(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function buildColumnDefinition(sourceType: DataSourceType, column: SQLEditTableColumnDraft) {
  const parts = [quoteIdentifier(column.name, sourceType), column.type.trim()]

  parts.push(column.nullable ? 'NULL' : 'NOT NULL')

  const defaultValue = column.defaultValue.trim()
  if (defaultValue) {
    parts.push(`DEFAULT ${defaultValue}`)
  }

  return parts.join(' ')
}

function hasColumnChanged(original: SQLTableColumn, next: SQLEditTableColumnDraft) {
  return (
    original.name !== next.name ||
    (original.type || '').trim() !== next.type.trim() ||
    Boolean(original.nullable) !== next.nullable ||
    normalizeDefaultValue(original.defaultValue) !== next.defaultValue.trim()
  )
}

export function buildAlterTableStatements(input: {
  sourceType: DataSourceType
  tableName: string
  originalColumns: SQLTableColumn[]
  nextColumns: SQLEditTableColumnDraft[]
}) {
  const tableName = quoteIdentifier(input.tableName, input.sourceType)
  const originalByName = new Map(input.originalColumns.map((column) => [column.name, column]))
  const keptOriginalNames = new Set(
    input.nextColumns.map((column) => column.originalName).filter((value): value is string => Boolean(value)),
  )

  const statements: string[] = []

  for (const original of input.originalColumns) {
    if (!keptOriginalNames.has(original.name)) {
      statements.push(`ALTER TABLE ${tableName} DROP COLUMN ${quoteIdentifier(original.name, input.sourceType)}`)
    }
  }

  for (const column of input.nextColumns) {
    if (!column.originalName) {
      statements.push(`ALTER TABLE ${tableName} ADD COLUMN ${buildColumnDefinition(input.sourceType, column)}`)
      continue
    }

    const original = originalByName.get(column.originalName)
    if (!original || !hasColumnChanged(original, column)) {
      continue
    }

    const originalName = quoteIdentifier(original.name, input.sourceType)
    const nextName = quoteIdentifier(column.name, input.sourceType)

    if (input.sourceType === 'mysql') {
      statements.push(`ALTER TABLE ${tableName} CHANGE COLUMN ${originalName} ${buildColumnDefinition(input.sourceType, column)}`)
      continue
    }

    if (input.sourceType === 'sqlite') {
      const onlyRenameChanged =
        original.name !== column.name &&
        (original.type || '').trim() === column.type.trim() &&
        Boolean(original.nullable) === column.nullable &&
        normalizeDefaultValue(original.defaultValue) === column.defaultValue.trim()

      if (!onlyRenameChanged) {
        throw new Error('SQLite table editing currently supports adding, dropping, or renaming columns only.')
      }

      statements.push(`ALTER TABLE ${tableName} RENAME COLUMN ${originalName} TO ${nextName}`)
      continue
    }

    if (original.name !== column.name) {
      statements.push(`ALTER TABLE ${tableName} RENAME COLUMN ${originalName} TO ${nextName}`)
    }

    const targetName = original.name !== column.name ? nextName : originalName

    if ((original.type || '').trim() !== column.type.trim()) {
      statements.push(
        `ALTER TABLE ${tableName} ALTER COLUMN ${targetName} TYPE ${column.type.trim()} USING ${targetName}::${column.type.trim()}`,
      )
    }

    if (Boolean(original.nullable) !== column.nullable) {
      statements.push(
        `ALTER TABLE ${tableName} ALTER COLUMN ${targetName} ${column.nullable ? 'DROP' : 'SET'} NOT NULL`,
      )
    }

    if (normalizeDefaultValue(original.defaultValue) !== column.defaultValue.trim()) {
      statements.push(
        column.defaultValue.trim()
          ? `ALTER TABLE ${tableName} ALTER COLUMN ${targetName} SET DEFAULT ${column.defaultValue.trim()}`
          : `ALTER TABLE ${tableName} ALTER COLUMN ${targetName} DROP DEFAULT`,
      )
    }
  }

  return statements
}
