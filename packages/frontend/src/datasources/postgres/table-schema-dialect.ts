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

function unwrapPostgresCheckDefinition(definition: string) {
  const match = definition.match(/^CHECK\s*\((.*)\)$/is)
  return match ? match[1] : definition
}

function buildPostgresColumnDefinition(column: TableColumnDraft | SQLEditTableColumnDraft) {
  if (!normalizeName(column.name)) {
    throw new Error('Columns require a name')
  }

  if (!column.type.trim()) {
    throw new Error(`Column ${column.name} requires a SQL type`)
  }

  if (column.autoIncrement) {
    const serialType = /big/i.test(column.type) ? 'BIGSERIAL' : 'SERIAL'
    return `${quoteSqlIdentifier(column.name, 'postgres')} ${serialType}${column.nullable ? '' : ' NOT NULL'}`
  }

  const parts = [quoteSqlIdentifier(column.name, 'postgres'), column.type.trim()]
  parts.push(column.nullable ? 'NULL' : 'NOT NULL')

  const defaultValue = normalizeDefaultValue(column.defaultValue)
  if (defaultValue) {
    parts.push(`DEFAULT ${defaultValue}`)
  }

  return parts.join(' ')
}

function buildPostgresMetadataQuery(tableName: string, schema: string) {
  const table = escapeLiteral(tableName)
  const safeSchema = escapeLiteral(schema)

  return [
    `
      SELECT
        con.conname AS name,
        CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' ELSE 'UNIQUE' END AS constraint_type,
        string_agg(att.attname, ',' ORDER BY ord.ordinality) AS column_names
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN unnest(con.conkey) WITH ORDINALITY ord(attnum, ordinality) ON true
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ord.attnum
      WHERE nsp.nspname = '${safeSchema}'
        AND rel.relname = '${table}'
        AND con.contype IN ('p', 'u')
      GROUP BY con.conname, con.contype
      ORDER BY con.conname
    `,
    `
      SELECT
        con.conname AS name,
        string_agg(src.attname, ',' ORDER BY src_ord.ordinality) AS column_names,
        confrel.relname AS referenced_table,
        string_agg(dst.attname, ',' ORDER BY src_ord.ordinality) AS referenced_column_names,
        CASE con.confdeltype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
        END AS delete_rule,
        CASE con.confupdtype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
        END AS update_rule
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN pg_class confrel ON confrel.oid = con.confrelid
      JOIN unnest(con.conkey) WITH ORDINALITY src_ord(attnum, ordinality) ON true
      JOIN pg_attribute src ON src.attrelid = con.conrelid AND src.attnum = src_ord.attnum
      JOIN unnest(con.confkey) WITH ORDINALITY dst_ord(attnum, ordinality)
        ON dst_ord.ordinality = src_ord.ordinality
      JOIN pg_attribute dst ON dst.attrelid = con.confrelid AND dst.attnum = dst_ord.attnum
      WHERE nsp.nspname = '${safeSchema}'
        AND rel.relname = '${table}'
        AND con.contype = 'f'
      GROUP BY con.conname, confrel.relname, con.confdeltype, con.confupdtype
      ORDER BY con.conname
    `,
    `
      SELECT
        idx.relname AS name,
        ind.indisunique AS is_unique,
        am.amname AS index_method,
        string_agg(att.attname, ',' ORDER BY key_ord.ordinality) AS column_names
      FROM pg_index ind
      JOIN pg_class tbl ON tbl.oid = ind.indrelid
      JOIN pg_namespace nsp ON nsp.oid = tbl.relnamespace
      JOIN pg_class idx ON idx.oid = ind.indexrelid
      JOIN pg_am am ON am.oid = idx.relam
      JOIN unnest(ind.indkey) WITH ORDINALITY key_ord(attnum, ordinality) ON key_ord.attnum > 0
      JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = key_ord.attnum
      LEFT JOIN pg_constraint con ON con.conindid = ind.indexrelid AND con.contype IN ('p', 'u')
      WHERE nsp.nspname = '${safeSchema}'
        AND tbl.relname = '${table}'
        AND con.oid IS NULL
      GROUP BY idx.relname, ind.indisunique, am.amname
      ORDER BY idx.relname
    `,
    `
      SELECT
        con.conname AS name,
        pg_get_constraintdef(con.oid, true) AS definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = '${safeSchema}'
        AND rel.relname = '${table}'
        AND con.contype = 'c'
      ORDER BY con.conname
    `,
    `
      SELECT
        tg.tgname AS name,
        pg_get_triggerdef(tg.oid, true) AS definition
      FROM pg_trigger tg
      JOIN pg_class rel ON rel.oid = tg.tgrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = '${safeSchema}'
        AND rel.relname = '${table}'
        AND NOT tg.tgisinternal
      ORDER BY tg.tgname
    `,
    `
      SELECT
        column_name AS name,
        COALESCE(udt_name, data_type) AS column_type,
        is_nullable,
        generation_expression
      FROM information_schema.columns
      WHERE table_schema = '${safeSchema}'
        AND table_name = '${table}'
        AND is_generated = 'ALWAYS'
      ORDER BY ordinal_position
    `,
  ].join(';\n')
}

