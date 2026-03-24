import { buildAlterTableStatements } from '@/datasources/shared-sql/schema/alter'
import { getTableSchemaSupport, quoteSqlIdentifier } from '@/datasources/shared-sql/dialect'
import { getSqlTableSchemaDialect } from '@/datasources/shared-sql/schema/dialect'
import {
  compareByName,
  compareSignature,
  draftColumnToSqlColumn,
  normalizeName,
  parseColumns,
  toAlterColumnDraft,
} from '@/datasources/shared-sql/schema/utils'
import type { DataSourceType } from '@/types/sql'
import type {
  TableCheckDraft,
  TableForeignKeyDraft,
  TableIndexDraft,
  TableKeyDraft,
  TableSchemaDraft,
  TableSchemaSectionId,
  TableSchemaSnapshot,
  TableTriggerDraft,
  TableVirtualColumnDraft,
} from '@/types/table-schema'

function normalizeTriggerSql(trigger: TableTriggerDraft) {
  const sql = trigger.sql.trim().replace(/;+\s*$/g, '')
  if (!normalizeName(trigger.name) || !sql) {
    throw new Error('Triggers require a name and SQL definition')
  }

  return sql
}

function diffNamedItems<T extends { name: string; originalName?: string }>(input: {
  previous: T[]
  next: T[]
  compare: (value: T) => string
}) {
  const previousByName = compareByName(input.previous)
  const nextByName = compareByName(input.next)

  const removed = input.previous.filter((item) => !nextByName.has(normalizeName(item.originalName || item.name)))
  const added = input.next.filter((item) => !previousByName.has(normalizeName(item.originalName || item.name)))
  const changed = input.next.filter((item) => {
    const key = normalizeName(item.originalName || item.name)
    const previousItem = previousByName.get(key)
    return previousItem ? input.compare(previousItem) !== input.compare(item) : false
  })

  return { removed, added, changed }
}

function buildAlterTableAddStatement(sourceType: DataSourceType, tableName: string, definition: string) {
  const quotedTableName = quoteSqlIdentifier(tableName, getSqlTableSchemaDialect(sourceType).type)
  return `ALTER TABLE ${quotedTableName} ADD ${definition}`
}

function buildAddForeignKeyStatement(sourceType: DataSourceType, tableName: string, key: TableForeignKeyDraft) {
  const dialect = getSqlTableSchemaDialect(sourceType)
  return buildAlterTableAddStatement(sourceType, tableName, dialect.buildForeignKeyDefinition(key))
}

function buildAddCheckStatement(sourceType: DataSourceType, tableName: string, check: TableCheckDraft) {
  const dialect = getSqlTableSchemaDialect(sourceType)
  return buildAlterTableAddStatement(sourceType, tableName, dialect.buildCheckDefinition(check))
}

function buildAddKeySql(sourceType: DataSourceType, tableName: string, key: TableKeyDraft) {
  const dialect = getSqlTableSchemaDialect(sourceType)
  return buildAlterTableAddStatement(sourceType, tableName, dialect.buildKeyDefinition(key))
}

function buildAddVirtualColumnStatement(
  sourceType: DataSourceType,
  tableName: string,
  column: TableVirtualColumnDraft,
) {
  return buildAlterTableAddStatement(
    sourceType,
    tableName,
    `COLUMN ${getSqlTableSchemaDialect(sourceType).buildVirtualColumnDefinition(column)}`,
  )
}

function supportsSection(sourceType: DataSourceType, section: TableSchemaSectionId) {
  return getTableSchemaSupport(sourceType, 'edit').editableSections.includes(section)
}

export function buildCreateTableStatements(sourceType: DataSourceType, schema: TableSchemaDraft) {
  const dialect = getSqlTableSchemaDialect(sourceType)
  const tableName = normalizeName(schema.name)
  if (!tableName) {
    throw new Error('Table name is required')
  }

  const definitions = [
    ...schema.columns.map((column) => dialect.buildColumnDefinition(column)),
    ...schema.virtualColumns.map((column) => dialect.buildVirtualColumnDefinition(column)),
    ...schema.keys.map((key) => dialect.buildKeyDefinition(key)),
    ...schema.foreignKeys.map((foreignKey) => dialect.buildForeignKeyDefinition(foreignKey)),
    ...schema.checks.map((check) => dialect.buildCheckDefinition(check)),
  ]

  if (!definitions.length) {
    throw new Error('At least one column is required')
  }

  const quotedTableName = quoteSqlIdentifier(tableName, dialect.type)

  const statements = [`CREATE TABLE ${quotedTableName} (\n  ${definitions.join(',\n  ')}\n)`]
  statements.push(...schema.indexes.map((index) => dialect.buildIndexStatement(tableName, index)))
  statements.push(...schema.triggers.map((trigger) => normalizeTriggerSql(trigger)))

  return statements
}

