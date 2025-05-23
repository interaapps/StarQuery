import {Channel} from "../../index";
import {DefaultSQLAdapter} from "../../../../adapters/sql/default-sql-adapter/DefaultSQLAdapter";

export default async (channel: Channel, adapter: DefaultSQLAdapter, data: any) => {
    return await adapter.execute(data.query)
}