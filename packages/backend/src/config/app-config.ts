import path from 'node:path'

export type AppMode = 'local' | 'hosted'
export type MetaStoreDriver = 'sqlite' | 'mysql'

export type AppConfig = {
  port: number
  host: string
  serverName: string
  mode: AppMode
  requestBodyLimit: string
  metaStore: {
    driver: MetaStoreDriver
    sqlitePath: string
    mysql: {
      host: string
      port: number
      user: string
      password: string
      database: string
    }
  }
  bootstrapConfigPath?: string
}

export function loadAppConfig(): AppConfig {
  const mode = (process.env.STARQUERY_MODE as AppMode | undefined) ?? 'local'
  const metaDriver =
    (process.env.STARQUERY_META_DRIVER as MetaStoreDriver | undefined) ??
    (mode === 'hosted' ? 'mysql' : 'sqlite')

  return {
    port: Number(process.env.PORT ?? '3000'),
    host: process.env.HOST ?? '0.0.0.0',
    serverName:
      process.env.STARQUERY_SERVER_NAME ?? (mode === 'hosted' ? 'Hosted Server' : 'Local Computer'),
    mode,
    requestBodyLimit: process.env.STARQUERY_REQUEST_BODY_LIMIT ?? '100mb',
    metaStore: {
      driver: metaDriver,
      sqlitePath:
        process.env.STARQUERY_META_SQLITE_PATH ??
        path.resolve(process.cwd(), '.starquery', 'starquery-meta.sqlite'),
      mysql: {
        host: process.env.STARQUERY_META_MYSQL_HOST ?? '127.0.0.1',
        port: Number(process.env.STARQUERY_META_MYSQL_PORT ?? '3307'),
        user: process.env.STARQUERY_META_MYSQL_USER ?? 'pastefy',
        password: process.env.STARQUERY_META_MYSQL_PASSWORD ?? 'pastefy',
        database: process.env.STARQUERY_META_MYSQL_DATABASE ?? 'pastefy',
      },
    },
    bootstrapConfigPath: process.env.STARQUERY_BOOTSTRAP_CONFIG_PATH,
  }
}
