import { createRequire } from "node:module";
import type { RedisClientType } from "redis";
import type * as RedisNamespace from "redis";
import type { ResourceBrowserItem, ResourceBrowserListing } from "../types.ts";
import type {
  ResourceDataSourceAdapter,
  ResourceDeleteResult,
  ResourceListOptions,
} from "../shared-resource/types.ts";

type RedisConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: number;
  ssl?: boolean;
};

type RedisModule = typeof RedisNamespace;

function matchesSearch(
  search: string | undefined,
  ...values: Array<string | undefined>
) {
  if (!search?.trim()) {
    return true;
  }

  const needle = search.trim().toLowerCase();
  return values
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(needle));
}

export class RedisResourceAdapter implements ResourceDataSourceAdapter {
  private static readonly require = createRequire(import.meta.url);
  private client!: RedisClientType;

  constructor(private readonly config: RedisConfig) {}

  private loadRedisModule() {
    return RedisResourceAdapter.require("redis") as RedisModule;
  }

  async connect() {
    const { createClient } = this.loadRedisModule();
    this.client = createClient({
      socket: this.config.ssl
        ? {
            host: this.config.host,
            port: this.config.port,
            tls: true,
          }
        : {
            host: this.config.host,
            port: this.config.port,
          },
      username: this.config.username,
      password: this.config.password,
      database: this.config.database,
    });

    await this.client.connect();
  }

  async close() {
    await this.client?.quit();
  }

  async executeCommand(args: string[]) {
    if (!args.length) {
      throw new Error("A Redis command is required.");
    }

    return this.client.sendCommand(args);
  }

  async list(
    path: string,
    options?: ResourceListOptions,
  ): Promise<ResourceBrowserListing> {
    const normalizedPath = path.trim().replace(/^\/+|\/+$/g, "");
    if (!normalizedPath) {
      return this.listKeys(options);
    }

    return this.getKey(normalizedPath);
  }

  async deletePaths(paths: string[]): Promise<ResourceDeleteResult> {
    const keys = Array.from(
      new Set(paths.map((path) => path.trim()).filter(Boolean)),
    );
    if (!keys.length) {
      return {
        deletedPaths: [],
        deletedCount: 0,
      };
    }

    await this.client.del(keys);

    return {
      deletedPaths: keys,
      deletedCount: keys.length,
    };
  }

  private async listKeys(
    options?: ResourceListOptions,
  ): Promise<ResourceBrowserListing> {
    const limit = Math.max(options?.limit ?? 200, 1);
    const keys: string[] = [];
    let cursor = options?.cursor ?? "0";
    const matchPattern = options?.search?.trim()
      ? `*${options.search.trim()}*`
      : "*";

    while (keys.length < limit) {
      const result = await this.client.scan(cursor, {
        MATCH: matchPattern,
        COUNT: Math.min(limit, 500),
      });
      cursor = result.cursor;
      keys.push(...result.keys);

      if (cursor === "0") {
        break;
      }
    }

    const items: ResourceBrowserItem[] = [];
    for (const key of keys.slice(0, limit)) {
      const keyType = await this.client.type(key);
      if (!matchesSearch(options?.search, key, keyType)) {
        continue;
      }

      items.push({
        id: key,
        name: key,
        kind: "item",
        path: key,
        description: keyType,
      });
    }

    return {
      path: "",
      items,
      preview: {
        type: "text",
        title: `Redis • DB ${this.config.database ?? 0}`,
        text: `${items.length} key(s) loaded`,
      },
      details: {
        name: `DB ${this.config.database ?? 0}`,
        kind: "container",
        path: "",
        metadata: {
          database: this.config.database ?? 0,
        },
      },
      page: {
        returned: items.length,
        hasMore: cursor !== "0",
        nextCursor: cursor !== "0" ? cursor : null,
      },
    };
  }

  private async getKey(key: string): Promise<ResourceBrowserListing> {
    const keyType = await this.client.type(key);
    let preview: ResourceBrowserListing["preview"] = null;
    let details: ResourceBrowserListing["details"] = {
      name: key,
      kind: "item",
      path: key,
      metadata: {
        type: keyType,
      },
    };

    if (keyType === "string") {
      const stringValue = await this.client.get(key);
      preview = {
        type: "text",
        title: `String • ${key}`,
        text:
          typeof stringValue === "string"
            ? stringValue
            : String(stringValue ?? ""),
      };
    } else if (keyType === "hash") {
      preview = {
        type: "json",
        title: `Hash • ${key}`,
        value: await this.client.hGetAll(key),
      };
    } else if (keyType === "list") {
      preview = {
        type: "json",
        title: `List • ${key}`,
        value: await this.client.lRange(key, 0, 99),
      };
    } else if (keyType === "set") {
      preview = {
        type: "json",
        title: `Set • ${key}`,
        value: await this.client.sMembers(key),
      };
    } else if (keyType === "zset") {
      preview = {
        type: "json",
        title: `Sorted Set • ${key}`,
        value: await this.client.zRangeWithScores(key, 0, 99),
      };
    } else {
      preview = {
        type: "text",
        title: `Key • ${key}`,
        text: `Type ${keyType} is not previewed yet.`,
      };
    }

    const ttl = await this.client.ttl(key);
    details = {
      ...details,
      metadata: {
        ...details.metadata,
        ttlSeconds: ttl,
      },
    };

    return {
      path: key,
      items: [],
      preview,
      details,
    };
  }
}
