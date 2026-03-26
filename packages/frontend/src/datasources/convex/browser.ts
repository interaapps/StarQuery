import type { DataSourceResourceListing } from '@/types/datasources'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'

type ConvexTableData = {
  title: string
  columns: SQLTableColumn[]
  rows: SQLTableRowDraft[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
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

function createColumns(columnNames: string[]): SQLTableColumn[] {
  return columnNames.map((columnName) => ({
    name: columnName,
    field: columnName,
  }))
}

function createRows(prefix: string, rows: Record<string, unknown>[]): SQLTableRowDraft[] {
  return rows.map((row, index) => ({
    id: `${prefix}-${index}`,
    values: row,
    original: { ...row },
    state: 'clean' as const,
  }))
}

function buildTableFromRecords(
  title: string,
  prefix: string,
  records: Record<string, unknown>[],
): ConvexTableData {
  const columnNames = Array.from(new Set(records.flatMap((record) => Object.keys(record))))
  const normalizedRows = records.map((record) =>
    Object.fromEntries(columnNames.map((column) => [column, serializeValue(record[column])])),
  )

  return {
    title,
    columns: createColumns(columnNames),
    rows: createRows(prefix, normalizedRows),
  }
}

export function buildConvexTablesTable(listing: DataSourceResourceListing): ConvexTableData {
  return buildTableFromRecords(
    'Convex Tables',
    'convex-table',
    listing.items.map((item) => ({
      table: item.name,
      fields: item.metadata?.fieldCount ?? '',
      description: item.description ?? 'table',
      path: item.path,
    })),
  )
}

export function buildConvexDocumentsTable(listing: DataSourceResourceListing): ConvexTableData {
  const preview = listing.preview

  if (preview?.type === 'table') {
    return buildTableFromRecords(
      preview.title,
      'convex-document',
      preview.rows.map((row) =>
        Object.fromEntries(
          preview.columns.map((column: string) => [column, serializeValue(row[column])]),
        ),
      ),
    )
  }

  return {
    title: listing.details?.name ?? 'Documents',
    columns: createColumns(['value']),
    rows: createRows('convex-document', []),
  }
}

export function buildConvexDocumentPreviewTable(listing: DataSourceResourceListing): ConvexTableData {
  const preview = listing.preview

  if (!preview) {
    return {
      title: listing.details?.name ?? 'Document',
      columns: createColumns(['value']),
      rows: createRows('convex-preview', []),
    }
  }

  if (preview.type === 'table') {
    return buildConvexDocumentsTable(listing)
  }

  if (preview.type === 'text') {
    return {
      title: preview.title,
      columns: createColumns(['value']),
      rows: createRows('convex-preview', [{ value: preview.text }]),
    }
  }

  if (Array.isArray(preview.value)) {
    return {
      title: preview.title,
      columns: createColumns(['index', 'value']),
      rows: createRows(
        'convex-preview',
        preview.value.map((value, index) => ({
          index,
          value: serializeValue(value),
        })),
      ),
    }
  }

  if (isRecord(preview.value)) {
    return {
      title: preview.title,
      columns: createColumns(['field', 'value']),
      rows: createRows(
        'convex-preview',
        Object.entries(preview.value).map(([field, value]) => ({
          field,
          value: serializeValue(value),
        })),
      ),
    }
  }

  return {
    title: preview.title,
    columns: createColumns(['value']),
    rows: createRows('convex-preview', [{ value: serializeValue(preview.value) }]),
  }
}
