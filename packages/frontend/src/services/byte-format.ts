export function formatBytes(value: unknown) {
  const size = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(size) || size < 0) {
    return ''
  }

  if (size < 1024) {
    return `${size} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let current = size / 1024
  let unitIndex = 0

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024
    unitIndex += 1
  }

  const precision = current >= 100 ? 0 : current >= 10 ? 1 : 2
  return `${current.toFixed(precision)} ${units[unitIndex]}`
}
