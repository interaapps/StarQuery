import {
  optionalString,
  requirePort,
} from "../shared/config-helpers.ts";
import { resolveTcpTransportConfig } from "../shared/runtime.ts";
import {
  getTransportSecretFields,
  normalizeSshTunnelConfig,
  normalizeTlsConfig,
} from "../shared/transport.ts";
import type { DataSourceModule } from "../shared/module.ts";
import { RedisResourceAdapter } from "./adapter.ts";

export const redisDataSourceModule = {
  definition: {
    type: "redis",
    kind: "resource",
    label: "Redis",
    icon: "database",
    capabilities: {
      sqlQuery: false,
      queryConsole: true,
      tableBrowser: false,
      dataEditor: false,
      schemaEditor: false,
      resourceBrowser: true,
    },
    transportSupport: {
      ssh: true,
      tls: true,
    },
  },
  secretFields: ["password", ...getTransportSecretFields({ ssh: true, tls: true })],
  normalizeConfig(config) {
    return {
      host: optionalString(config, "host") ?? "127.0.0.1",
      port: requirePort(config, 6379),
      username: optionalString(config, "username"),
      password: optionalString(config, "password"),
      database: Number(config.database ?? 0),
      tls: normalizeTlsConfig(config, {
        legacyBooleanKeys: ["ssl"],
      }),
      ssh: normalizeSshTunnelConfig(config),
    };
  },
  resolveRuntimeConfig(config, context) {
    return resolveTcpTransportConfig(config as never, context);
  },
  createResourceAdapter(config) {
    return new RedisResourceAdapter(config as never);
  },
} satisfies DataSourceModule;
