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
import { normalizeDefaultValue } from '@/datasources/shared-sql/schema/utils'

function unsupportedEdit(operation: string): never {
  throw new Error(`ClickHouse schema editing does not support ${operation} in this editor yet.`)
}

function emptySelect(columns: string[]) {
  return `SELECT ${columns.join(', ')} LIMIT 0`
}

function normalizeClickHouseType(type: string, nullable: boolean) {
  const trimmedType = type.trim()
  const nullableMatch = trimmedType.match(/^Nullable\((.*)\)$/i)
  const baseType = nullableMatch ? nullableMatch[1].trim() : trimmedType
  return nullable ? `Nullable(${baseType})` : baseType
}

function buildClickHouseColumnDefinition(column: TableColumnDraft | SQLEditTableColumnDraft) {
  if (!column.name.trim()) {
    throw new Error('Columns require a name')
  }

  if (!column.type.trim()) {
    throw new Error(`Column ${column.name} requires a SQL type`)
  }

  const parts = [quoteSqlIdentifier(column.name, 'clickhouse'), normalizeClickHouseType(column.type, column.nullable)]
  const defaultValue = normalizeDefaultValue(column.defaultValue)
  if (defaultValue) {
    parts.push(`DEFAULT ${defaultValue}`)
  }

  return parts.join(' ')
}

export const clickHouseTableSchemaDialect = defineSqlTableSchemaDialect({
  type: 'clickhouse',
  buildMetadataQuery() {
    return [
      emptySelect(["'' AS name", "'' AS constraint_type", "'' AS column_names"]),
      emptySelect([
        "'' AS name",
        "'' AS column_names",
        "'' AS referenced_table",
        "'' AS referenced_column_names",
        "'' AS delete_rule",
        "'' AS update_rule",
      ]),
      emptySelect(["'' AS name", '0 AS is_unique', "'' AS index_method", "'' AS column_names"]),
      emptySelect(["'' AS name", "'' AS expression"]),
      emptySelect(["'' AS name", "'' AS timing", "'' AS event_name", "'' AS action_statement"]),
      emptySelect(["'' AS name", "'' AS column_type", "'' AS is_nullable", "'' AS generation_expression"]),
    ].join(';\n')
  },
  buildCreateTableStatement({ tableName, definitions }) {
    const quotedTableName = quoteSqlIdentifier(tableName, 'clickhouse')
    return `CREATE TABLE ${quotedTableName} (\n  ${definitions.join(',\n  ')}\n)\nENGINE = MergeTree\nORDER BY tuple()`
  },
  buildTriggerSql() {
    unsupportedEdit('creating triggers')
  },
  parseCheckExpression(row) {
    return String(row.expression ?? '')
  },
  getVirtualColumnStorage() {
    return 'virtual'
  },
  buildColumnDefinition(column) {
    return buildClickHouseColumnDefinition(column)
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
    const quotedTableName = quoteSqlIdentifier(tableName, 'clickhouse')
    const originalByName = new Map(originalColumns.map((column) => [column.name, column]))
    const keptOriginalNames = new Set(
      nextColumns.map((column) => column.originalName).filter((value): value is string => Boolean(value)),
    )

    const statements: string[] = []

    for (const original of originalColumns) {
      if (!keptOriginalNames.has(original.name)) {
        statements.push(`ALTER TABLE ${quotedTableName} DROP COLUMN ${quoteSqlIdentifier(original.name, 'clickhouse')}`)
      }
    }

    for (const column of nextColumns) {
      if (!column.originalName) {
        statements.push(`ALTER TABLE ${quotedTableName} ADD COLUMN ${buildClickHouseColumnDefinition(column)}`)
        continue
      }

      const original = originalByName.get(column.originalName)
      if (!original) {
        continue
      }

      const originalType = normalizeClickHouseType(original.type || 'String', Boolean(original.nullable))
      const nextType = normalizeClickHouseType(column.type, column.nullable)
      const originalDefault = normalizeDefaultValue(original.defaultValue)
      const nextDefault = normalizeDefaultValue(column.defaultValue)

      const unchanged =
        original.name === column.name &&
        originalType === nextType &&
        originalDefault === nextDefault

      if (unchanged) {
        continue
      }

      const currentName = quoteSqlIdentifier(original.name, 'clickhouse')
      const nextName = quoteSqlIdentifier(column.name, 'clickhouse')
      const targetName = original.name !== column.name ? nextName : currentName

      if (original.name !== column.name) {
        statements.push(`ALTER TABLE ${quotedTableName} RENAME COLUMN ${currentName} TO ${nextName}`)
      }

      if (originalType !== nextType || originalDefault !== nextDefault) {
        statements.push(
          `ALTER TABLE ${quotedTableName} MODIFY COLUMN ${targetName} ${nextType}${nextDefault ? ` DEFAULT ${nextDefault}` : ''}`,
        )
      }
    }

    return statements
  },
})
