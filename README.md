# StarQuery

StarQuery is a desktop and web database/resource browser with support for SQL datasources, Elasticsearch, and S3-compatible object storage.

## Docker Quick Start

Run the prebuilt single-image deployment:

```bash
docker run -it --rm \
  -p 8080:8080 \
  --add-host=host.docker.internal:host-gateway \
  -v starquery-data:/var/lib/starquery \
  interaapps/starquery
```

Then open:

- App: `http://localhost:8080`

Networking note:
- If StarQuery inside the container should connect to services running on your host machine, use `host.docker.internal` as the host in your datasource config instead of `localhost`.
- The `--add-host=host.docker.internal:host-gateway` flag makes that work on Linux as well.

Release automation note:
- The GitHub Docker release workflow publishes to `ghcr.io` and, when `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are configured in GitHub Actions secrets, also to Docker Hub.

Status:
- Work in progress
- No stable releases yet
- Configuration and data formats may still change

<img src="/.github/thumbnail.png"/>

## Current Support

Datasource types:
- `mysql`
- `mariadb`
- `postgres`
- `cockroachdb`
- `sqlite` (local only)
- `duckdb` (local only)
- `mssql`
- `clickhouse`
- `oracle`
- `cassandra`
- `mongodb`
- `redis`
- `elasticsearch`
- `s3`
- `minio`

Frontend export formats:
- `csv`
- `json`
- `sql inserts`
- `xml`
- `html table`

Runtime targets:
- Electron desktop app with a built-in local backend
- Hosted backend + Vite frontend for browser usage
- Browser frontend against a configured remote StarQuery server

Electron release outputs:
- macOS `.zip`
- Windows Squirrel installer
- Windows `.msix`
- Linux `.deb`
- Linux `.rpm`

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
- Uses MySQL as the default meta database in the generic backend config
- The published Docker image uses SQLite for the meta database by default so no extra DB is required
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
- one Node app image that serves both the built frontend and the backend API
- a SQLite metastore by default, stored in a Docker volume

This means the default self-hosted setup does not require any separate database container or database configuration.

Start it with:

```bash
docker compose -f docker-compose.hosted.yml up -d --build
```

Then open:

- App: `http://localhost:8080`

You can also run the single image directly without compose:

```bash
docker build -t starquery -f Dockerfile.backend .
docker run -it --rm \
  -p 8080:8080 \
  --add-host=host.docker.internal:host-gateway \
  -v starquery-data:/var/lib/starquery \
  starquery
```

Services in the hosted stack:
- `app`: public StarQuery web UI and backend API on port `8080`

Stop it with:

```bash
docker compose -f docker-compose.hosted.yml down
```

Reset the hosted metastore volume with:

```bash
docker compose -f docker-compose.hosted.yml down -v
```

The hosted compose file now uses:
- `STARQUERY_META_DRIVER=sqlite`
- `STARQUERY_META_SQLITE_PATH=/var/lib/starquery/starquery-meta.sqlite`
- `VITE_LOCKED_SERVER_URL=/`
- `PORT=8080`

If you prefer MySQL for the metastore, you can still switch the backend to MySQL by providing the normal `STARQUERY_META_MYSQL_*` environment variables in your own compose override.

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
| `STARQUERY_META_DRIVER` | `mysql` in hosted mode, `sqlite` in local mode | Meta database driver. Valid values: `mysql`, `sqlite`. The bundled Docker hosted deployment overrides this to `sqlite` by default so no extra DB is required. |
| `STARQUERY_META_SQLITE_PATH` | `<cwd>/.starquery/starquery-meta.sqlite` | SQLite file path for the meta database. Only used when `STARQUERY_META_DRIVER=sqlite`. |
| `STARQUERY_META_MYSQL_HOST` | `127.0.0.1` | MySQL host for the meta database. |
| `STARQUERY_META_MYSQL_PORT` | `3307` | MySQL port for the meta database. |
| `STARQUERY_META_MYSQL_USER` | `starquery` | MySQL user for the meta database. |
| `STARQUERY_META_MYSQL_PASSWORD` | `starquery` | MySQL password for the meta database. |
| `STARQUERY_META_MYSQL_DATABASE` | `starquery` | MySQL database name for the meta database. |

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

## Electron MSIX Build Variables

