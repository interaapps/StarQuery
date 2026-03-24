import path from 'node:path'

export type AppMode = 'local' | 'hosted'
export type MetaStoreDriver = 'sqlite' | 'mysql'

export type AppConfig = {
  port: number
  host: string
  serverName: string
  mode: AppMode
  requestBodyLimit: string
  auth: {
    enabled: boolean
    sessionTtlHours: number
    apiKeyTtlDays: number
    seedAdmin?: {
      email: string
      password: string
      name: string
    }
    openId?: {
      issuer: string
      clientId: string
      clientSecret?: string
      scopes: string
    }
  }
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
  const mode = (process.env.STARQUERY_MODE as AppMode | undefined) ?? 'hosted'
  const metaDriver =
    (process.env.STARQUERY_META_DRIVER as MetaStoreDriver | undefined) ??
    (mode === 'hosted' ? 'mysql' : 'sqlite')
  const openIdIssuer = process.env.STARQUERY_AUTH_OPENID_ISSUER?.trim()
  const openIdClientId = process.env.STARQUERY_AUTH_OPENID_CLIENT_ID?.trim()
  const openIdClientSecret = process.env.STARQUERY_AUTH_OPENID_CLIENT_SECRET?.trim()
  const seedAdminEmail = process.env.STARQUERY_SEED_ADMIN_EMAIL?.trim()
  const seedAdminPassword = process.env.STARQUERY_SEED_ADMIN_PASSWORD?.trim()

  return {
    port: Number(process.env.PORT ?? '3000'),
    host: process.env.HOST ?? '0.0.0.0',
    serverName:
      process.env.STARQUERY_SERVER_NAME ?? (mode === 'hosted' ? 'Hosted Server' : 'Local Computer'),
    mode,
    requestBodyLimit: process.env.STARQUERY_REQUEST_BODY_LIMIT ?? '100mb',
    auth: {
      enabled: mode !== 'local',
      sessionTtlHours: Number(process.env.STARQUERY_AUTH_SESSION_TTL_HOURS ?? '720'),
      apiKeyTtlDays: Number(process.env.STARQUERY_AUTH_API_KEY_TTL_DAYS ?? '365'),
      seedAdmin:
        seedAdminEmail && seedAdminPassword
          ? {
              email: seedAdminEmail,
              password: seedAdminPassword,
              name: process.env.STARQUERY_SEED_ADMIN_NAME?.trim() || 'Admin',
            }
          : undefined,
      openId:
        openIdIssuer && openIdClientId
          ? {
              issuer: openIdIssuer,
              clientId: openIdClientId,
              clientSecret: openIdClientSecret,
              scopes: process.env.STARQUERY_AUTH_OPENID_SCOPES?.trim() || 'openid profile email',
            }
          : undefined,
    },
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
