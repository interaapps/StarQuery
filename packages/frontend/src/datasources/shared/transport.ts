import { deepMergeRecords, isPlainObjectRecord, setValueAtPath } from '@/datasources/shared/object-path'

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
  port: number | null
  username?: string
  authMethod: SshAuthMethod
  password?: string
  privateKey?: string
  passphrase?: string
  hostKeyFingerprint?: string
  remoteHost?: string
  remotePort?: number | null
}

const TLS_MODES = new Set<TlsMode>(['disable', 'require', 'verify-ca', 'verify-full'])

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
    remotePort: null,
  }
}

export function getTransportSecretFields(input: {
  ssh?: boolean
  tls?: boolean
}) {
  return [
    ...(input.ssh ? ['ssh.password', 'ssh.privateKey', 'ssh.passphrase'] : []),
    ...(input.tls ? ['tls.clientKeyPem', 'tls.clientKeyPassphrase'] : []),
  ]
}

function inferLegacyTlsEnabled(config: Record<string, unknown>) {
  if (typeof config.ssl === 'boolean') {
    return config.ssl
  }

  if (typeof config.useSSL === 'boolean') {
    return config.useSSL
  }

  if (typeof config.node === 'string') {
    return /^https:\/\//i.test(config.node.trim())
  }

  return false
}

export function hydrateTransportConfig(
  rawConfig: Record<string, unknown>,
  defaultConfig: Record<string, unknown>,
) {
  let nextConfig = deepMergeRecords(defaultConfig, rawConfig)

  if (isPlainObjectRecord(defaultConfig.tls)) {
    const rawTls = isPlainObjectRecord(rawConfig.tls) ? rawConfig.tls : {}
    const rawMode =
      typeof rawTls.mode === 'string' && TLS_MODES.has(rawTls.mode as TlsMode)
        ? (rawTls.mode as TlsMode)
        : null

    nextConfig = setValueAtPath(
      nextConfig,
      'tls.mode',
      rawMode ?? (inferLegacyTlsEnabled(rawConfig) ? 'require' : 'disable'),
    )
  }

  if (isPlainObjectRecord(defaultConfig.ssh) && !isPlainObjectRecord(nextConfig.ssh)) {
    nextConfig = setValueAtPath(nextConfig, 'ssh', createDefaultSshTunnelConfig())
  }

  return nextConfig
}

export function canSubmitTransportConfig(input: {
  config: Record<string, unknown>
  redactedSecretFields: string[]
}) {
  const sshConfig = isPlainObjectRecord(input.config.ssh)
    ? (input.config.ssh as Record<string, unknown>)
    : null

  if (!sshConfig || sshConfig.enabled !== true) {
    return true
  }

  const authMethod = sshConfig.authMethod === 'privateKey' ? 'privateKey' : 'password'
  const hasPassword =
    String(sshConfig.password ?? '').trim().length > 0 ||
    input.redactedSecretFields.includes('ssh.password')
  const hasPrivateKey =
    String(sshConfig.privateKey ?? '').trim().length > 0 ||
    input.redactedSecretFields.includes('ssh.privateKey')

  return Boolean(
    String(sshConfig.host ?? '').trim() &&
      Number(sshConfig.port ?? 0) > 0 &&
      String(sshConfig.username ?? '').trim() &&
      (authMethod === 'password' ? hasPassword : hasPrivateKey) &&
      (sshConfig.remotePort === undefined ||
        sshConfig.remotePort === null ||
        sshConfig.remotePort === '' ||
        Number(sshConfig.remotePort) > 0),
  )
}
