import bodyParser from 'body-parser'
import express, { Request, Response } from 'express'
import expressWs from 'express-ws'
import {setupSourcesApi} from "./wsapi/sources";
import {MySQLAdapter} from "./adapters/database/sql/mysql-adapter/MySQLAdapter";

export const sources = {
    pastefy: {
        type: 'sql',
        adapter: MySQLAdapter,
        options: {
            host: 'localhost',
            user: 'pastefy',
            password: 'pastefy',
            database: 'pastefy',
        }
    }
}

const server = expressWs(express()).app
server.use(bodyParser.json())

server.get('/sources/:source/tables', async (req: Request, res: Response) => {
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

setupSourcesApi(server)

async function main() {
    server.listen(3000)
}


main().catch(console.error);