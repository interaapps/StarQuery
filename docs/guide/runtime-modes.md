# Runtime Modes

StarQuery has two backend runtime modes and one browser-only frontend mode.

## Electron Desktop

Electron starts a built-in local backend automatically.

Characteristics:

- local backend runs automatically
- built-in `Local computer` server is available
- local auth is disabled
- SQLite datasources are available here
- DuckDB local files fit naturally here as well

This is the most convenient mode for individual local work.

## Hosted Backend

Hosted mode is intended for self-hosting on a server.

Characteristics:

- auth enabled by default
- intended for browser clients
- can use SQLite or MySQL for the metastore
- can bootstrap users, projects and datasources from JSON

The published Docker image defaults to SQLite for the metastore to keep deployment simple.

## Plain Web Frontend

The plain web frontend connects to an existing StarQuery server.

Characteristics:

- no built-in `Local computer`
- can auto-use the current browser origin in production
- can be locked to one backend with frontend env vars

## Which One Should You Choose?

- Local individual usage: Electron
- Team/self-hosted usage: Hosted backend
- Existing remote server already available: Plain web frontend
