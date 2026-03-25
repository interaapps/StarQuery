# Hosted Configuration

The hosted backend can be configured through environment variables.

## Core Settings

- `STARQUERY_MODE=hosted`
- `HOST`
- `PORT`
- `STARQUERY_SERVER_NAME`

## Metastore

Recommended simple hosted setup:

- `STARQUERY_META_DRIVER=sqlite`
- `STARQUERY_META_SQLITE_PATH=/var/lib/starquery/starquery-meta.sqlite`

Alternative:

- `STARQUERY_META_DRIVER=mysql`
- `STARQUERY_META_MYSQL_HOST`
- `STARQUERY_META_MYSQL_PORT`
- `STARQUERY_META_MYSQL_USER`
- `STARQUERY_META_MYSQL_PASSWORD`
- `STARQUERY_META_MYSQL_DATABASE`

## Frontend Locking

For the single-image hosted deployment, the frontend can be locked to the same origin:

- `VITE_LOCKED_SERVER_URL=/`

## Security-Relevant Settings

- `STARQUERY_PUBLIC_URL`
- `STARQUERY_CORS_ALLOWED_ORIGINS`
- `STARQUERY_SEED_ADMIN_*`
- `STARQUERY_AUTH_OPENID_*`

Use the [Configuration Reference](/reference/configuration) for the full list.
