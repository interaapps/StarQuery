import type { Response } from 'express'

type SourceErrorResponse = {
  error: string
  details?: string[]
}

function getErrorCandidate(error: unknown) {
  return error && typeof error === 'object' ? (error as Record<string, unknown>) : {}
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function isUniqueConstraintError(error: unknown) {
  const candidate = getErrorCandidate(error)
  const code = getStringValue(candidate.code)
  const sqlState = getStringValue(candidate.sqlState)
  const message =
    getStringValue(candidate.sqlMessage) ??
    getStringValue(candidate.message) ??
    ''

  return (
    code === 'ER_DUP_ENTRY' ||
    code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
    sqlState === '23000' ||
    /duplicate entry/i.test(message) ||
    /unique constraint failed/i.test(message)
  )
}

export function getSourceErrorResponse(error: unknown, fallback: string): SourceErrorResponse {
  const candidate = getErrorCandidate(error)

  const primaryMessage =
    getStringValue(candidate.sqlMessage) ??
    getStringValue(candidate.detail) ??
    getStringValue(candidate.message) ??
    fallback

  const details = [
    getStringValue(candidate.code),
    getStringValue(candidate.errno),
    getStringValue(candidate.sqlState),
    getStringValue(candidate.hint),
    getStringValue(candidate.where),
  ].filter((value, index, values): value is string => value !== null && values.indexOf(value) === index)

  return details.length ? { error: primaryMessage, details } : { error: primaryMessage }
}

export function sendSourceError(res: Response, error: unknown, fallback: string, status = 400) {
  res.status(status).json(getSourceErrorResponse(error, fallback))
}
