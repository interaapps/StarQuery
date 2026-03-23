import {DefaultSQLAdapter} from "../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter";
import * as WebSocket from "ws";

export class Channel {
    id: string
    ws: WebSocket.WebSocket
    source: string
    adapter: DefaultSQLAdapter

    constructor(id: string, ws: WebSocket.WebSocket, source: string, adapter: DefaultSQLAdapter) {
        this.id = id
        this.ws = ws
        this.source = source
        this.adapter = adapter
    }

    send(data: any) {
        this.ws.send(JSON.stringify({
            id: this.id,
            ...data
        }))
    }

    error() {
        this.send({
            type: 'error',
            error: true
        })
    }

    close() {
        this.send(JSON.stringify({
            type: 'close',
        }))
    }
}