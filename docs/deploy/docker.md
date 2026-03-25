# Docker Deployment

The recommended hosted deployment is the single-image setup.

## Run the Published Image

```bash
docker run -it --rm \
  -p 8080:8080 \
  --add-host=host.docker.internal:host-gateway \
  -v starquery-data:/var/lib/starquery \
  interaapps/starquery
```

Open:

- `http://localhost:8080`

## Why This Setup?

- one container for frontend and backend
- SQLite metastore by default
- no extra database required for the standard self-hosted case

## Compose Variant

```bash
docker compose -f docker-compose.hosted.yml up -d --build
```

Stop it again:

```bash
docker compose -f docker-compose.hosted.yml down
```

Reset the metastore volume:

```bash
docker compose -f docker-compose.hosted.yml down -v
```