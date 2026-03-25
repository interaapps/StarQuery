# Development

## Workspace Structure

- `packages/frontend`: Vue frontend
- `packages/backend`: Node backend
- `packages/electron`: Electron desktop shell
- `packages/types`: shared types
- `docs`: VitePress documentation

## Useful Commands

Frontend typecheck:

```bash
pnpm --dir packages/frontend exec vue-tsc --build
```

Backend typecheck:

```bash
pnpm --dir packages/backend typecheck
```

Electron package build:

```bash
pnpm --dir packages/electron make
```

Docs dev server:

```bash
pnpm --dir docs dev
```

## Local Test Databases

Use the local compose file for quick seeded databases:

```bash
docker compose up -d
```

This is useful for iterating on datasource flows during development.
