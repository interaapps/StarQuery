import {DefaultSQLAdapter, QueryResult} from "../default-sql-adapter/DefaultSQLAdapter";
import mysql from "mysql2/promise";

export class MySQLAdapter extends DefaultSQLAdapter {
    connection: mysql.Connection;

    constructor(private options: {
        host: string
        user: string
        password: string
        database: string
    }) {
        super();
    }

    async connect() {
        this.connection = await mysql.createConnection({
            host: this.options.host,
            user: this.options.user,
            password: this.options.password,
            database: this.options.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        })
    }

    async getTables() {
        const [rows, fields] = await this.connection!.query(`SELECT *  FROM information_schema.tables where table_schema='${this.options.database}' `);

        return (rows as any[]).map((r) => ({
            name: r.TABLE_NAME
        }))
    }

    async close() {
        await this.connection?.end()
    }

    async execute(sql: string, params?: any[]|undefined): Promise<QueryResult> {
        const res = await this.connection!.query(sql, params);

        if (Array.isArray(res)) {
            return {
                type: 'SELECT',
                rows: res[0] as any[],
                columns: res[1].map(c => c.name as string)
            }
        }

        return {
            type: 'RESULT',
            result: res[0]
        }
    }
}