import {MySQLAdapter} from "./database/sql/mysql-adapter/MySQLAdapter.ts";

export default {
    database: {
        sql: {
            mysql: MySQLAdapter
        }
    },
    objectstorage: {
        s3: {}
    },
    cache: {
        redis: {}
    },
    queue: {
        redis: {}
    },
    search: {
        elasticsearch: {}
    }
}
