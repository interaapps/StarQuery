import {MySQLAdapter} from "./database/sql/mysql-adapter/MySQLAdapter";

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