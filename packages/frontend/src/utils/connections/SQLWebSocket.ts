export class SQLWebSocket {
  private ws: WebSocket | undefined

  private currentMessageId = 1
  private isConnected = false

  listeners = new Map<number, (data: any) => void>()

  constructor(private url: string) {}

  connect() {
    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(this.url)

      this.ws.onmessage = (message) => {
        const data = JSON.parse(message.data)

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

  send(data: any) {
    this.ws!.send(JSON.stringify(data))
  }

  sendWithResponse(data: any) {
    this.currentMessageId++
    return new Promise((resolve, reject) => {
      this.listeners.set(this.currentMessageId, (data: any) => {
        if (data.error) {
          reject(data.error)
        } else {
          resolve(data)
        }
      })

      this.send({
        id: this.currentMessageId,
        ...data,
      })
    })
  }

  query(sql: string) {}
}
