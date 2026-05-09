import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import { optionalBoolean, optionalString, requirePort, requireString } from './config-helpers.ts'

export type TlsMode = 'disable' | 'require' | 'verify-ca' | 'verify-full'
export type SshAuthMethod = 'password' | 'privateKey'

export type TlsConfig = {
  mode: TlsMode
  caCertPem?: string
  clientCertPem?: string
  clientKeyPem?: string
  clientKeyPassphrase?: string
  serverName?: string
}

export type SshTunnelConfig = {
  enabled: boolean
  host?: string
  port: number
  username?: string
  authMethod: SshAuthMethod
  password?: string
  privateKey?: string
  passphrase?: string
  hostKeyFingerprint?: string
  remoteHost?: string
  remotePort?: number
}

export type ResolvedNetworkTransport = {
  connectHost: string
  connectPort: number
  serverHost: string
  serverPort: number
  tls?: TlsConfig
  ssh?: SshTunnelConfig
}

const TLS_MODES = new Set<TlsMode>(['disable', 'require', 'verify-ca', 'verify-full'])
const SSH_AUTH_METHODS = new Set<SshAuthMethod>(['password', 'privateKey'])

export function getTransportSecretFields(input: {
  ssh?: boolean
  tls?: boolean
}) {
  return [
    ...(input.ssh ? ['ssh.password', 'ssh.privateKey', 'ssh.passphrase'] : []),
    ...(input.tls ? ['tls.clientKeyPem', 'tls.clientKeyPassphrase'] : []),
  ]
}

export function createDefaultTlsConfig(): TlsConfig {
  return {
    mode: 'disable',
    caCertPem: '',
    clientCertPem: '',
    clientKeyPem: '',
    clientKeyPassphrase: '',
    serverName: '',
  }
}

export function createDefaultSshTunnelConfig(): SshTunnelConfig {
  return {
    enabled: false,
    host: '',
    port: 22,
    username: '',
    authMethod: 'password',
    password: '',
    privateKey: '',
    passphrase: '',
    hostKeyFingerprint: '',
    remoteHost: '',
    remotePort: undefined,
  }
}

