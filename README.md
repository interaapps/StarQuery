# StarQuery

StarQuery is a desktop and web database/resource browser with support for SQL datasources, Elasticsearch, and S3-compatible object storage.

Status:
- Work in progress
- No stable releases yet
- Configuration and data formats may still change

<img src="/.github/thumbnail.png"/>

## Current Support

Datasource types:
- `mysql`
- `postgres`
- `sqlite` (local only)
- `elasticsearch`
- `s3`
- `minio`

Runtime targets:
- Electron desktop app with a built-in local backend
- Hosted backend + Vite frontend for browser usage
- Browser frontend against a configured remote StarQuery server

## Runtime Modes

### Electron desktop

- Starts its own local backend automatically
- Provides the built-in `Local computer` server
- `Local computer` is available only inside Electron
- Auth is disabled completely for the built-in local backend
- SQLite datasources are only available here
- You can still add remote StarQuery servers and use those with auth

### Hosted backend

- Intended for self-hosting on a server
- Auth is enabled by default
- Uses MySQL as the default meta database
- Can optionally bootstrap users, projects, and datasources from JSON

### Plain web frontend

- Connects to remote StarQuery servers
- Does not expose `Local computer`
- Can auto-register the current origin as a default hosted server in production
- Can be locked to exactly one server via frontend env vars

## Local Test Databases

Run local seeded test databases:

```bash
docker compose up -d
```

This starts:
- MySQL on `127.0.0.1:3307`
- Postgres on the configured compose port

Useful commands:

```bash
docker compose down
docker compose down -v
```

Use `docker compose down -v` if you want to wipe the database and re-run the seed from scratch.

## Hosted Docker Deployment

There is a dedicated Docker deployment for the hosted web version with:
- a Vite-built frontend served by Nginx
- a Node backend
- a MySQL metastore for users, roles, projects, datasources, tokens, and settings

Start it with:

```bash
docker compose -f docker-compose.hosted.yml up -d --build
```

Then open:

- Frontend: `http://localhost:8080`

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

## Configuration Overview

There are three main configuration surfaces:
- frontend env vars for the browser UI
- backend env vars for the API server and auth
- optional bootstrap JSON for provisioning users, projects, and datasources

## Frontend Environment Variables

These are read by the Vite frontend.

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_LOCKED_SERVER_URL` | unset | Locks the frontend to exactly one StarQuery server. When set, server switching is disabled and only this server is used. |
| `VITE_LOCKED_SERVER_NAME` | `Configured Server` | Label shown for `VITE_LOCKED_SERVER_URL`. |
| `VITE_DEFAULT_SERVER_URL` | unset | Default remote server URL for the plain web frontend when not locked. |
| `VITE_APP_BASE_URL` | `http://127.0.0.1:3000` | Fallback local backend URL used by the frontend if no Electron-provided local backend URL is available. Mostly useful for development. |

Behavior notes:
- In production web builds, if `VITE_DEFAULT_SERVER_URL` is not set, the frontend will use the current browser origin as the default hosted server when possible.
- `VITE_LOCKED_SERVER_URL` takes precedence over all other frontend server defaults.
- The built-in `Local computer` server is not created in the plain web frontend.

## Backend Environment Variables

These are read by the StarQuery backend.

### Core server settings

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_MODE` | `hosted` | Runtime mode. Valid values: `hosted`, `local`. |
| `PORT` | `3000` | HTTP port for the backend. |
| `HOST` | `0.0.0.0` | HTTP bind host. |
| `STARQUERY_SERVER_NAME` | `Hosted Server` in hosted mode, `Local Computer` in local mode | Display name returned by `/api/server/info`. |
| `STARQUERY_REQUEST_BODY_LIMIT` | `100mb` | Express/body-parser request size limit. |

### Meta database settings

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_META_DRIVER` | `mysql` in hosted mode, `sqlite` in local mode | Meta database driver. Valid values: `mysql`, `sqlite`. |
| `STARQUERY_META_SQLITE_PATH` | `<cwd>/.starquery/starquery-meta.sqlite` | SQLite file path for the meta database. Only used when `STARQUERY_META_DRIVER=sqlite`. |
| `STARQUERY_META_MYSQL_HOST` | `127.0.0.1` | MySQL host for the meta database. |
| `STARQUERY_META_MYSQL_PORT` | `3307` | MySQL port for the meta database. |
| `STARQUERY_META_MYSQL_USER` | `pastefy` | MySQL user for the meta database. |
| `STARQUERY_META_MYSQL_PASSWORD` | `pastefy` | MySQL password for the meta database. |
| `STARQUERY_META_MYSQL_DATABASE` | `pastefy` | MySQL database name for the meta database. |

### Auth and token settings

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_AUTH_SESSION_TTL_HOURS` | `720` | Session token lifetime in hours. |
| `STARQUERY_AUTH_API_KEY_TTL_DAYS` | `365` | API key lifetime in days. |

Auth mode notes:
- In `local` mode, auth is disabled completely in the backend.
- In `hosted` mode, auth is enabled.
- The Electron-built-in `Local computer` server runs in `local` mode.

### Seed admin settings

If these are set in hosted mode, the backend will provision an admin-capable user on startup if needed.

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_SEED_ADMIN_EMAIL` | unset | Seed admin email. |
| `STARQUERY_SEED_ADMIN_PASSWORD` | unset | Seed admin password. |
| `STARQUERY_SEED_ADMIN_NAME` | `Admin` | Seed admin display name. |

