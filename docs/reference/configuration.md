# Configuration Reference

This page summarizes the most important configuration surfaces.

## Frontend Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_LOCKED_SERVER_URL` | unset | Locks the frontend to exactly one StarQuery server. |
| `VITE_LOCKED_SERVER_NAME` | `Configured Server` | Label used for the locked server. |
| `VITE_DEFAULT_SERVER_URL` | unset | Default remote server URL for the plain web frontend. |
| `VITE_APP_BASE_URL` | `http://127.0.0.1:3000` | Fallback backend URL for development. |

## Backend Core

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_MODE` | `hosted` | Runtime mode: `hosted` or `local`. |
| `HOST` | `0.0.0.0` | HTTP bind host. |
| `PORT` | `3000` | HTTP port. |
| `STARQUERY_SERVER_NAME` | depends on mode | Display name returned by the backend. |
| `STARQUERY_REQUEST_BODY_LIMIT` | `100mb` | Request size limit. |

## Metastore

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_META_DRIVER` | `mysql` in hosted, `sqlite` in local | Metastore driver. |
| `STARQUERY_META_SQLITE_PATH` | `<cwd>/.starquery/starquery-meta.sqlite` | SQLite path. |
| `STARQUERY_META_MYSQL_HOST` | `127.0.0.1` | MySQL host. |
| `STARQUERY_META_MYSQL_PORT` | `3307` | MySQL port. |
| `STARQUERY_META_MYSQL_USER` | `starquery` | MySQL user. |
| `STARQUERY_META_MYSQL_PASSWORD` | `starquery` | MySQL password. |
| `STARQUERY_META_MYSQL_DATABASE` | `starquery` | MySQL database name. |

## Auth

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_AUTH_SESSION_TTL_HOURS` | `720` | Session lifetime. |
| `STARQUERY_AUTH_API_KEY_TTL_DAYS` | `365` | API key lifetime. |

## CORS and Public URL

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_PUBLIC_URL` | unset | Public hosted URL used for same-origin redirects and hosted behavior. |
| `STARQUERY_CORS_ALLOWED_ORIGINS` | unset | Comma-separated extra allowed origins in hosted mode. |

## Bootstrap and Seed Admin

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_BOOTSTRAP_CONFIG_PATH` | unset | Bootstrap JSON path. |
| `STARQUERY_SEED_ADMIN_EMAIL` | unset | Seed admin email. |
| `STARQUERY_SEED_ADMIN_PASSWORD` | unset | Seed admin password. |
| `STARQUERY_SEED_ADMIN_NAME` | `Admin` | Seed admin display name. |

## OpenID Connect

| Variable | Default | Description |
| --- | --- | --- |
| `STARQUERY_AUTH_OPENID_ISSUER` | unset | OpenID issuer URL. |
| `STARQUERY_AUTH_OPENID_CLIENT_ID` | unset | Client ID. |
| `STARQUERY_AUTH_OPENID_CLIENT_SECRET` | unset | Client secret. |
| `STARQUERY_AUTH_OPENID_SCOPES` | `openid profile email` | Requested scopes. |

For deeper narrative guidance, also see [Hosted Configuration](/deploy/hosted-configuration).
