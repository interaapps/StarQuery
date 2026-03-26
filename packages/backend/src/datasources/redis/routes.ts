import type { Express } from "express";
import type { AppContext } from "../../app-context.ts";
import { requirePermission } from "../../auth/middleware.ts";
import type { AuthenticatedRequest } from "../../auth/request.ts";
import {
  dataSourceReadPermissionTargets,
  dataSourceWritePermissionTargets,
} from "../../auth/permissions.ts";
import { sendSourceError } from "../../routes/source-route-errors.ts";
import { requireSource } from "../../routes/sources/shared.ts";
import { parseRedisCommand, isReadOnlyRedisTokens } from "./command.ts";
import { RedisResourceAdapter } from "./adapter.ts";
import { redisDataSourceModule } from "./index.ts";

async function withRedisAdapter<T>(
  config: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    database?: number;
    ssl?: boolean;
  },
  callback: (adapter: RedisResourceAdapter) => Promise<T>,
) {
  const adapter = new RedisResourceAdapter(config);
  await adapter.connect();

  try {
    return await callback(adapter);
  } finally {
    await adapter.close();
  }
}

export function registerRedisSourceRoutes(app: Express, context: AppContext) {
  app.post(
    "/api/projects/:projectId/sources/:sourceId/redis/query",
    async (req, res) => {
      const authReq = req as AuthenticatedRequest;
      const source = await requireSource(
        context,
        req.params.projectId,
        req.params.sourceId,
        res,
      );
      if (!source) return;

      if (source.type !== "redis") {
        res
          .status(400)
          .json({ error: "This datasource is not backed by Redis." });
        return;
      }

      const { command } = req.body as { command?: string };
      if (!command?.trim()) {
        res.status(400).json({ error: "A Redis command is required." });
        return;
      }

      try {
        const args = parseRedisCommand(command);
        const readOnly = isReadOnlyRedisTokens(args);
        if (
          !requirePermission(
            authReq,
            res,
            readOnly
              ? dataSourceReadPermissionTargets(source.projectId, source.id)
              : dataSourceWritePermissionTargets(source.projectId, source.id),
          )
        ) {
          return;
        }

        const normalizedConfig = redisDataSourceModule.normalizeConfig(
          source.config,
        ) as {
          host: string;
          port: number;
          username?: string;
          password?: string;
          database?: number;
          ssl?: boolean;
        };

        const reply = await withRedisAdapter(
          normalizedConfig,
          async (adapter) => adapter.executeCommand(args),
        );

        res.json({
          command,
          commandName: args[0]!.toUpperCase(),
          args: args.slice(1),
          readOnly,
          reply,
        });
      } catch (error) {
        sendSourceError(res, error, "The Redis command could not be executed");
      }
    },
  );
}
