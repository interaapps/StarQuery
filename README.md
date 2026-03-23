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

## Backlog
- [ ] Add OpenID Connect support
