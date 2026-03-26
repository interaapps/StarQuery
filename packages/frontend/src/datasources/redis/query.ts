import type { GenericQueryResultTable } from '@/datasources/shared/query-view'
import type { RedisQueryResponse } from '@/types/redis'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return value
}

function buildFieldValueTable(input: {
  title: string
  fileBaseName: string
  rows: Record<string, unknown>[]
}): GenericQueryResultTable {
  return {
    title: input.title,
    columns: ['field', 'value'],
    rows: input.rows,
    exportFileBaseName: input.fileBaseName,
  }
}

export function summarizeRedisReply(reply: unknown) {
  if (reply === null || reply === undefined) {
    return 'No value returned.'
  }

  if (Array.isArray(reply)) {
    return `${reply.length} entr${reply.length === 1 ? 'y' : 'ies'} returned.`
  }

  if (isRecord(reply)) {
    return `${Object.keys(reply).length} field(s) returned.`
  }

  return String(reply)
}

export function buildRedisQueryResultTables(
  response: RedisQueryResponse,
  sourceName: string,
): GenericQueryResultTable[] {
  const fileBaseName = `${sourceName}-${response.commandName.toLowerCase()}`
  const reply = response.reply

  if (Array.isArray(reply)) {
    if (
      response.commandName.endsWith('SCAN') &&
      reply.length === 2 &&
      typeof reply[0] === 'string' &&
      Array.isArray(reply[1])
    ) {
      return [
        {
          title: `${response.commandName} cursor`,
          kind: response.commandName,
          columns: ['cursor'],
          rows: [{ cursor: reply[0] }],
          exportFileBaseName: `${fileBaseName}-cursor`,
        },
        {
          title: `${response.commandName} results`,
          kind: response.commandName,
          columns: ['value'],
          rows: reply[1].map((value) => ({ value: serializeValue(value) })),
          exportFileBaseName: `${fileBaseName}-results`,
        },
      ]
    }

    if (reply.every((entry) => isRecord(entry))) {
      const columnNames = Array.from(new Set(reply.flatMap((entry) => Object.keys(entry))))

      return [
        {
          title: response.commandName,
          kind: response.commandName,
          columns: columnNames,
          rows: reply.map((entry) =>
            Object.fromEntries(
              columnNames.map((columnName) => [columnName, serializeValue(entry[columnName])]),
            ),
          ),
          exportFileBaseName: fileBaseName,
        },
      ]
    }

    return [
      {
        title: response.commandName,
        kind: response.commandName,
        columns: ['index', 'value'],
        rows: reply.map((value, index) => ({
          index,
          value: serializeValue(value),
        })),
        exportFileBaseName: fileBaseName,
      },
    ]
  }

  if (isRecord(reply)) {
    return [
      buildFieldValueTable({
        title: response.commandName,
        fileBaseName,
        rows: Object.entries(reply).map(([field, value]) => ({
          field,
          value: serializeValue(value),
        })),
      }),
    ]
  }

  return [
    {
      title: response.commandName,
      kind: response.commandName,
      columns: ['value'],
      rows: [{ value: serializeValue(reply) }],
      exportFileBaseName: fileBaseName,
    },
  ]
}
