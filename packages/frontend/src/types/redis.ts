export type RedisQueryTabData = {
  serverId: string
  serverUrl: string
  projectId: string
  sourceId: string
  sourceName: string
  sourceType: 'redis'
  initialCommand?: string
}

export type RedisQueryResponse = {
  command: string
  commandName: string
  args: string[]
  readOnly: boolean
  reply: unknown
}
