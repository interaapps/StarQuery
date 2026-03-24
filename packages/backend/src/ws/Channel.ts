import type { DefaultSQLAdapter } from '../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import type { WebSocket } from 'ws'

export class Channel {
  id: string
  ws: WebSocket
  source: string
  adapter: DefaultSQLAdapter

  constructor(id: string, ws: WebSocket, source: string, adapter: DefaultSQLAdapter) {
    this.id = id
    this.ws = ws
    this.source = source
    this.adapter = adapter
  }

  send(data: unknown) {
    this.ws.send(
      JSON.stringify({
        id: this.id,
        ...(typeof data === 'object' && data ? data : { data }),
      }),
    )
  }

  error() {
    this.send({
      type: 'error',
      error: true,
    })
  }

  close() {
    this.send({
      type: 'close',
    })
  }
}
