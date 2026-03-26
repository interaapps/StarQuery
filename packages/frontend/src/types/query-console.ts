import type { DataSourceType } from '@/types/datasources'

export type ConvexFunctionType = 'query' | 'mutation' | 'action'

type DataSourceQueryTabBase = {
  serverId: string
  serverUrl: string
  projectId: string
  sourceId: string
  sourceName: string
  sourceType: DataSourceType
}

export type RedisQueryTabData = DataSourceQueryTabBase & {
  sourceType: 'redis'
  initialCommand?: string
}

export type ConvexQueryTabData = DataSourceQueryTabBase & {
  sourceType: 'convex'
  initialFunctionType?: ConvexFunctionType
  initialPath?: string
  initialArgs?: Record<string, unknown>
}

export type DataSourceQueryTabData = RedisQueryTabData | ConvexQueryTabData
