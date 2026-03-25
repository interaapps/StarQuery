export type DataExportFormat = 'csv' | 'json' | 'sql' | 'xml' | 'html'

export type DataExportInput = {
  fileBaseName: string
  columns: string[]
  rows: Record<string, unknown>[]
  tableName?: string
}

const EXPORT_FILE_EXTENSIONS: Record<DataExportFormat, string> = {
  csv: 'csv',
  json: 'json',
  sql: 'sql',
  xml: 'xml',
  html: 'html',
}

const EXPORT_MIME_TYPES: Record<DataExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
  sql: 'text/plain;charset=utf-8',
  xml: 'application/xml;charset=utf-8',
  html: 'text/html;charset=utf-8',
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function escapeCsvValue(value: unknown) {
  const normalized = normalizeValue(value)
  return `"${normalized.replace(/"/g, '""')}"`
}

function escapeXmlValue(value: unknown) {
  return normalizeValue(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toXmlElementName(value: string, fallback: string) {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, '_')
    .replace(/^[^A-Za-z_]+/, '')

  return normalized || fallback
}

function escapeSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`
}

function serializeSqlValue(value: unknown) {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL'
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE'
  }

  const normalized = normalizeValue(value)
  return `'${normalized.replace(/'/g, "''")}'`
}

function buildCsvContent(input: DataExportInput) {
  const header = input.columns.map((column) => escapeCsvValue(column)).join(',')
  const rows = input.rows.map((row) => input.columns.map((column) => escapeCsvValue(row[column])).join(','))
  return [header, ...rows].join('\n')
}

function buildJsonContent(input: DataExportInput) {
  return JSON.stringify(input.rows, null, 2)
}

function buildSqlContent(input: DataExportInput) {
  const tableName = escapeSqlIdentifier(input.tableName || input.fileBaseName || 'exported_rows')
  const columnList = input.columns.map((column) => escapeSqlIdentifier(column)).join(', ')

  return input.rows
    .map((row) => {
      const values = input.columns.map((column) => serializeSqlValue(row[column])).join(', ')
      return `INSERT INTO ${tableName} (${columnList}) VALUES (${values});`
    })
    .join('\n')
}

function buildXmlContent(input: DataExportInput) {
  const rows = input.rows
    .map(
      (row) =>
        `  <row>\n${input.columns
          .map((column, index) => {
            const elementName = toXmlElementName(column, `column_${index + 1}`)
            return `    <${elementName}>${escapeXmlValue(row[column])}</${elementName}>`
          })
          .join('\n')}\n  </row>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rows>\n${rows}\n</rows>\n`
}

function buildHtmlContent(input: DataExportInput) {
  const header = input.columns.map((column) => `<th>${escapeXmlValue(column)}</th>`).join('')
  const rows = input.rows
    .map(
      (row) =>
        `<tr>${input.columns
          .map((column) => `<td>${escapeXmlValue(row[column])}</td>`)
          .join('')}</tr>`,
    )
    .join('\n')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeXmlValue(input.fileBaseName)}</title>
    <style>
      body { font-family: sans-serif; margin: 24px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d4d4d8; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f5f5f5; }
    </style>
  </head>
  <body>
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </body>
</html>
`
}

export function buildExportContent(format: DataExportFormat, input: DataExportInput) {
  switch (format) {
    case 'csv':
      return buildCsvContent(input)
    case 'json':
      return buildJsonContent(input)
    case 'sql':
      return buildSqlContent(input)
    case 'xml':
      return buildXmlContent(input)
    case 'html':
      return buildHtmlContent(input)
  }
}

export function triggerDataExport(format: DataExportFormat, input: DataExportInput) {
  const content = buildExportContent(format, input)
  const blob = new Blob([content], { type: EXPORT_MIME_TYPES[format] })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${input.fileBaseName}.${EXPORT_FILE_EXTENSIONS[format]}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
