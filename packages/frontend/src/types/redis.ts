export type RedisQueryResponse = {
  command: string
  commandName: string
  args: string[]
  readOnly: boolean
  reply: unknown
}
