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
import { quoteSqlIdentifier } from '@/datasources/shared-sql/dialect'
import { defineSqlTableSchemaDialect } from '@/datasources/shared-sql/schema/dialect-types'
import {
  columnList,
  escapeLiteral,
  normalizeDefaultValue,
  normalizeName,
  tableRef,
} from '@/datasources/shared-sql/schema/utils'

function buildMysqlColumnDefinition(column: TableColumnDraft | SQLEditTableColumnDraft) {
  if (!normalizeName(column.name)) {
    throw new Error('Columns require a name')
  }

  if (!column.type.trim()) {
    throw new Error(`Column ${column.name} requires a SQL type`)
  }

  const parts = [quoteSqlIdentifier(column.name, 'mysql'), column.type.trim()]
  parts.push(column.nullable ? 'NULL' : 'NOT NULL')

  const defaultValue = normalizeDefaultValue(column.defaultValue)
  if (defaultValue) {
    parts.push(`DEFAULT ${defaultValue}`)
  }

  if (column.autoIncrement) {
    parts.push('AUTO_INCREMENT')
  }

  return parts.join(' ')
}

function buildMysqlMetadataQuery(tableName: string) {
  const table = escapeLiteral(tableName)

  return [
    `
      SELECT
        tc.CONSTRAINT_NAME AS name,
        tc.CONSTRAINT_TYPE AS constraint_type,
        GROUP_CONCAT(kcu.COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION SEPARATOR ',') AS column_names
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
       AND kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema = tc.table_schema
       AND kcu.table_name = tc.table_name
      WHERE tc.table_schema = DATABASE()
        AND tc.table_name = '${table}'
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      GROUP BY tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE
      ORDER BY tc.CONSTRAINT_NAME
    `,
    `
      SELECT
        rc.CONSTRAINT_NAME AS name,
        GROUP_CONCAT(kcu.COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION SEPARATOR ',') AS column_names,
        MAX(kcu.REFERENCED_TABLE_NAME) AS referenced_table,
        GROUP_CONCAT(kcu.REFERENCED_COLUMN_NAME ORDER BY kcu.POSITION_IN_UNIQUE_CONSTRAINT SEPARATOR ',') AS referenced_column_names,
        MAX(rc.DELETE_RULE) AS delete_rule,
        MAX(rc.UPDATE_RULE) AS update_rule
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = rc.constraint_schema
       AND kcu.constraint_name = rc.constraint_name
       AND kcu.table_schema = rc.constraint_schema
      WHERE rc.constraint_schema = DATABASE()
        AND rc.table_name = '${table}'
      GROUP BY rc.CONSTRAINT_NAME
      ORDER BY rc.CONSTRAINT_NAME
    `,
    `
      SELECT
        s.INDEX_NAME AS name,
        s.NON_UNIQUE = 0 AS is_unique,
        s.INDEX_TYPE AS index_method,
        GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX SEPARATOR ',') AS column_names
      FROM information_schema.statistics s
      LEFT JOIN information_schema.table_constraints tc
        ON tc.constraint_schema = s.TABLE_SCHEMA
       AND tc.table_schema = s.TABLE_SCHEMA
       AND tc.table_name = s.TABLE_NAME
       AND tc.constraint_name = s.INDEX_NAME
       AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      WHERE s.TABLE_SCHEMA = DATABASE()
        AND s.TABLE_NAME = '${table}'
        AND s.INDEX_NAME <> 'PRIMARY'
        AND tc.constraint_name IS NULL
      GROUP BY s.INDEX_NAME, s.NON_UNIQUE, s.INDEX_TYPE
      ORDER BY s.INDEX_NAME
    `,
    `
      SELECT
        tc.CONSTRAINT_NAME AS name,
        cc.CHECK_CLAUSE AS expression
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON cc.constraint_schema = tc.constraint_schema
       AND cc.constraint_name = tc.constraint_name
      WHERE tc.table_schema = DATABASE()
        AND tc.table_name = '${table}'
        AND tc.constraint_type = 'CHECK'
      ORDER BY tc.CONSTRAINT_NAME
    `,
    `
      SELECT
        TRIGGER_NAME AS name,
        ACTION_TIMING AS timing,
        EVENT_MANIPULATION AS event_name,
        ACTION_STATEMENT AS action_statement
      FROM information_schema.triggers
      WHERE trigger_schema = DATABASE()
        AND EVENT_OBJECT_TABLE = '${table}'
      ORDER BY TRIGGER_NAME
    `,
    `
      SELECT
        COLUMN_NAME AS name,
        COLUMN_TYPE AS column_type,
        IS_NULLABLE AS is_nullable,
        GENERATION_EXPRESSION AS generation_expression,
        EXTRA AS extra
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = '${table}'
        AND EXTRA LIKE '%GENERATED%'
      ORDER BY ORDINAL_POSITION
    `,
  ].join(';\n')
}

