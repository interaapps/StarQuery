import { createRequire } from 'node:module'
import type { Client } from 'cassandra-driver'
import type * as CassandraNamespace from 'cassandra-driver'
import type { QueryResult } from '../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import type { ResolvedNetworkTransport, TlsConfig } from '../shared/transport.ts'
import { createNodeTlsOptions } from '../shared/transport.ts'
import { createSelectResultFromRows, QueryOnlySqlAdapter } from '../shared-sql/query-only-adapter.ts'

type CassandraConfig = {
  host: string
  port: number
  user?: string
  password?: string
  database?: string
  tls?: TlsConfig
  transport?: ResolvedNetworkTransport
}

type CassandraModule = typeof CassandraNamespace

export class CassandraSqlAdapter extends QueryOnlySqlAdapter {
  private static readonly require = createRequire(import.meta.url)
  private client!: Client

  constructor(private readonly config: CassandraConfig) {
    super()
  }

  private loadCassandraModule() {
    return CassandraSqlAdapter.require('cassandra-driver') as CassandraModule
  }

  async connect() {
    const { Client } = this.loadCassandraModule()
    const transport = this.config.transport
    this.client = new Client({
      contactPoints: [transport?.connectHost ?? this.config.host],
      localDataCenter: 'datacenter1',
      protocolOptions: {
        port: transport?.connectPort ?? this.config.port,
      },
      keyspace: this.config.database,
      credentials:
        this.config.user
          ? {
              username: this.config.user,
              password: this.config.password ?? '',
            }
          : undefined,
      sslOptions: createNodeTlsOptions(this.config.tls, transport?.serverHost ?? this.config.host),
    })

    await this.client.connect()
  }

  async close() {
    await this.client?.shutdown()
  }

  async execute(sqlText: string): Promise<QueryResult> {
    const result = await this.client.execute(sqlText)
    const rows = result.rows.map((row) => ({ ...row }))

    if (rows.length || result.columns?.length) {
      return createSelectResultFromRows(rows as Record<string, unknown>[])
    }

    return {
      type: 'RESULT',
      result: {
        command: 'CQL',
      },
    }
  }
}
