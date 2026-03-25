import type { SQLEditTableColumnDraft } from '@/types/sql'
import type {
  TableCheckDraft,
  TableColumnDraft,
  TableForeignKeyDraft,
  TableIndexDraft,
  TableKeyDraft,
  TableTriggerDraft,
  TableVirtualColumnDraft,
} from '@/types/table-schema'
import { quoteSqlIdentifier } from '@/datasources/shared-sql/dialect'
import { defineSqlTableSchemaDialect } from '@/datasources/shared-sql/schema/dialect-types'
import {
  normalizeDefaultValue,
  normalizeName,
  tableRef,
} from '@/datasources/shared-sql/schema/utils'

function emptySelect(columns: string[]) {
  return `SELECT ${columns.join(', ')} WHERE 1 = 0`
}

function buildDuckDbColumnDefinition(column: TableColumnDraft | SQLEditTableColumnDraft) {
  if (!normalizeName(column.name)) {
    throw new Error('Columns require a name')
  }

  if (!column.type.trim()) {
    throw new Error(`Column ${column.name} requires a SQL type`)
  }

  const parts = [quoteSqlIdentifier(column.name, 'duckdb'), column.type.trim()]
  parts.push(column.nullable ? 'NULL' : 'NOT NULL')

  const defaultValue = normalizeDefaultValue(column.defaultValue)
  if (defaultValue) {
    parts.push(`DEFAULT ${defaultValue}`)
  }

  return parts.join(' ')
}

function unsupportedEdit(operation: string): never {
  throw new Error(`DuckDB schema editing does not support ${operation} in this editor yet.`)
}

export const duckDbTableSchemaDialect = defineSqlTableSchemaDialect({
  type: 'duckdb',
  buildMetadataQuery() {
    return [
      emptySelect([
        'CAST(NULL AS VARCHAR) AS name',
        'CAST(NULL AS VARCHAR) AS constraint_type',
        'CAST(NULL AS VARCHAR) AS column_names',
      ]),
      emptySelect([
        'CAST(NULL AS VARCHAR) AS name',
        'CAST(NULL AS VARCHAR) AS column_names',
        'CAST(NULL AS VARCHAR) AS referenced_table',
        'CAST(NULL AS VARCHAR) AS referenced_column_names',
        'CAST(NULL AS VARCHAR) AS delete_rule',
        'CAST(NULL AS VARCHAR) AS update_rule',
      ]),
      emptySelect([
        'CAST(NULL AS VARCHAR) AS name',
        'FALSE AS is_unique',
        'CAST(NULL AS VARCHAR) AS index_method',
        'CAST(NULL AS VARCHAR) AS column_names',
      ]),
      emptySelect(['CAST(NULL AS VARCHAR) AS name', 'CAST(NULL AS VARCHAR) AS expression']),
      emptySelect([
        'CAST(NULL AS VARCHAR) AS name',
        'CAST(NULL AS VARCHAR) AS timing',
        'CAST(NULL AS VARCHAR) AS event_name',
        'CAST(NULL AS VARCHAR) AS action_statement',
      ]),
      emptySelect([
        'CAST(NULL AS VARCHAR) AS name',
        'CAST(NULL AS VARCHAR) AS column_type',
        'CAST(NULL AS VARCHAR) AS is_nullable',
        'CAST(NULL AS VARCHAR) AS generation_expression',
      ]),
    ].join(';\n')
  },
  buildTriggerSql() {
    unsupportedEdit('triggers')
  },
  parseCheckExpression(row) {
    return String(row.expression ?? '')
  },
  getVirtualColumnStorage() {
    return 'virtual'
  },
  buildColumnDefinition(column) {
    return buildDuckDbColumnDefinition(column)
  },
  buildVirtualColumnDefinition() {
    unsupportedEdit('virtual columns')
  },
  buildKeyDefinition(_key: TableKeyDraft) {
    unsupportedEdit('keys')
  },
  buildForeignKeyDefinition(_foreignKey: TableForeignKeyDraft) {
    unsupportedEdit('foreign keys')
  },
  buildCheckDefinition(_check: TableCheckDraft) {
    unsupportedEdit('checks')
  },
  buildIndexStatement(_tableName: string, _index: TableIndexDraft) {
    unsupportedEdit('indexes')
  },
  buildDropKeyStatement() {
    unsupportedEdit('dropping keys')
  },
  buildDropForeignKeyStatement() {
    unsupportedEdit('dropping foreign keys')
  },
  buildDropCheckStatement() {
    unsupportedEdit('dropping checks')
  },
  buildDropIndexStatement() {
    unsupportedEdit('dropping indexes')
  },
  buildDropVirtualColumnStatement() {
    unsupportedEdit('dropping virtual columns')
  },
  buildDropTriggerStatement() {
    unsupportedEdit('dropping triggers')
  },
  buildAlterTableStatements({ tableName, originalColumns, nextColumns }) {
    const quotedTableName = tableRef(tableName, 'duckdb')
    const originalByName = new Map(originalColumns.map((column) => [column.name, column]))
    const keptOriginalNames = new Set(
      nextColumns.map((column) => column.originalName).filter((value): value is string => Boolean(value)),
    )

    const statements: string[] = []

    for (const original of originalColumns) {
      if (!keptOriginalNames.has(original.name)) {
        statements.push(`ALTER TABLE ${quotedTableName} DROP COLUMN ${quoteSqlIdentifier(original.name, 'duckdb')}`)
      }
    }

    for (const column of nextColumns) {
      if (!column.originalName) {
        statements.push(`ALTER TABLE ${quotedTableName} ADD COLUMN ${buildDuckDbColumnDefinition(column)}`)
        continue
      }

      const original = originalByName.get(column.originalName)
      if (!original) {
        continue
      }

      const unchanged =
        original.name === column.name &&
        (original.type || '').trim() === column.type.trim() &&
        Boolean(original.nullable) === column.nullable &&
        normalizeDefaultValue(original.defaultValue) === normalizeDefaultValue(column.defaultValue)

      if (unchanged) {
        continue
      }

      const originalName = quoteSqlIdentifier(original.name, 'duckdb')
      const nextName = quoteSqlIdentifier(column.name, 'duckdb')
      const targetName = original.name !== column.name ? nextName : originalName

      if (original.name !== column.name) {
        statements.push(`ALTER TABLE ${quotedTableName} RENAME COLUMN ${originalName} TO ${nextName}`)
      }

      if ((original.type || '').trim() !== column.type.trim()) {
        statements.push(`ALTER TABLE ${quotedTableName} ALTER COLUMN ${targetName} TYPE ${column.type.trim()}`)
      }

      if (Boolean(original.nullable) !== column.nullable) {
        statements.push(`ALTER TABLE ${quotedTableName} ALTER COLUMN ${targetName} ${column.nullable ? 'DROP' : 'SET'} NOT NULL`)
      }

      if (normalizeDefaultValue(original.defaultValue) !== normalizeDefaultValue(column.defaultValue)) {
        statements.push(
          normalizeDefaultValue(column.defaultValue)
            ? `ALTER TABLE ${quotedTableName} ALTER COLUMN ${targetName} SET DEFAULT ${normalizeDefaultValue(column.defaultValue)}`
            : `ALTER TABLE ${quotedTableName} ALTER COLUMN ${targetName} DROP DEFAULT`,
        )
      }
    }

    return statements
  },
})
