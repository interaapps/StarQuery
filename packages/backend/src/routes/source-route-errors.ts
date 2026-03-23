import type { Response } from 'express'

type SourceErrorResponse = {
  error: string
  details?: string[]
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function getSourceErrorResponse(error: unknown, fallback: string): SourceErrorResponse {
  const candidate = error && typeof error === 'object' ? (error as Record<string, unknown>) : {}

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
