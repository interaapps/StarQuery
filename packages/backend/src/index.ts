import bodyParser from 'body-parser'
import express, { Request, Response } from 'express'
import expressWs from 'express-ws'
import cors from 'cors'
import {setupSourcesApi} from "./api/sources";
import {MySQLAdapter} from "./adapters/database/sql/mysql-adapter/MySQLAdapter";

export const sources = {
    pastefy: {
        type: 'mysql',
        options: {
            adapter: MySQLAdapter,
            host: 'localhost',
            user: 'pastefy',
            password: 'pastefy',
            database: 'pastefy',
        }
    }
}

const server = expressWs(express()).app
server.use(bodyParser.json())
server.use(cors())

setupSourcesApi(server)

async function main() {
    server.listen(3000)
}


main().catch(console.error);
export {Channel} from "./ws/Channel";