export const mysqlTableSchemaDialect = defineSqlTableSchemaDialect({
  type: 'mysql',
  buildMetadataQuery({ tableName }) {
    return buildMysqlMetadataQuery(tableName)
  },
  buildTriggerSql(tableName, row) {
    return `CREATE TRIGGER ${quoteSqlIdentifier(String(row.name), 'mysql')} ${String(row.timing)} ${String(row.event_name)} ON ${tableRef(tableName, 'mysql')} FOR EACH ROW ${String(row.action_statement).trim()}`
  },
  parseCheckExpression(row) {
    return String(row.expression ?? '')
  },
  getVirtualColumnStorage(row) {
    return String(row.extra ?? '').toLowerCase().includes('stored') ? 'stored' : 'virtual'
  },
  buildColumnDefinition(column) {
    return buildMysqlColumnDefinition(column)
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
      quoteSqlIdentifier(column.name, 'mysql'),
      column.type.trim(),
      `GENERATED ALWAYS AS (${column.expression.trim()}) ${column.storage.toUpperCase()}`,
    ].join(' ')
  },
  buildKeyDefinition(key) {
    const columns = columnList(key.columns, 'mysql')
    if (key.type === 'primary') {
      return `PRIMARY KEY (${columns})`
    }

    const constraintName = normalizeName(key.name)
    if (!constraintName) {
      throw new Error('UNIQUE entries require a name')
    }

    return `CONSTRAINT ${quoteSqlIdentifier(constraintName, 'mysql')} UNIQUE (${columns})`
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
      `CONSTRAINT ${quoteSqlIdentifier(name, 'mysql')}`,
      `FOREIGN KEY (${columnList(foreignKey.columns, 'mysql')})`,
      `REFERENCES ${quoteSqlIdentifier(foreignKey.referencedTable.trim(), 'mysql')} (${columnList(foreignKey.referencedColumns, 'mysql')})`,
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

    return `CONSTRAINT ${quoteSqlIdentifier(name, 'mysql')} CHECK (${check.expression.trim()})`
  },
  buildIndexStatement(tableName, index) {
    const name = normalizeName(index.name)
    if (!name) {
      throw new Error('Indexes require a name')
    }

    const method = index.method.trim() ? ` USING ${index.method.trim()}` : ''
    return `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${quoteSqlIdentifier(name, 'mysql')} ON ${tableRef(tableName, 'mysql')} (${columnList(index.columns, 'mysql')})${method}`
  },
  buildDropKeyStatement(tableName, key) {
    const name = normalizeName(key.originalName || key.name)
    if (key.type === 'primary') {
      return `ALTER TABLE ${tableRef(tableName, 'mysql')} DROP PRIMARY KEY`
    }

    return `ALTER TABLE ${tableRef(tableName, 'mysql')} DROP INDEX ${quoteSqlIdentifier(name, 'mysql')}`
  },
  buildDropForeignKeyStatement(tableName, key) {
    const name = normalizeName(key.originalName || key.name)
    return `ALTER TABLE ${tableRef(tableName, 'mysql')} DROP FOREIGN KEY ${quoteSqlIdentifier(name, 'mysql')}`
  },
  buildDropCheckStatement(tableName, check) {
    const name = normalizeName(check.originalName || check.name)
    return `ALTER TABLE ${tableRef(tableName, 'mysql')} DROP CHECK ${quoteSqlIdentifier(name, 'mysql')}`
  },
  buildDropIndexStatement(tableName, index) {
    const name = normalizeName(index.originalName || index.name)
    return `DROP INDEX ${quoteSqlIdentifier(name, 'mysql')} ON ${tableRef(tableName, 'mysql')}`
  },
  buildDropVirtualColumnStatement(tableName, column) {
    const name = normalizeName(column.originalName || column.name)
    return `ALTER TABLE ${tableRef(tableName, 'mysql')} DROP COLUMN ${quoteSqlIdentifier(name, 'mysql')}`
  },
  buildDropTriggerStatement(_tableName, trigger) {
    const name = normalizeName(trigger.originalName || trigger.name)
    return `DROP TRIGGER IF EXISTS ${quoteSqlIdentifier(name, 'mysql')}`
  },
  buildAlterTableStatements({ tableName, originalColumns, nextColumns }) {
    const quotedTableName = tableRef(tableName, 'mysql')
    const originalByName = new Map(originalColumns.map((column) => [column.name, column]))
    const keptOriginalNames = new Set(
      nextColumns.map((column) => column.originalName).filter((value): value is string => Boolean(value)),
    )

    const statements: string[] = []

    for (const original of originalColumns) {
      if (!keptOriginalNames.has(original.name)) {
        statements.push(
          `ALTER TABLE ${quotedTableName} DROP COLUMN ${quoteSqlIdentifier(original.name, 'mysql')}`,
        )
      }
    }

    for (const column of nextColumns) {
      if (!column.originalName) {
        statements.push(`ALTER TABLE ${quotedTableName} ADD COLUMN ${buildMysqlColumnDefinition(column)}`)
        continue
      }

      const original = originalByName.get(column.originalName)
      if (
        !original ||
        (original.name === column.name &&
          (original.type || '').trim() === column.type.trim() &&
          Boolean(original.nullable) === column.nullable &&
          normalizeDefaultValue(original.defaultValue) === normalizeDefaultValue(column.defaultValue))
      ) {
        continue
      }

      statements.push(
        `ALTER TABLE ${quotedTableName} CHANGE COLUMN ${quoteSqlIdentifier(original.name, 'mysql')} ${buildMysqlColumnDefinition(column)}`,
      )
    }

    return statements
  },
})
