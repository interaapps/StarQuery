import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import { attachAuth } from './auth/middleware.ts'
import { createCorsOptions } from './auth/cors.ts'
import type { AppContext } from './app-context.ts'
import { loadBootstrapConfig } from './bootstrap/load-bootstrap-config.ts'
import { loadAppConfig, type AppConfig } from './config/app-config.ts'
import { MetaStore } from './meta/store.ts'
import { registerAdminRoutes } from './routes/admin-routes.ts'
import { registerAuthRoutes } from './routes/auth-routes.ts'
import { registerProjectRoutes } from './routes/projects-routes.ts'
import { registerServerRoutes } from './routes/server-routes.ts'
import { registerSourceRoutes } from './routes/source-routes.ts'

export type StartBackendServerOptions = Partial<Omit<AppConfig, 'metaStore' | 'auth'>> & {
  auth?: Partial<Omit<AppConfig['auth'], 'seedAdmin' | 'openId'>> & {
    seedAdmin?: AppConfig['auth']['seedAdmin']
    openId?: AppConfig['auth']['openId']
  }
  metaStore?: Partial<Omit<AppConfig['metaStore'], 'mysql'>> & {
    mysql?: Partial<AppConfig['metaStore']['mysql']>
  }
}

function resolveConfig(overrides: StartBackendServerOptions = {}): AppConfig {
  const config = loadAppConfig()
  const mode = overrides.mode ?? config.mode

  return {
    ...config,
    ...overrides,
    mode,
    auth: {
      ...config.auth,
      ...overrides.auth,
      enabled: overrides.auth?.enabled ?? mode !== 'local',
      seedAdmin: overrides.auth?.seedAdmin ?? config.auth.seedAdmin,
      openId: overrides.auth?.openId ?? config.auth.openId,
    },
    metaStore: {
      ...config.metaStore,
      ...overrides.metaStore,
      mysql: {
        ...config.metaStore.mysql,
        ...overrides.metaStore?.mysql,
      },
    },
  }
}

export async function startBackendServer(overrides: StartBackendServerOptions = {}) {
  const config = resolveConfig(overrides)
  const metaStore = new MetaStore(config)
  await metaStore.initialize()

  const bootstrapConfig = loadBootstrapConfig(config)
  if (bootstrapConfig) {
    await metaStore.applyBootstrapConfig(bootstrapConfig)
  }

  const context: AppContext = {
    config,
    metaStore,
  }

  const app = express()
  app.use(bodyParser.json({ limit: config.requestBodyLimit }))
  app.use(cors(createCorsOptions(config)))
  app.use(attachAuth(context))

  registerServerRoutes(app, context)
  registerAuthRoutes(app, context)
  registerAdminRoutes(app, context)
  registerProjectRoutes(app, context)
  registerSourceRoutes(app, context)

  const server = await new Promise<Server>((resolve, reject) => {
    const httpServer = app.listen(config.port, config.host, () => resolve(httpServer))
    httpServer.once('error', reject)
  })

  const address = server.address()
  const port =
    typeof address === 'object' && address && 'port' in address
      ? (address as AddressInfo).port
      : config.port
  const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host
  let closed = false

  console.log(`starquery backend listening on ${config.host}:${port}`)

  return {
    app,
    server,
    metaStore,
    config: {
      ...config,
      port,
    },
    url: `http://${host}:${port}`,
    close: async () => {
      if (closed) return
      closed = true
      await metaStore.close()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
    },
  }
}
