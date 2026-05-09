function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function cloneContainer(value: unknown) {
  return isPlainObject(value) ? { ...value } : {}
}

export function getValueAtPath(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.').filter(Boolean)
  let current: unknown = source

  for (const segment of segments) {
    if (!isPlainObject(current)) {
      return undefined
    }

    current = current[segment]
  }

  return current
}

export function setValueAtPath(source: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split('.').filter(Boolean)
  if (!segments.length) {
    return source
  }

  const nextSource = { ...source }
  let currentTarget: Record<string, unknown> = nextSource
  let currentSource: Record<string, unknown> | undefined = source

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!
    const isLeaf = index === segments.length - 1

    if (isLeaf) {
      currentTarget[segment] = value
      continue
    }

    const nextSourceValue: unknown = currentSource?.[segment]
    const nextTargetValue = cloneContainer(nextSourceValue)
    currentTarget[segment] = nextTargetValue
    currentTarget = nextTargetValue
    currentSource = isPlainObject(nextSourceValue) ? nextSourceValue : undefined
  }

  return nextSource
}

export function deleteValueAtPath(source: Record<string, unknown>, path: string) {
  const segments = path.split('.').filter(Boolean)
  if (!segments.length) {
    return source
  }

  const nextSource = { ...source }
  const stack: Array<{
    container: Record<string, unknown>
    key: string
  }> = []

  let currentTarget: Record<string, unknown> = nextSource
  let currentSource: Record<string, unknown> | undefined = source

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!
    const nextSourceValue: unknown = currentSource?.[segment]
    const nextTargetValue = cloneContainer(nextSourceValue)
    currentTarget[segment] = nextTargetValue
    stack.push({ container: currentTarget, key: segment })
    currentTarget = nextTargetValue
    currentSource = isPlainObject(nextSourceValue) ? nextSourceValue : undefined
  }

  delete currentTarget[segments[segments.length - 1]!]

  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const entry = stack[index]!
    const value = entry.container[entry.key]
    if (isPlainObject(value) && Object.keys(value).length === 0) {
      delete entry.container[entry.key]
    }
  }

  return nextSource
}

export function deepMergeRecords(
  baseValue: Record<string, unknown>,
  patchValue: Record<string, unknown>,
): Record<string, unknown> {
  const nextValue: Record<string, unknown> = { ...baseValue }

  for (const [key, value] of Object.entries(patchValue)) {
    if (isPlainObject(value) && isPlainObject(baseValue[key])) {
      nextValue[key] = deepMergeRecords(baseValue[key] as Record<string, unknown>, value)
      continue
    }

    nextValue[key] = value
  }

  return nextValue
}

export function isPlainObjectRecord(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value)
}
