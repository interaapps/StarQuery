import axios from 'axios'

export function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detailText = Array.isArray(error.response?.data?.details)
      ? error.response.data.details
          .filter((detail: unknown): detail is string => typeof detail === 'string')
          .join(' | ')
      : null
    const responseMessage =
      typeof error.response?.data?.error === 'string'
        ? error.response.data.error
        : typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : null

    if (responseMessage) {
      return detailText ? `${responseMessage} (${detailText})` : responseMessage
    }

    if (error.code === 'ERR_NETWORK') {
      return 'The selected server is unreachable right now.'
    }
  }

  return error instanceof Error ? error.message : fallback
}
