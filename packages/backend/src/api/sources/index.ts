import expressWs from "express-ws";
import {Channel, sources} from "../../index";
import {DefaultSQLAdapter} from "../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter";
import query from "../../adapters/database/sql/default-sql-adapter/routes/query";
import {SQL_ADAPTERS} from "../../adapters/database/sql";
import {Request, Response} from "express";
import {MySQLAdapter} from "../../adapters/database/sql/mysql-adapter/MySQLAdapter";

const routes = {
    query
}

export function setupSourcesApi(server: expressWs.Application) {

    server.get("/api/projects/:project/sources", (req, res) => {
        console.log('Getting sources')
        const sourcesList = Object.keys(sources).map((key) => {
            return {
                name: key,
                type: sources[key].type
            }
        })
        res.json(sourcesList)
    })


    server.get('/api/projects/:project/sources/:source/tables', async (req: Request, res: Response) => {
        const source = sources[req.params.source]
        if (!source) {
            res.status(404).send('Source not found')
            return;
        }

        const adapter = new MySQLAdapter(source.options)
        await adapter.connect()
        const tables = await adapter.getTables()
        await adapter.close()

        res.json(tables)
    })

    server.ws('/api/projects/:project/sources/:source/sql', (ws, req) => {
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
                adapter = new SQL_ADAPTERS[source.type](source.options)
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