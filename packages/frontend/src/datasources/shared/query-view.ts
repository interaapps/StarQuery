export type GenericQueryResultTable = {
  id?: string | number
  title: string
  kind?: string | null
  columns: string[]
  rows: Record<string, unknown>[]
  exportFileBaseName: string
  exportTableName?: string
  height?: string
}
