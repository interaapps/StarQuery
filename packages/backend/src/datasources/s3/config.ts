import { optionalBoolean, optionalString, requirePort, requireString } from '../shared/config-helpers.ts'

export type S3CompatibleConfig = {
  endPoint: string
  port: number
  useSSL: boolean
  accessKey: string
  secretKey: string
  region?: string
  bucket?: string
  sessionToken?: string
  pathStyle?: boolean
}

export function normalizeS3CompatibleConfig(
  config: Record<string, unknown>,
  defaults: {
    useSSL: boolean
    pathStyle: boolean
    port?: number
  },
): S3CompatibleConfig {
  return {
    endPoint: requireString(config, 'endPoint'),
    port: requirePort(config, defaults.port ?? 9000),
    useSSL: optionalBoolean(config, 'useSSL', defaults.useSSL),
    accessKey: requireString(config, 'accessKey'),
    secretKey: requireString(config, 'secretKey'),
    region: optionalString(config, 'region'),
    bucket: optionalString(config, 'bucket'),
    sessionToken: optionalString(config, 'sessionToken'),
    pathStyle: optionalBoolean(config, 'pathStyle', defaults.pathStyle),
  }
}
