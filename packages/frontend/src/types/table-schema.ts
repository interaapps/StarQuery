import type { SQLTableColumn } from '@/types/sql'

export type TableSchemaSectionId =
  | 'columns'
  | 'keys'
  | 'foreignKeys'
  | 'indexes'
  | 'checks'
  | 'triggers'
  | 'virtualColumns'
  | 'virtualForeignKeys'

export type TableSchemaMode = 'create' | 'edit'

export type TableSchemaSection = {
  id: TableSchemaSectionId
  label: string
  icon: string
  description: string
}

export type TableColumnDraft = {
  id: string
  originalName?: string
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
  autoIncrement: boolean
  defaultValue: string
}

export type TableKeyDraft = {
  id: string
  originalName?: string
  name: string
  type: 'primary' | 'unique'
  columns: string
}

export type TableForeignKeyDraft = {
  id: string
  originalName?: string
  name: string
  columns: string
  referencedTable: string
  referencedColumns: string
  onDelete: string
  onUpdate: string
}

export type TableIndexDraft = {
  id: string
  originalName?: string
  name: string
  columns: string
  unique: boolean
  method: string
}

export type TableCheckDraft = {
  id: string
  originalName?: string
  name: string
  expression: string
}

export type TableTriggerDraft = {
  id: string
  originalName?: string
  name: string
  sql: string
}

export type TableVirtualColumnDraft = {
  id: string
  originalName?: string
  name: string
  type: string
  expression: string
  storage: 'virtual' | 'stored'
  nullable: boolean
}

export type TableVirtualForeignKeyDraft = {
  id: string
  name: string
  columns: string
  referencedTable: string
  referencedColumns: string
  displayColumns: string
}

export type TableSchemaDraft = {
  name: string
  columns: TableColumnDraft[]
  keys: TableKeyDraft[]
  foreignKeys: TableForeignKeyDraft[]
  indexes: TableIndexDraft[]
  checks: TableCheckDraft[]
  triggers: TableTriggerDraft[]
  virtualColumns: TableVirtualColumnDraft[]
  virtualForeignKeys: TableVirtualForeignKeyDraft[]
}

export type TableSchemaSnapshot = TableSchemaDraft

export type TableSchemaState = {
  schema: TableSchemaDraft
  original: TableSchemaSnapshot | null
}

export type TableSchemaSupport = {
  sections: TableSchemaSectionId[]
  editableSections: TableSchemaSectionId[]
}

export type TableMetadataResultRow = Record<string, unknown>

export type VirtualForeignKeyConfig = {
  name: string
  columns: string[]
  referencedTable: string
  referencedColumns: string[]
  displayColumns?: string[]
}

export type DataSourceVirtualForeignKeyConfig = {
  virtualForeignKeys?: Record<string, VirtualForeignKeyConfig[]>
}

export const TABLE_SCHEMA_SECTIONS: TableSchemaSection[] = [
  {
    id: 'columns',
    label: 'Columns',
    icon: 'ti ti-columns-3',
    description: 'Base table fields and defaults',
  },
  {
    id: 'keys',
    label: 'Keys',
    icon: 'ti ti-key',
    description: 'Primary and unique keys',
  },
  {
    id: 'foreignKeys',
    label: 'Foreign keys',
    icon: 'ti ti-link',
    description: 'Database-level relations',
  },
  {
    id: 'indexes',
    label: 'Indexes',
    icon: 'ti ti-bolt',
    description: 'Secondary and unique indexes',
  },
  {
    id: 'checks',
    label: 'Checks',
    icon: 'ti ti-shield-check',
    description: 'Constraint expressions',
  },
  {
    id: 'triggers',
    label: 'Triggers',
    icon: 'ti ti-wave-sine',
    description: 'Trigger definitions as SQL',
  },
  {
    id: 'virtualColumns',
    label: 'Virtual columns',
    icon: 'ti ti-sigma',
    description: 'Generated or computed columns',
  },
  {
    id: 'virtualForeignKeys',
    label: 'Virtual foreign keys',
    icon: 'ti ti-route',
    description: 'App-level relations stored in datasource metadata',
  },
]

export function createDraftId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function createColumnDraft(partial: Partial<TableColumnDraft> = {}): TableColumnDraft {
  return {
    id: createDraftId('column'),
    name: '',
    type: 'VARCHAR(255)',
    nullable: true,
    primaryKey: false,
    autoIncrement: false,
    defaultValue: '',
    ...partial,
  }
}

export function createKeyDraft(partial: Partial<TableKeyDraft> = {}): TableKeyDraft {
  return {
    id: createDraftId('key'),
    name: '',
    type: 'unique',
    columns: '',
    ...partial,
  }
}

export function createForeignKeyDraft(partial: Partial<TableForeignKeyDraft> = {}): TableForeignKeyDraft {
  return {
    id: createDraftId('fk'),
    name: '',
    columns: '',
    referencedTable: '',
    referencedColumns: '',
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    ...partial,
  }
}

export function createIndexDraft(partial: Partial<TableIndexDraft> = {}): TableIndexDraft {
  return {
    id: createDraftId('index'),
    name: '',
    columns: '',
    unique: false,
    method: '',
    ...partial,
  }
}

export function createCheckDraft(partial: Partial<TableCheckDraft> = {}): TableCheckDraft {
  return {
    id: createDraftId('check'),
    name: '',
    expression: '',
    ...partial,
  }
}

export function createTriggerDraft(partial: Partial<TableTriggerDraft> = {}): TableTriggerDraft {
  return {
    id: createDraftId('trigger'),
    name: '',
    sql: '',
    ...partial,
  }
}

export function createVirtualColumnDraft(partial: Partial<TableVirtualColumnDraft> = {}): TableVirtualColumnDraft {
  return {
    id: createDraftId('virtual-column'),
    name: '',
    type: 'VARCHAR(255)',
    expression: '',
    storage: 'virtual',
    nullable: true,
    ...partial,
  }
}

export function createVirtualForeignKeyDraft(
  partial: Partial<TableVirtualForeignKeyDraft> = {},
): TableVirtualForeignKeyDraft {
  return {
    id: createDraftId('virtual-fk'),
    name: '',
    columns: '',
    referencedTable: '',
    referencedColumns: '',
    displayColumns: '',
    ...partial,
  }
}

export function createDefaultTableSchema(): TableSchemaDraft {
  return {
    name: '',
    columns: [
      createColumnDraft({
        name: 'id',
        type: 'INT',
        nullable: false,
        primaryKey: true,
        autoIncrement: true,
      }),
      createColumnDraft({
        name: 'name',
        type: 'VARCHAR(255)',
        nullable: false,
      }),
    ],
    keys: [
      createKeyDraft({
        name: 'pk_id',
        type: 'primary',
        columns: 'id',
      }),
    ],
    foreignKeys: [],
    indexes: [],
    checks: [],
    triggers: [],
    virtualColumns: [],
    virtualForeignKeys: [],
  }
}

export function cloneTableSchema(schema: TableSchemaDraft): TableSchemaDraft {
  return JSON.parse(JSON.stringify(schema)) as TableSchemaDraft
}

export function normalizeSqlColumnToDraft(column: SQLTableColumn): TableColumnDraft {
  return createColumnDraft({
    originalName: column.name,
    name: column.name,
    type: column.type || 'VARCHAR(255)',
    nullable: column.nullable !== false,
    primaryKey: column.primaryKey === true,
    autoIncrement: column.autoIncrement === true,
    defaultValue: column.defaultValue === null || column.defaultValue === undefined ? '' : String(column.defaultValue),
  })
}
