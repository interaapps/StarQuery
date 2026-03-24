import type { SQLEditTableColumnDraft } from '@/types/sql'
import type { TableColumnDraft } from '@/types/table-schema'
import { quoteSqlIdentifier } from '@/datasources/shared-sql/dialect'
import { defineSqlTableSchemaDialect } from '@/datasources/shared-sql/schema/dialect-types'
import {
  columnList,
  escapeLiteral,
  normalizeDefaultValue,
  normalizeName,
  tableRef,
} from '@/datasources/shared-sql/schema/utils'

function buildSqliteColumnDefinition(column: TableColumnDraft | SQLEditTableColumnDraft) {
  if (!normalizeName(column.name)) {
    throw new Error('Columns require a name')
  }

  if (!column.type.trim()) {
    throw new Error(`Column ${column.name} requires a SQL type`)
  }

  if (column.autoIncrement && column.primaryKey) {
    return `${quoteSqlIdentifier(column.name, 'sqlite')} INTEGER PRIMARY KEY AUTOINCREMENT`
  }

  const parts = [quoteSqlIdentifier(column.name, 'sqlite'), column.type.trim()]
  parts.push(column.nullable ? 'NULL' : 'NOT NULL')

  const defaultValue = normalizeDefaultValue(column.defaultValue)
  if (defaultValue) {
    parts.push(`DEFAULT ${defaultValue}`)
  }

  return parts.join(' ')
}

function buildSqliteMetadataQuery(tableName: string) {
  const quotedTable = quoteSqlIdentifier(tableName, 'sqlite')
  const table = escapeLiteral(tableName)

  return [
    `PRAGMA index_list(${quotedTable})`,
    `
      SELECT
        name,
        sql
      FROM sqlite_master
      WHERE type = 'trigger'
        AND tbl_name = '${table}'
      ORDER BY name
    `,
  ].join(';\n')
}

function unsupportedEdit(operation: string): never {
  throw new Error(`SQLite does not support ${operation} for existing tables in this editor. Use SQL instead.`)
}

