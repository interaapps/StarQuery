# Datasources

StarQuery supports a mix of SQL, search, document, cache and object storage backends.

## SQL

- MySQL
- MariaDB
- PostgreSQL
- CockroachDB
- SQLite
- DuckDB
- MSSQL
- ClickHouse
- Oracle
- Cassandra

Support depth depends on the engine. Mature SQL paths offer table browsing, query views and editing. Some engines are currently more query-first than fully schema-edit driven.

## Document and Search

- MongoDB
- Elasticsearch

These views support query-oriented workflows and export flows aligned with the rest of the app.

## Cache and Resource Browsers

- Redis

## Object Storage

- S3
- MinIO

## Export Formats

Frontend exports currently support:

- CSV
- JSON
- SQL inserts
- XML
- HTML table

## Notes

- `sqlite` is intended for local workflows
- `duckdb` is intended for local workflows
- the desktop app is the best fit for local file-based datasources
