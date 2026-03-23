# StarQuery - A tool to rule them all
> This tool is `Work in Progress` and in development stage. There are no guarantees that it will work as expected and no releases.

<img src="/.github/thumbnail.png"/>

## Planned Support
- [ ] Database
  - SQL
    - [ ] MySQL 
    - [ ] PostgreSQL 
    - [ ] SQLite (local only)
    - [ ] MSSQL
    - [ ] MariaDB
    - [ ] Oracle
    - [ ] CockroachDB
    - [ ] ClickHouse
  - [ ] MongoDB
- Search
  - [ ] Elasticsearch
- API's
  - [ ] Rest API
  - [ ] GraphQL
  - [ ] gRPC
  - [ ] OpenAPI


## TODOs
- [ ] Add authentication
- [ ] Add projects
- [ ] Electron save passwords via npm package `keytar`

## Local MySQL Test Database
Run a local MySQL instance with seeded test data:

```bash
docker compose up -d
```

This starts MySQL on `127.0.0.1:3307` with credentials that already match the backend defaults in `packages/backend/src/index.ts`:

- Database: `pastefy`
- User: `pastefy`
- Password: `pastefy`
- Root password: `root`

Seed data is loaded on first startup from `docker/mysql/init/001-seed.sql` and creates these tables:

- `customers`
- `products`
- `orders`
- `order_items`

Useful commands:

```bash
docker compose down
docker compose down -v
```

Use `docker compose down -v` if you want to wipe the database and re-run the seed from scratch.

## Self-Hosted Deployment
There is now a dedicated Docker deployment for the hosted web version with:

- a Vite-built frontend served by Nginx
- a Node backend
- a MySQL metastore for projects, datasources, and users

Start it with:

```bash
docker compose -f docker-compose.hosted.yml up -d --build
```

Then open:

- Frontend: `http://localhost:8080`

The frontend proxies `/api` to the backend internally, so in production mode the browser app automatically uses the same origin as its default hosted server.

If you want the frontend to use exactly one backend and disable server switching entirely, set:

```bash
VITE_LOCKED_SERVER_URL=https://your-server.example.com
```

Optional label:

```bash
VITE_LOCKED_SERVER_NAME="Production Server"
```

Services in the hosted stack:

- `frontend`: public web UI on port `8080`
- `backend`: internal StarQuery API in `hosted` mode
- `meta-db`: MySQL database used by the backend as its metastore

Stop it with:

```bash
docker compose -f docker-compose.hosted.yml down
```

Reset the hosted metastore volume with:

```bash
docker compose -f docker-compose.hosted.yml down -v
```

## Backlog
- [ ] Add OpenID Connect support