### OpenID Connect settings

Optional hosted-mode OpenID Connect / OAuth2 login.

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_AUTH_OPENID_ISSUER` | unset | OpenID issuer URL. |
| `STARQUERY_AUTH_OPENID_CLIENT_ID` | unset | OpenID client ID. |
| `STARQUERY_AUTH_OPENID_CLIENT_SECRET` | unset | OpenID client secret, if required by the provider. |
| `STARQUERY_AUTH_OPENID_SCOPES` | `openid profile email` | Space-separated scopes requested during login. |

### Bootstrap settings

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_BOOTSTRAP_CONFIG_PATH` | unset | Path to a JSON bootstrap file used to create/update users, projects, and datasources on startup. |

## Backend Configuration Examples

### Hosted with MySQL meta database

```bash
STARQUERY_MODE=hosted
HOST=0.0.0.0
PORT=3000
STARQUERY_SERVER_NAME="StarQuery Hosted"

STARQUERY_META_DRIVER=mysql
STARQUERY_META_MYSQL_HOST=127.0.0.1
STARQUERY_META_MYSQL_PORT=3306
STARQUERY_META_MYSQL_USER=starquery
STARQUERY_META_MYSQL_PASSWORD=secret
STARQUERY_META_MYSQL_DATABASE=starquery
```

### Local mode with SQLite meta database

```bash
STARQUERY_MODE=local
HOST=127.0.0.1
PORT=3000

STARQUERY_META_DRIVER=sqlite
STARQUERY_META_SQLITE_PATH=/absolute/path/to/starquery-meta.sqlite
```

## Bootstrap JSON

The bootstrap file is loaded from `STARQUERY_BOOTSTRAP_CONFIG_PATH`.

Supported top-level keys:
- `users`
- `projects`

Example:

```json
{
  "users": [
    {
      "email": "admin@example.com",
      "name": "Admin",
      "password": "change-me",
      "permissions": ["*"],
      "roles": ["admin"]
    }
  ],
  "projects": [
    {
      "slug": "analytics",
      "name": "Analytics",
      "description": "Shared analytics resources",
      "dataSources": [
        {
          "name": "Primary MySQL",
          "type": "mysql",
          "position": 0,
          "config": {
            "host": "127.0.0.1",
            "port": 3306,
            "user": "app",
            "password": "secret",
            "database": "analytics"
          }
        }
      ]
    }
  ]
}
```

Bootstrap behavior:
- Users are matched by email and updated if they already exist.
- Projects are matched by slug and updated if they already exist.
- Datasources are matched by name within a project and updated if they already exist.
- Datasource configs are normalized through the datasource registry before being saved.
- Local-only datasource types such as `sqlite` cannot be bootstrapped on hosted servers.

## Supported Datasource Types

### SQL datasources

#### `mysql`

Capabilities:
- SQL query editor
- table browser
- schema editor

Config fields:
- `host`
- `port`
- `user`
- `password`
- `database`

#### `postgres`

Capabilities:
- SQL query editor
- table browser
- schema editor

Config fields:
- `host`
- `port`
- `user`
- `password`
- `database`

#### `sqlite`

Capabilities:
- SQL query editor
- table browser
- schema editor

Restrictions:
- local only

Config fields:
- `filePath`

### Search datasources

#### `elasticsearch`

Capabilities:
- resource browser
- document search/edit workflow

Config fields:
- `node`
- `username`
- `password`
- `apiKey`
- `index`

Auth notes:
- you can use either `apiKey`
- or `username` plus `password`
- or no auth if the cluster allows it

### Object storage datasources

#### `s3`

Capabilities:
- bucket/object browser
- preview
- upload
- download
- delete

Config fields:
- `endPoint`
- `port`
- `useSSL`
- `pathStyle`
- `accessKey`
- `secretKey`
- `sessionToken`
- `region`
- `bucket`

#### `minio`

Capabilities:
- bucket/object browser
- preview
- upload
- download
- delete

Config fields:
- `endPoint`
- `port`
- `useSSL`
- `pathStyle`
- `accessKey`
- `secretKey`
- `sessionToken`
- `region`
- `bucket`

Defaults compared to `s3`:
- `useSSL=false`
- `pathStyle=true`
- `port=9000`

## Authentication and Authorization

Hosted mode includes:
- local email/password auth
- optional OpenID Connect auth
- sessions
- API keys
- roles and wildcard-based permissions

Electron local backend behavior:
- no login required
- auth disabled completely
- wildcard access is effectively available for the built-in local server

## Permission Model

Permissions support:
- plain path permissions such as `project.analytics`
- explicit read permissions such as `project.analytics:read`
- explicit write permissions such as `project.analytics:write`
- wildcard patterns such as `project.*`

Examples:
- `datasource.analytics.primary`
- `datasource.analytics.primary:read`
- `datasource.analytics.primary:write`
- `project.analytics.users:write`
- `*`

## Notes for Operators

- If you self-host the browser build, the frontend and backend can live behind the same origin and the frontend will talk to `/api`.
- If you want a browser build that can only talk to one server, use `VITE_LOCKED_SERVER_URL`.
- If you use Electron, the built-in local backend is managed by the app and should not require a manual URL.
- Password-like datasource fields are redacted when datasources are read back from the API.

## Backlog

Potential next improvements:
- replace the current custom meta migration runner with generated Drizzle migrations
- add a root `.env.example`
- add production HTTPS reverse-proxy examples
- move Electron password storage to `keytar`
