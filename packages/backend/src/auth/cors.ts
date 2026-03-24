import type { CorsOptions } from 'cors'
import type { AppConfig } from '../config/app-config.ts'

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function createCorsOptions(config: AppConfig): CorsOptions {
  if (config.mode === 'local') {
    return {
      origin: true,
    }
  }

  const allowedOrigins = new Set(
    [
      ...config.corsAllowedOrigins.map((origin) => normalizeOrigin(origin)).filter((origin): origin is string => Boolean(origin)),
      ...(config.publicUrl ? [normalizeOrigin(config.publicUrl)] : []),
    ].filter((origin): origin is string => Boolean(origin)),
  )

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      const normalizedOrigin = normalizeOrigin(origin)
      callback(null, Boolean(normalizedOrigin && allowedOrigins.has(normalizedOrigin)))
    },
  }
}
