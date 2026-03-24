import path from 'node:path'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/meta/schema/sqlite.ts',
  out: './src/meta/drizzle/sqlite',
  breakpoints: true,
  dbCredentials: {
    url: process.env.STARQUERY_META_SQLITE_PATH ?? path.resolve(process.cwd(), '.starquery', 'starquery-meta.sqlite'),
  },
})
