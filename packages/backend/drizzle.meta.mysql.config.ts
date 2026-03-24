import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'mysql',
  schema: './src/meta/schema/mysql.ts',
  out: './src/meta/drizzle/mysql',
  breakpoints: true,
  dbCredentials: {
    host: process.env.STARQUERY_META_MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.STARQUERY_META_MYSQL_PORT ?? '3307'),
    user: process.env.STARQUERY_META_MYSQL_USER ?? 'pastefy',
    password: process.env.STARQUERY_META_MYSQL_PASSWORD ?? 'pastefy',
    database: process.env.STARQUERY_META_MYSQL_DATABASE ?? 'pastefy',
  },
})