export const postgresTableSchemaDialect = defineSqlTableSchemaDialect({
  type: 'postgres',
  buildMetadataQuery({ tableName, source }) {
    return buildPostgresMetadataQuery(tableName, String(source.config.schema ?? 'public'))
  },
  buildTriggerSql(_tableName, row) {
    return String(row.definition ?? row.sql ?? '').trim()
  },
  parseCheckExpression(row) {
    return unwrapPostgresCheckDefinition(String(row.definition ?? ''))
  },
  getVirtualColumnStorage() {
    return 'stored'
  },
  buildColumnDefinition(column) {
    return buildPostgresColumnDefinition(column as TableColumnDraft)
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
      quoteSqlIdentifier(column.name, 'postgres'),
      column.type.trim(),
      `GENERATED ALWAYS AS (${column.expression.trim()}) STORED`,
    ].join(' ')
  },
  buildKeyDefinition(key) {
    const constraintName = normalizeName(key.name)
    const kind = key.type === 'primary' ? 'PRIMARY KEY' : 'UNIQUE'
    if (!constraintName) {
      throw new Error(`${kind} entries require a name`)
    }

    return `CONSTRAINT ${quoteSqlIdentifier(constraintName, 'postgres')} ${kind} (${columnList(key.columns, 'postgres')})`
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
      `CONSTRAINT ${quoteSqlIdentifier(name, 'postgres')}`,
      `FOREIGN KEY (${columnList(foreignKey.columns, 'postgres')})`,
      `REFERENCES ${quoteSqlIdentifier(foreignKey.referencedTable.trim(), 'postgres')} (${columnList(foreignKey.referencedColumns, 'postgres')})`,
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

    return `CONSTRAINT ${quoteSqlIdentifier(name, 'postgres')} CHECK (${check.expression.trim()})`
  },
  buildIndexStatement(tableName, index) {
    const name = normalizeName(index.name)
    if (!name) {
      throw new Error('Indexes require a name')
    }

    const method = index.method.trim() ? ` USING ${index.method.trim()}` : ''
    return `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${quoteSqlIdentifier(name, 'postgres')} ON ${tableRef(tableName, 'postgres')}${method} (${columnList(index.columns, 'postgres')})`
  },
  buildDropKeyStatement(tableName, key) {
    const name = normalizeName(key.originalName || key.name)
    return `ALTER TABLE ${tableRef(tableName, 'postgres')} DROP CONSTRAINT ${quoteSqlIdentifier(name, 'postgres')}`
  },
  buildDropForeignKeyStatement(tableName, key) {
    const name = normalizeName(key.originalName || key.name)
    return `ALTER TABLE ${tableRef(tableName, 'postgres')} DROP CONSTRAINT ${quoteSqlIdentifier(name, 'postgres')}`
  },
  buildDropCheckStatement(tableName, check) {
    const name = normalizeName(check.originalName || check.name)
    return `ALTER TABLE ${tableRef(tableName, 'postgres')} DROP CONSTRAINT ${quoteSqlIdentifier(name, 'postgres')}`
  },
  buildDropIndexStatement(_tableName, index) {
    const name = normalizeName(index.originalName || index.name)
    return `DROP INDEX ${quoteSqlIdentifier(name, 'postgres')}`
  },
  buildDropVirtualColumnStatement(tableName, column) {
    const name = normalizeName(column.originalName || column.name)
    return `ALTER TABLE ${tableRef(tableName, 'postgres')} DROP COLUMN ${quoteSqlIdentifier(name, 'postgres')}`
  },
  buildDropTriggerStatement(tableName, trigger) {
    const name = normalizeName(trigger.originalName || trigger.name)
    return `DROP TRIGGER IF EXISTS ${quoteSqlIdentifier(name, 'postgres')} ON ${tableRef(tableName, 'postgres')}`
  },
  buildAlterTableStatements({ tableName, originalColumns, nextColumns }) {
    const quotedTableName = tableRef(tableName, 'postgres')
    const originalByName = new Map(originalColumns.map((column) => [column.name, column]))
    const keptOriginalNames = new Set(
      nextColumns.map((column) => column.originalName).filter((value): value is string => Boolean(value)),
    )

    const statements: string[] = []

    for (const original of originalColumns) {
      if (!keptOriginalNames.has(original.name)) {
        statements.push(
          `ALTER TABLE ${quotedTableName} DROP COLUMN ${quoteSqlIdentifier(original.name, 'postgres')}`,
        )
      }
    }

    for (const column of nextColumns) {
      if (!column.originalName) {
        statements.push(`ALTER TABLE ${quotedTableName} ADD COLUMN ${buildPostgresColumnDefinition(column)}`)
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

      const originalName = quoteSqlIdentifier(original.name, 'postgres')
      const nextName = quoteSqlIdentifier(column.name, 'postgres')
      const targetName = original.name !== column.name ? nextName : originalName

      if (original.name !== column.name) {
        statements.push(`ALTER TABLE ${quotedTableName} RENAME COLUMN ${originalName} TO ${nextName}`)
      }

      if ((original.type || '').trim() !== column.type.trim()) {
        statements.push(
          `ALTER TABLE ${quotedTableName} ALTER COLUMN ${targetName} TYPE ${column.type.trim()} USING ${targetName}::${column.type.trim()}`,
        )
      }

      if (Boolean(original.nullable) !== column.nullable) {
        statements.push(
          `ALTER TABLE ${quotedTableName} ALTER COLUMN ${targetName} ${column.nullable ? 'DROP' : 'SET'} NOT NULL`,
        )
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
