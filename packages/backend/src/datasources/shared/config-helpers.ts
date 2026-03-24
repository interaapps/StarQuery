export function requireString(config: Record<string, unknown>, key: string, label = key) {
  const value = config[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Datasource config requires ${label}`)
  }

  return value.trim()
}

export function optionalString(config: Record<string, unknown>, key: string) {
  const value = config[key]
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  return String(value).trim() || undefined
}

export function requirePort(config: Record<string, unknown>, fallback: number, key = 'port') {
  const value = config[key]
  const nextValue = Number(value ?? fallback)
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    throw new Error(`Datasource config requires a valid ${key}`)
  }

  return nextValue
}

export function optionalBoolean(config: Record<string, unknown>, key: string, fallback = false) {
  const value = config[key]
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }

  return Boolean(value)
}
