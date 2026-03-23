import type {Channel} from "../../../../../ws/Channel.ts";
import type {DefaultSQLAdapter} from "../DefaultSQLAdapter.ts";

export default async (channel: Channel, adapter: DefaultSQLAdapter, data: any) => {
    return await adapter.execute(data.query)
}