export const sqliteTableSchemaDialect = defineSqlTableSchemaDialect({
  type: 'sqlite',
  buildMetadataQuery({ tableName }) {
    return buildSqliteMetadataQuery(tableName)
  },
  buildTriggerSql(_tableName, row) {
    return String(row.definition ?? row.sql ?? '').trim()
  },
  parseCheckExpression(row) {
    return String(row.expression ?? '')
  },
  getVirtualColumnStorage() {
    return 'virtual'
  },
  buildColumnDefinition(column) {
    return buildSqliteColumnDefinition(column as TableColumnDraft)
  },
  buildVirtualColumnDefinition(column) {
    if (!normalizeName(column.name)) {
      throw new Error('Virtual columns require a name')
    }

    if (!column.type.trim()) {
      throw new Error(`Virtual column ${column.name} requires a SQL type`)
    }

    if (!column.expression.trim()) {
      throw new Error(`Virtual column ${column.name} requires an expression`)
    }

    return [
      quoteSqlIdentifier(column.name, 'sqlite'),
      column.type.trim(),
      `GENERATED ALWAYS AS (${column.expression.trim()}) ${column.storage.toUpperCase()}`,
    ].join(' ')
  },
  buildKeyDefinition(key) {
    const constraintName = normalizeName(key.name)
    const kind = key.type === 'primary' ? 'PRIMARY KEY' : 'UNIQUE'
    if (!constraintName) {
      throw new Error(`${kind} entries require a name`)
    }

    return `CONSTRAINT ${quoteSqlIdentifier(constraintName, 'sqlite')} ${kind} (${columnList(key.columns, 'sqlite')})`
  },
  buildForeignKeyDefinition(foreignKey) {
    const name = normalizeName(foreignKey.name)
    if (!name) {
      throw new Error('Foreign keys require a name')
    }

    if (!foreignKey.referencedTable.trim()) {
      throw new Error(`Foreign key ${foreignKey.name} requires a referenced table`)
    }

    const parts = [
      `CONSTRAINT ${quoteSqlIdentifier(name, 'sqlite')}`,
      `FOREIGN KEY (${columnList(foreignKey.columns, 'sqlite')})`,
      `REFERENCES ${quoteSqlIdentifier(foreignKey.referencedTable.trim(), 'sqlite')} (${columnList(foreignKey.referencedColumns, 'sqlite')})`,
    ]

    if (foreignKey.onDelete.trim()) {
      parts.push(`ON DELETE ${foreignKey.onDelete.trim()}`)
    }

    if (foreignKey.onUpdate.trim()) {
      parts.push(`ON UPDATE ${foreignKey.onUpdate.trim()}`)
    }

    return parts.join(' ')
  },
  buildCheckDefinition(check) {
    const name = normalizeName(check.name)
    if (!name) {
      throw new Error('Checks require a name')
    }

    if (!check.expression.trim()) {
      throw new Error(`Check ${check.name} requires an expression`)
    }

    return `CONSTRAINT ${quoteSqlIdentifier(name, 'sqlite')} CHECK (${check.expression.trim()})`
  },
  buildIndexStatement(tableName, index) {
    const name = normalizeName(index.name)
    if (!name) {
      throw new Error('Indexes require a name')
    }

    return `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${quoteSqlIdentifier(name, 'sqlite')} ON ${tableRef(tableName, 'sqlite')} (${columnList(index.columns, 'sqlite')})`
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
  buildDropIndexStatement(_tableName, index) {
    const name = normalizeName(index.originalName || index.name)
    return `DROP INDEX ${quoteSqlIdentifier(name, 'sqlite')}`
  },
  buildDropVirtualColumnStatement(tableName, column) {
    const name = normalizeName(column.originalName || column.name)
    return `ALTER TABLE ${tableRef(tableName, 'sqlite')} DROP COLUMN ${quoteSqlIdentifier(name, 'sqlite')}`
  },
  buildDropTriggerStatement(_tableName, trigger) {
    const name = normalizeName(trigger.originalName || trigger.name)
    return `DROP TRIGGER IF EXISTS ${quoteSqlIdentifier(name, 'sqlite')}`
  },
  buildAlterTableStatements({ tableName, originalColumns, nextColumns }) {
    const quotedTableName = tableRef(tableName, 'sqlite')
    const originalByName = new Map(originalColumns.map((column) => [column.name, column]))
    const keptOriginalNames = new Set(
      nextColumns.map((column) => column.originalName).filter((value): value is string => Boolean(value)),
    )

    const statements: string[] = []

    for (const original of originalColumns) {
      if (!keptOriginalNames.has(original.name)) {
        statements.push(
          `ALTER TABLE ${quotedTableName} DROP COLUMN ${quoteSqlIdentifier(original.name, 'sqlite')}`,
        )
      }
    }

    for (const column of nextColumns) {
      if (!column.originalName) {
        statements.push(`ALTER TABLE ${quotedTableName} ADD COLUMN ${buildSqliteColumnDefinition(column)}`)
        continue
      }

      const original = originalByName.get(column.originalName)
      if (!original) {
        continue
      }

      const onlyRenameChanged =
        original.name !== column.name &&
        (original.type || '').trim() === column.type.trim() &&
        Boolean(original.nullable) === column.nullable &&
        normalizeDefaultValue(original.defaultValue) === normalizeDefaultValue(column.defaultValue)

      const unchanged =
        original.name === column.name &&
        (original.type || '').trim() === column.type.trim() &&
        Boolean(original.nullable) === column.nullable &&
        normalizeDefaultValue(original.defaultValue) === normalizeDefaultValue(column.defaultValue)

      if (unchanged) {
        continue
      }

      if (!onlyRenameChanged) {
        throw new Error('SQLite table editing currently supports adding, dropping, or renaming columns only.')
      }

      statements.push(
        `ALTER TABLE ${quotedTableName} RENAME COLUMN ${quoteSqlIdentifier(original.name, 'sqlite')} TO ${quoteSqlIdentifier(column.name, 'sqlite')}`,
      )
    }

    return statements
  },
})
