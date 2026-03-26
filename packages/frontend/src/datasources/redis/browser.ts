import type { DataSourceResourceListing } from '@/types/datasources'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'

type RedisTableData = {
  title: string
  columns: SQLTableColumn[]
  rows: SQLTableRowDraft[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function createColumns(columnNames: string[]): SQLTableColumn[] {
  return columnNames.map((columnName) => ({
    name: columnName,
    field: columnName,
  }))
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return value
}

function createDraftRows(prefix: string, rows: Record<string, unknown>[]): SQLTableRowDraft[] {
  return rows.map((row, index) => ({
    id: `${prefix}-${index}`,
    values: row,
    original: { ...row },
    state: 'clean' as const,
  }))
}

function buildRowsFromRecords(records: Record<string, unknown>[], prefix: string) {
  const columnNames: string[] = []

  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!columnNames.includes(key)) {
        columnNames.push(key)
      }
    }
  }

  const normalizedRows = records.map((record) =>
    Object.fromEntries(
      columnNames.map((columnName) => [columnName, serializeValue(record[columnName])]),
    ),
  )

  return {
    columns: createColumns(columnNames),
    rows: createDraftRows(prefix, normalizedRows),
  }
}

export function buildRedisListingTable(listing: DataSourceResourceListing): RedisTableData {
  const records = listing.items.map((item) => ({
    key: item.name,
    type: item.description ?? item.metadata?.type ?? '',
    path: item.path,
  }))
  const { columns, rows } = buildRowsFromRecords(records, 'redis-key')

  return {
    title: `Keys${listing.path ? ` • ${listing.path}` : ''}`,
    columns,
    rows,
  }
}

export function buildRedisPreviewTable(listing: DataSourceResourceListing): RedisTableData {
  const preview = listing.preview

  if (!preview) {
    return {
      title: listing.details?.name ?? 'Preview',
      columns: createColumns(['value']),
      rows: createDraftRows('redis-preview', []),
    }
  }

  if (preview.type === 'table') {
    return {
      title: preview.title,
      columns: createColumns(preview.columns),
      rows: createDraftRows('redis-preview', preview.rows),
    }
  }

  if (preview.type === 'text') {
    return {
      title: preview.title,
      columns: createColumns(['value']),
      rows: createDraftRows('redis-preview', [{ value: preview.text }]),
    }
  }

  const value = preview.value

  if (Array.isArray(value)) {
    if (value.every((entry) => isRecord(entry))) {
      const { columns, rows } = buildRowsFromRecords(value, 'redis-preview')
      return {
        title: preview.title,
        columns,
        rows,
      }
    }

    return {
      title: preview.title,
      columns: createColumns(['index', 'value']),
      rows: createDraftRows(
        'redis-preview',
        value.map((entry, index) => ({
          index,
          value: serializeValue(entry),
        })),
      ),
    }
  }

  if (isRecord(value)) {
    return {
      title: preview.title,
      columns: createColumns(['field', 'value']),
      rows: createDraftRows(
        'redis-preview',
        Object.entries(value).map(([field, entryValue]) => ({
          field,
          value: serializeValue(entryValue),
        })),
      ),
    }
  }

  return {
    title: preview.title,
    columns: createColumns(['value']),
    rows: createDraftRows('redis-preview', [{ value: serializeValue(value) }]),
  }
}