function getNestedRecord(config: Record<string, unknown>, key: string) {
  const value = config[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeTlsMode(value: unknown) {
  if (typeof value === 'string' && TLS_MODES.has(value as TlsMode)) {
    return value as TlsMode
  }

  return null
}

export function normalizeTlsConfig(
  config: Record<string, unknown>,
  options: {
    legacyBooleanKeys?: string[]
    defaultEnabled?: boolean
  } = {},
): TlsConfig {
  const tlsConfig = getNestedRecord(config, 'tls')
  const explicitMode = normalizeTlsMode(tlsConfig.mode)
  let legacyEnabled = options.defaultEnabled ?? false

  for (const key of options.legacyBooleanKeys ?? []) {
    if (key in config) {
      legacyEnabled = optionalBoolean(config, key, legacyEnabled)
      break
    }
  }

  return {
    mode: explicitMode ?? (legacyEnabled ? 'require' : 'disable'),
    caCertPem: optionalString(tlsConfig, 'caCertPem'),
    clientCertPem: optionalString(tlsConfig, 'clientCertPem'),
    clientKeyPem: optionalString(tlsConfig, 'clientKeyPem'),
    clientKeyPassphrase: optionalString(tlsConfig, 'clientKeyPassphrase'),
    serverName: optionalString(tlsConfig, 'serverName'),
  }
}

export function normalizeSshTunnelConfig(config: Record<string, unknown>): SshTunnelConfig {
  const sshConfig = getNestedRecord(config, 'ssh')
  const enabled = optionalBoolean(sshConfig, 'enabled', false)
  const authMethodValue = optionalString(sshConfig, 'authMethod')
  const authMethod =
    authMethodValue && SSH_AUTH_METHODS.has(authMethodValue as SshAuthMethod)
      ? (authMethodValue as SshAuthMethod)
      : 'password'

  return {
    enabled,
    host: enabled ? requireString(sshConfig, 'host', 'SSH host') : optionalString(sshConfig, 'host'),
    port: enabled ? requirePort(sshConfig, 22) : requirePort(sshConfig, 22),
    username: enabled
      ? requireString(sshConfig, 'username', 'SSH username')
      : optionalString(sshConfig, 'username'),
    authMethod,
    password:
      authMethod === 'password'
        ? enabled
          ? requireString(sshConfig, 'password', 'SSH password')
          : optionalString(sshConfig, 'password')
        : undefined,
    privateKey:
      authMethod === 'privateKey'
        ? enabled
          ? requireString(sshConfig, 'privateKey', 'SSH private key')
          : optionalString(sshConfig, 'privateKey')
        : undefined,
    passphrase: authMethod === 'privateKey' ? optionalString(sshConfig, 'passphrase') : undefined,
    hostKeyFingerprint: optionalString(sshConfig, 'hostKeyFingerprint'),
    remoteHost: optionalString(sshConfig, 'remoteHost'),
    remotePort:
      sshConfig.remotePort === undefined || sshConfig.remotePort === null || sshConfig.remotePort === ''
        ? undefined
        : requirePort(sshConfig, 22, 'remotePort'),
  }
}

export function isTlsEnabled(config?: TlsConfig | null) {
  return Boolean(config && config.mode !== 'disable')
}

export function getTlsServerName(config: TlsConfig | undefined, fallbackHost: string) {
  return config?.serverName?.trim() || fallbackHost
}

export function createNodeTlsOptions(config: TlsConfig | undefined, fallbackHost: string) {
  if (!isTlsEnabled(config)) {
    return undefined
  }

  const servername = getTlsServerName(config, fallbackHost)
  const tlsOptions: tls.ConnectionOptions = {
    servername,
    rejectUnauthorized: config?.mode === 'verify-ca' || config?.mode === 'verify-full',
  }

  if (config?.mode === 'verify-ca') {
    tlsOptions.checkServerIdentity = () => undefined
  }

  if (config?.caCertPem?.trim()) {
    tlsOptions.ca = config.caCertPem
  }

  if (config?.clientCertPem?.trim()) {
    tlsOptions.cert = config.clientCertPem
  }

  if (config?.clientKeyPem?.trim()) {
    tlsOptions.key = config.clientKeyPem
  }

  if (config?.clientKeyPassphrase?.trim()) {
    tlsOptions.passphrase = config.clientKeyPassphrase
  }

  return tlsOptions
}

export function createMysqlTlsOptions(config: TlsConfig | undefined) {
  if (!isTlsEnabled(config)) {
    return undefined
  }

  return {
    ca: config?.caCertPem,
    cert: config?.clientCertPem,
    key: config?.clientKeyPem,
    passphrase: config?.clientKeyPassphrase,
    rejectUnauthorized: config?.mode === 'verify-ca' || config?.mode === 'verify-full',
    verifyIdentity: config?.mode === 'verify-full',
  }
}

export function createHttpTransportAgent(input: {
  secure: boolean
  transport: ResolvedNetworkTransport
}) {
  if (!input.secure) {
    const agent = new NetAwareHttpAgent({
      connectHost: input.transport.connectHost,
      connectPort: input.transport.connectPort,
    })
    return agent
  }

  return new NetAwareHttpsAgent({
    connectHost: input.transport.connectHost,
    connectPort: input.transport.connectPort,
    tlsOptions: createNodeTlsOptions(input.transport.tls, input.transport.serverHost),
  })
}

type NetAwareAgentInput = {
  connectHost: string
  connectPort: number
}

type NetAwareHttpsAgentInput = NetAwareAgentInput & {
  tlsOptions?: tls.ConnectionOptions
}

class NetAwareHttpAgent extends http.Agent {
  constructor(private readonly input: NetAwareAgentInput) {
    super({ keepAlive: true })
  }

  createConnection(options: net.NetConnectOpts) {
    return net.connect({
      ...options,
      host: this.input.connectHost,
      port: this.input.connectPort,
    })
  }
}

class NetAwareHttpsAgent extends https.Agent {
  constructor(private readonly input: NetAwareHttpsAgentInput) {
    super({ keepAlive: true })
  }

  createConnection(options: tls.ConnectionOptions) {
    return tls.connect({
      ...options,
      ...this.input.tlsOptions,
      host: this.input.connectHost,
      port: this.input.connectPort,
      servername: this.input.tlsOptions?.servername ?? options.servername ?? options.host,
    })
  }
}

export function destroyHttpTransportAgent(agent: http.Agent | https.Agent | undefined) {
  agent?.destroy()
}
