export type DataSourceType =
  | 'mysql'
  | 'mariadb'
  | 'postgres'
  | 'cockroachdb'
  | 'sqlite'
  | 'duckdb'
  | 'mssql'
  | 'clickhouse'
  | 'oracle'
  | 'mongodb'
  | 'redis'
  | 'cassandra'
  | 'elasticsearch'
  | 's3'
  | 'minio'

export type DataSourceKind = 'sql' | 'search' | 'objectStorage' | 'resource'

export type DataSourceCapabilities = {
  sqlQuery: boolean
  queryConsole?: boolean
  tableBrowser: boolean
  dataEditor: boolean
  schemaEditor: boolean
  tableCreate?: boolean
  resourceBrowser: boolean
}

export type DataSourceDefinition = {
  type: DataSourceType
  kind: DataSourceKind
  label: string
  icon: string
  localOnly?: boolean
  capabilities: DataSourceCapabilities
}

export type DataSourceResourceItem = {
  id: string
  name: string
  kind: 'container' | 'item'
  path: string
  description?: string
  metadata?: Record<string, string | number | boolean | null>
}

export type DataSourceResourceDetails = {
  name: string
  kind: 'container' | 'item'
  path: string
  contentType?: string | null
  size?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  etag?: string | null
  metadata?: Record<string, string | number | boolean | null>
}

export type DataSourceResourcePreview =
  | {
      type: 'json'
      title: string
      value: unknown
    }
  | {
      type: 'table'
      title: string
      columns: string[]
      rows: Record<string, unknown>[]
    }
  | {
      type: 'text'
      title: string
      text: string
    }

export type DataSourceResourceListing = {
  path: string
  items: DataSourceResourceItem[]
  preview?: DataSourceResourcePreview | null
  details?: DataSourceResourceDetails | null
  page?: {
    returned: number
    hasMore: boolean
    nextCursor?: string | null
  } | null
}

export type ElasticsearchSearchHit = {
  id: string
  index: string
  score: number | null
  source: Record<string, unknown>
  sort: unknown[] | null
}

export type ElasticsearchSearchResult = {
  index: string
  tookMs: number | null
  total: number | null
  hits: ElasticsearchSearchHit[]
}

export type MongoDbSerializedDocument = {
  idLabel: string
  idValue: unknown
  document: Record<string, unknown>
}

export type MongoDbQueryResult = {
  database: string
  collection: string
  total: number
  skip: number
  limit: number
  returned: number
  documents: MongoDbSerializedDocument[]
}

export type DataSourceBrowserTabData = {
  serverId: string
  serverUrl: string
  projectId: string
  sourceId: string
  sourceName: string
  sourceType: DataSourceType
  path?: string
}
