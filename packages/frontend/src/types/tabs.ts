import type { DataSourceBrowserTabData } from '@/types/datasources'
import type { DataSourceQueryTabData } from '@/types/query-console'
import type { SQLQueryTabData, SQLTableTabData } from '@/types/sql'

export type WorkspaceTabDataMap = {
  'database.sql.query': SQLQueryTabData
  'database.sql.table': SQLTableTabData
  'datasource.query': DataSourceQueryTabData
  'datasource.resource.browser': DataSourceBrowserTabData
}

export type WorkspaceTabType = keyof WorkspaceTabDataMap

export type WorkspaceTab<TType extends WorkspaceTabType = WorkspaceTabType> = {
  id?: string
  name: string
  type: TType
  data: WorkspaceTabDataMap[TType]
  dirty?: boolean
}

export function isSqlTableTab(tab: WorkspaceTab): tab is WorkspaceTab<'database.sql.table'> {
  return tab.type === 'database.sql.table'
}

export function isSqlQueryTab(tab: WorkspaceTab): tab is WorkspaceTab<'database.sql.query'> {
  return tab.type === 'database.sql.query'
}

export function isDataSourceQueryTab(tab: WorkspaceTab): tab is WorkspaceTab<'datasource.query'> {
  return tab.type === 'datasource.query'
}

export function isResourceBrowserTab(
  tab: WorkspaceTab,
): tab is WorkspaceTab<'datasource.resource.browser'> {
  return tab.type === 'datasource.resource.browser'
}
