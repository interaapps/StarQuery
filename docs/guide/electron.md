# Electron Desktop

The Electron app packages the frontend and starts a local backend automatically.

## What Desktop Mode Is Good At

- local SQL and DuckDB workflows
- fast setup without hosting anything
- a built-in `Local computer` server
- local metastore persistence in the app data directory

## Build Outputs

Current Electron release outputs include:

- macOS `.zip`
- Windows Squirrel installer
- Windows `.msix`
- Linux `.deb`
- Linux `.rpm`

## Local Electron Build

```bash
pnpm --dir packages/electron package
```

For distributable artifacts:

```bash
pnpm --dir packages/electron make
```

## Important Behavior

- the local backend runs in `local` mode
- auth is disabled for the built-in local backend
- remote StarQuery servers can still be added alongside the local one

## Signing and Store Work

The current desktop path focuses on signed/notarized distribution first. Store-specific requirements such as MAS or Microsoft Store packaging are separate follow-up concerns.
