import type { AppContext } from '../../app-context.ts'
import type { DataSourceRecord } from '../../meta/types.ts'
import { getDataSourceModule } from '../registry.ts'
import type { ResolvedNetworkTransport, SshTunnelConfig, TlsConfig } from './transport.ts'

export type ResolvedDataSourceConfig = {
  config: Record<string, unknown>
  cleanup: () => Promise<void>
}

export async function resolveDataSourceRuntime(
  source: Pick<DataSourceRecord, 'type' | 'config'>,
  context: AppContext,
): Promise<ResolvedDataSourceConfig> {
  const dataSourceModule = getDataSourceModule(source.type)
  const normalizedConfig = dataSourceModule.normalizeConfig(source.config)

  if (!dataSourceModule.resolveRuntimeConfig) {
    return {
      config: normalizedConfig as Record<string, unknown>,
      cleanup: async () => {},
    }
  }

  const resolved = await dataSourceModule.resolveRuntimeConfig(normalizedConfig, context)
  return {
    config: resolved.config,
    cleanup: resolved.cleanup ?? (async () => {}),
  }
}

export async function resolveTcpTransportConfig<TConfig extends Record<string, unknown> & {
  host: string
  port: number
  tls?: TlsConfig
  ssh?: SshTunnelConfig
}>(
  config: TConfig,
  context: AppContext,
) {
  const transport: ResolvedNetworkTransport = {
    connectHost: config.host,
    connectPort: config.port,
    serverHost: config.host,
    serverPort: config.port,
    tls: config.tls,
    ssh: config.ssh,
  }

  if (!config.ssh?.enabled) {
    return {
      config: {
        ...config,
        transport,
      },
      cleanup: async () => {},
    }
  }

  const tunnel = await context.sshTunnelManager.acquireTunnel({
    ssh: config.ssh,
    targetHost: config.host,
    targetPort: config.port,
  })

  return {
    config: {
      ...config,
      transport: {
        ...transport,
        connectHost: tunnel.host,
        connectPort: tunnel.port,
      },
    },
    cleanup: async () => {
      await tunnel.release()
    },
  }
}
