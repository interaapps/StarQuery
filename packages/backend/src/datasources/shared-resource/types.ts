import type { ResourceBrowserListing } from '../types.ts'

export type ResourceListOptions = {
  search?: string
  limit?: number
  cursor?: string
}

export type ResourceDeleteResult = {
  deletedPaths: string[]
  deletedCount: number
}

export interface ResourceDataSourceAdapter {
  connect(): Promise<void>
  close(): Promise<void>
  list(path: string, options?: ResourceListOptions): Promise<ResourceBrowserListing>
  deletePaths?(paths: string[]): Promise<ResourceDeleteResult>
}
