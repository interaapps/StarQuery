import { optionalBoolean, optionalString, requirePort, requireString } from '../shared/config-helpers.ts'
import type { ResolvedNetworkTransport, SshTunnelConfig, TlsConfig } from '../shared/transport.ts'
import { normalizeSshTunnelConfig, normalizeTlsConfig } from '../shared/transport.ts'

export type S3CompatibleConfig = {
  endPoint: string
  port: number
  useSSL: boolean
  tls?: TlsConfig
  ssh?: SshTunnelConfig
  accessKey: string
  secretKey: string
  region?: string
  bucket?: string
  sessionToken?: string
  pathStyle?: boolean
  transport?: ResolvedNetworkTransport
}

export function normalizeS3CompatibleConfig(
  config: Record<string, unknown>,
  defaults: {
    pathStyle: boolean
    port?: number
  },
): S3CompatibleConfig {
  const tls = normalizeTlsConfig(config, {
    legacyBooleanKeys: ['useSSL'],
    defaultEnabled: optionalBoolean(config, 'useSSL', defaults.port === 443),
  })

  return {
    endPoint: requireString(config, 'endPoint'),
    port: requirePort(config, defaults.port ?? 9000),
    useSSL: tls.mode !== 'disable',
    tls,
    ssh: normalizeSshTunnelConfig(config),
    accessKey: requireString(config, 'accessKey'),
    secretKey: requireString(config, 'secretKey'),
    region: optionalString(config, 'region'),
    bucket: optionalString(config, 'bucket'),
    sessionToken: optionalString(config, 'sessionToken'),
    pathStyle: optionalBoolean(config, 'pathStyle', defaults.pathStyle),
  }
}
