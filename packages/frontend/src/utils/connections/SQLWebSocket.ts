type SqlWebSocketMessage = {
  id?: number
  type?: string
  error?: unknown
  [key: string]: unknown
}

export class SQLWebSocket {
  private ws: WebSocket | undefined

  private currentMessageId = 1
  private isConnected = false

  listeners = new Map<number, (data: SqlWebSocketMessage) => void>()

  constructor(private url: string) {}

  connect() {
    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(this.url)

      this.ws.onmessage = (message) => {
        const data = JSON.parse(String(message.data)) as SqlWebSocketMessage

        if (data.id) {
          const listener = this.listeners.get(data.id)
          if (listener) {
            listener(data)
          }

          if (data.type === 'close') {
            this.listeners.delete(data.id)
            return
          }
        } else {
          console.log('No ID in message', data)
        }
      }
      this.ws.onopen = async () => {
        await this.sendWithResponse({ type: 'connect' })
        this.isConnected = true
        resolve()
      }
      this.ws.onclose = () => {
        this.isConnected = false
      }
      this.ws.onerror = (error) => {
        reject(error)
      }
    })
  }

  connectIfNotConnected() {
    if (!this.isConnected) {
      return this.connect()
    }
    return Promise.resolve()
  }

  send(data: Record<string, unknown>) {
    this.ws!.send(JSON.stringify(data))
  }

  sendWithResponse<T extends SqlWebSocketMessage = SqlWebSocketMessage>(
    data: Record<string, unknown>,
  ) {
    this.currentMessageId++
    const messageId = this.currentMessageId
    return new Promise<T>((resolve, reject) => {
      this.listeners.set(messageId, (data) => {
        if (data.error) {
          this.listeners.delete(messageId)
          reject(data.error)
        } else {
          if (data.type === 'close' || data.type === 'error' || data.type === 'RESULT' || data.type === 'SELECT') {
            this.listeners.delete(messageId)
          }
          resolve(data as T)
        }
      })

      this.send({
        id: messageId,
        ...data,
      })
    })
  }

  query(sql: string) {
    void sql
  }
}
