export type DataSourceType = 'mysql' | 'postgres' | 'sqlite'

export type ProjectRecord = {
  id: string
  slug: string
  name: string
  description: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export type DataSourceRecord = {
  id: string
  projectId: string
  name: string
  type: DataSourceType
  config: Record<string, unknown>
  position: number
  createdAt: string
  updatedAt: string
}

export type BootstrapConfig = {
  users?: Array<{
    email: string
    name: string
  }>
  projects?: Array<{
    slug?: string
    name: string
    description?: string
    dataSources?: Array<{
      name: string
      type: DataSourceType
      position?: number
      config: Record<string, unknown>
    }>
  }>
}
