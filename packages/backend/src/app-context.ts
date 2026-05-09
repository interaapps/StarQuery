import type { AppConfig } from './config/app-config.ts'
import type { SshTunnelManager } from './datasources/shared/ssh-tunnel-manager.ts'
import type { MetaStore } from './meta/store.ts'

export type AppContext = {
  config: AppConfig
  metaStore: MetaStore
  sshTunnelManager: SshTunnelManager
}