These are only relevant for Windows Electron builds. The Electron Forge setup now emits an additional `.msix` artifact beside the existing Windows installer artifacts.

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_MSIX_PUBLISHER` | `CN=StarQuery` | Publisher value written into the generated MSIX manifest. For Microsoft Store submission, replace this with the exact publisher from Partner Center. |
| `STARQUERY_MSIX_PUBLISHER_DISPLAY_NAME` | `StarQuery` | Human-readable publisher display name in the MSIX manifest. |
| `STARQUERY_MSIX_IDENTITY_NAME` | `InteraApps.StarQuery` | MSIX package identity. For Store builds, use the reserved identity from Partner Center. |
| `STARQUERY_MSIX_PACKAGE_DISPLAY_NAME` | `StarQuery` | Package display name inside the manifest. |
| `STARQUERY_MSIX_APP_DISPLAY_NAME` | `StarQuery` | App display name for the Windows launcher tile metadata. |
| `STARQUERY_MSIX_BACKGROUND_COLOR` | `#101828` | Background color used in MSIX visual elements. |
| `STARQUERY_MSIX_MIN_OS_VERSION` | `10.0.19041.0` | Minimum Windows version declared in the MSIX manifest. |
| `STARQUERY_MSIX_MAX_OS_VERSION_TESTED` | same as `STARQUERY_MSIX_MIN_OS_VERSION` | Max tested Windows version declared in the manifest. |
| `STARQUERY_MSIX_WINDOWS_KIT_VERSION` | unset | Optional Windows SDK version override for the MSIX packager. |
| `STARQUERY_MSIX_WINDOWS_KIT_PATH` | unset | Optional absolute Windows SDK path override for the MSIX packager. |
| `STARQUERY_MSIX_SIGN` | `false` | When `true`, the MSIX build tries to sign the package. Leave it `false` for Microsoft Store submission packages that Microsoft signs later. |
| `WINDOWS_CERTIFICATE_FILE` | unset | Optional `.pfx` path for signed Windows/MSIX builds outside the Store. |
| `WINDOWS_CERTIFICATE_PASSWORD` | unset | Password for `WINDOWS_CERTIFICATE_FILE`. |

## Electron macOS Signing And Notarization

The Electron Forge setup can now sign and notarize the regular macOS ZIP distribution without enabling any Mac App Store packaging path.

Build-time environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_MAC_SIGN` | `false` | Enables macOS code signing for the Electron build. |
| `STARQUERY_MAC_NOTARIZE` | `false` | Enables notarization for the macOS Electron build. |
| `STARQUERY_MAC_BUNDLE_ID` | `com.interaapps.starquery` | Bundle identifier used for the regular macOS app build. |
| `STARQUERY_MAC_APP_CATEGORY` | `public.app-category.developer-tools` | App category written into the macOS app metadata. |
| `APPLE_SIGN_IDENTITY` | unset | Optional explicit signing identity, for example `Developer ID Application: Your Name (TEAMID)`. If unset, Electron signing can auto-detect a suitable identity from the keychain. |
| `APPLE_API_KEY` | unset | Path to the App Store Connect API key `.p8` file used for notarization. |
| `APPLE_API_KEY_ID` | unset | App Store Connect API key ID used for notarization. |
| `APPLE_API_ISSUER` | unset | App Store Connect API issuer ID used for notarization. |
| `APPLE_ID` | unset | Optional fallback Apple ID for notarization when not using API-key-based notarization. |
| `APPLE_APP_SPECIFIC_PASSWORD` | unset | App-specific password for `APPLE_ID` notarization. |
| `APPLE_TEAM_ID` | unset | Apple team ID required for Apple-ID-based notarization. |

GitHub Actions secrets for the macOS release job:

| Secret | Required | Description |
| --- | --- | --- |
| `APPLE_SIGN_CERTIFICATE_P12_BASE64` | yes for signing | Base64-encoded exported `.p12` containing the `Developer ID Application` certificate. |
| `APPLE_SIGN_CERTIFICATE_PASSWORD` | yes for signing | Password used when exporting the `.p12` certificate. |
| `APPLE_SIGN_IDENTITY` | recommended | Exact signing identity name, if you want to avoid auto-detection ambiguity. |
| `APPLE_NOTARY_API_KEY_P8_BASE64` | recommended for notarization | Base64-encoded App Store Connect API key `.p8`. |
| `APPLE_API_KEY_ID` | recommended for notarization | App Store Connect API key ID. |
| `APPLE_API_ISSUER` | recommended for notarization | App Store Connect API issuer ID. |
| `APPLE_ID` | optional fallback | Apple ID email if you want to use the older Apple-ID notarization flow instead of API keys. |
| `APPLE_APP_SPECIFIC_PASSWORD` | optional fallback | App-specific password for the Apple-ID notarization flow. |
| `APPLE_TEAM_ID` | optional fallback | Team ID for the Apple-ID notarization flow. |

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
