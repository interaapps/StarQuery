# Getting Started

StarQuery can run in three primary ways:

- Electron desktop app with a built-in local backend
- Hosted backend with the web UI
- Plain web frontend against an existing StarQuery server

## Fastest Start

If you just want to try StarQuery quickly, run the published Docker image:

```bash
docker run -it --rm \
  -p 8080:8080 \
  --add-host=host.docker.internal:host-gateway \
  -v starquery-data:/var/lib/starquery \
  interaapps/starquery
```

Then open `http://localhost:8080`.

## What You Get

- A web UI served by the same container as the backend
- SQLite as the default metastore
- No separate database required for the default hosted setup

## Networking Note

If StarQuery in Docker should connect to services running on your host machine, use `host.docker.internal` instead of `localhost` in datasource configs.

That is why the recommended command includes:

```bash
--add-host=host.docker.internal:host-gateway
```

This also makes the host alias work on Linux.

## Next Steps

- Learn the [Runtime Modes](/guide/runtime-modes)
- See which [Datasources](/guide/datasources) are supported
- Open the full [Configuration Reference](/reference/configuration)
