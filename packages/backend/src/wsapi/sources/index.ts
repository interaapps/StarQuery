import expressWs from "express-ws";
import {sources} from "../../index";
import WebSocket from "ws";
import {DefaultSQLAdapter} from "../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter";
import query from "../../adapters/database/sql/default-sql-adapter/routes/query";

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

const routes = {
    query
}


export function setupSourcesApi(server: expressWs.Application) {
    console.log('Setting up /api/organizations/:orga/projects/:project/source/:source/sql')
    server.ws('/api/organizations/:orga/projects/:project/source/:source/sql', (ws, req) => {
        console.log('Creating websocket')
        const source = sources[req.params.source]
        if (!source) {
            ws.send(JSON.stringify({error: 'Source not found'}))
            ws.close()
            return;
        }

        let adapter: DefaultSQLAdapter = undefined
        ws.onopen = () => {
            console.log('Opened connection')
        }

        ws.on('message', async (msg) => {
            const data = JSON.parse(msg.toString())

            const id = data.id
            const channel = new Channel(id, ws, source.type, adapter)

            if (data.type === 'connect') {
                console.log('Connecting', source.options)
                adapter = new source.adapter(source.options)
                try {
                    await adapter.connect()
                    channel.close()
                } catch (e) {
                    channel.error()
                }
                return;
            }

            try {
                const res = await routes[data.type]?.(channel, adapter, data)

                if (res) {
                    channel.send(res)
                }
            } catch {
                channel.error()
            }
        })
    })
}