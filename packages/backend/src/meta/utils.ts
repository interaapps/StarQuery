export function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function nowIso() {
  return new Date().toISOString()
}

export function nowForDriver(driver: 'sqlite' | 'mysql') {
  if (driver === 'mysql') {
    return new Date().toISOString().slice(0, 19).replace('T', ' ')
  }

  return nowIso()
}

function parseDateInput(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function normalizeDateTimeForDriver(value: string | Date, driver: 'sqlite' | 'mysql') {
  const parsed = parseDateInput(value)
  if (!parsed) {
    return String(value)
  }

  if (driver === 'mysql') {
    return parsed.toISOString().slice(0, 19).replace('T', ' ')
  }

  return parsed.toISOString()
}

export function normalizeNullableDateTimeForDriver(
  value: string | Date | null | undefined,
  driver: 'sqlite' | 'mysql',
) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return normalizeDateTimeForDriver(value, driver)
}

export function normalizeStoredDateTimeToIso(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const stringValue = String(value)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(stringValue)) {
    return `${stringValue.replace(' ', 'T')}Z`
  }

  const parsed = parseDateInput(stringValue)
  return parsed ? parsed.toISOString() : stringValue
}

export function parseJsonArray(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? '[]'))
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : []
  } catch {
    return []
  }
}

export function parseJsonObject(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? '{}'))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