export function buildEditTableStatements(input: {
  sourceType: DataSourceType
  tableName: string
  original: TableSchemaSnapshot
  next: TableSchemaDraft
}) {
  const dialect = getSqlTableSchemaDialect(input.sourceType)
  const statements: string[] = []
  const tableName = normalizeName(input.tableName)

  const virtualColumnDiff = diffNamedItems({
    previous: input.original.virtualColumns,
    next: input.next.virtualColumns,
    compare: (value) =>
      compareSignature({
        name: value.name,
        type: value.type,
        expression: value.expression,
        storage: value.storage,
        nullable: value.nullable,
      }),
  })

  const keyDiff = diffNamedItems({
    previous: input.original.keys,
    next: input.next.keys,
    compare: (value) =>
      compareSignature({
        name: value.name,
        type: value.type,
        columns: parseColumns(value.columns),
      }),
  })
  const foreignKeyDiff = diffNamedItems({
    previous: input.original.foreignKeys,
    next: input.next.foreignKeys,
    compare: (value) =>
      compareSignature({
        name: value.name,
        columns: parseColumns(value.columns),
        referencedTable: value.referencedTable,
        referencedColumns: parseColumns(value.referencedColumns),
        onDelete: value.onDelete,
        onUpdate: value.onUpdate,
      }),
  })
  const checkDiff = diffNamedItems({
    previous: input.original.checks,
    next: input.next.checks,
    compare: (value) =>
      compareSignature({
        name: value.name,
        expression: value.expression.trim(),
      }),
  })
  const indexDiff = diffNamedItems({
    previous: input.original.indexes,
    next: input.next.indexes,
    compare: (value) =>
      compareSignature({
        name: value.name,
        columns: parseColumns(value.columns),
        unique: value.unique,
        method: value.method.trim().toLowerCase(),
      }),
  })
  const triggerDiff = diffNamedItems({
    previous: input.original.triggers,
    next: input.next.triggers,
    compare: (value) =>
      compareSignature({
        name: value.name,
        sql: value.sql.trim(),
      }),
  })

  if (supportsSection(input.sourceType, 'triggers')) {
    for (const item of [...triggerDiff.removed, ...triggerDiff.changed]) {
      statements.push(dialect.buildDropTriggerStatement(tableName, item))
    }
  }

  if (supportsSection(input.sourceType, 'foreignKeys')) {
    for (const item of [...foreignKeyDiff.removed, ...foreignKeyDiff.changed]) {
      statements.push(dialect.buildDropForeignKeyStatement(tableName, item))
    }
  }

  if (supportsSection(input.sourceType, 'checks')) {
    for (const item of [...checkDiff.removed, ...checkDiff.changed]) {
      statements.push(dialect.buildDropCheckStatement(tableName, item))
    }
  }

  if (supportsSection(input.sourceType, 'keys')) {
    for (const item of [...keyDiff.removed, ...keyDiff.changed]) {
      statements.push(dialect.buildDropKeyStatement(tableName, item))
    }
  }

  if (supportsSection(input.sourceType, 'indexes')) {
    for (const item of [...indexDiff.removed, ...indexDiff.changed]) {
      statements.push(dialect.buildDropIndexStatement(tableName, item))
    }
  }

  if (supportsSection(input.sourceType, 'virtualColumns')) {
    for (const item of [...virtualColumnDiff.removed, ...virtualColumnDiff.changed]) {
      statements.push(dialect.buildDropVirtualColumnStatement(tableName, item))
    }
  }

  statements.push(
    ...buildAlterTableStatements({
      sourceType: input.sourceType,
      tableName,
      originalColumns: input.original.columns.map((column) => draftColumnToSqlColumn(column)),
      nextColumns: input.next.columns.map((column) => toAlterColumnDraft(column)),
    }),
  )

  if (supportsSection(input.sourceType, 'virtualColumns')) {
    for (const item of [...virtualColumnDiff.added, ...virtualColumnDiff.changed]) {
      statements.push(buildAddVirtualColumnStatement(input.sourceType, tableName, item))
    }
  }

  if (supportsSection(input.sourceType, 'keys')) {
    for (const item of [...keyDiff.added, ...keyDiff.changed]) {
      statements.push(buildAddKeySql(input.sourceType, tableName, item))
    }
  }

  if (supportsSection(input.sourceType, 'foreignKeys')) {
    for (const item of [...foreignKeyDiff.added, ...foreignKeyDiff.changed]) {
      statements.push(buildAddForeignKeyStatement(input.sourceType, tableName, item))
    }
  }

  if (supportsSection(input.sourceType, 'checks')) {
    for (const item of [...checkDiff.added, ...checkDiff.changed]) {
      statements.push(buildAddCheckStatement(input.sourceType, tableName, item))
    }
  }

  if (supportsSection(input.sourceType, 'indexes')) {
    for (const item of [...indexDiff.added, ...indexDiff.changed]) {
      statements.push(dialect.buildIndexStatement(tableName, item))
    }
  }

  if (supportsSection(input.sourceType, 'triggers')) {
    for (const item of [...triggerDiff.added, ...triggerDiff.changed]) {
      statements.push(normalizeTriggerSql(item))
    }
  }

  return statements.filter(Boolean)
}
