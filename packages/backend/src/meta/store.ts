import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import mysql from 'mysql2/promise'
import type { AppConfig } from '../config/app-config.ts'
import { META_MIGRATIONS } from './migrations.ts'
import type { BootstrapConfig, DataSourceRecord, ProjectRecord } from './types.ts'

type PreparedMetaStoreRecord = {
  driver: AppConfig['metaStore']['driver']
  sqliteConnection?: DatabaseSync
  mysqlPool?: mysql.Pool
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function nowIso() {
  return new Date().toISOString()
}

function nowForDriver(driver: AppConfig['metaStore']['driver']) {
  if (driver === 'mysql') {
    return new Date().toISOString().slice(0, 19).replace('T', ' ')
  }

  return nowIso()
}

function rowValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in row) {
      return row[key]
    }
  }

  return undefined
}

async function executeSql(store: PreparedMetaStoreRecord, statement: string, params: unknown[] = []) {
  if (store.driver === 'mysql') {
    const [result] = await store.mysqlPool!.query(statement, params)
    return result as unknown[]
  }

  const prepared = store.sqliteConnection!.prepare(statement)
  if (statement.trim().toLowerCase().startsWith('select')) {
    return prepared.all(...params) as unknown[]
  }

  prepared.run(...params)
  return []
}

export class MetaStore {
  private store: PreparedMetaStoreRecord

  constructor(private config: AppConfig) {}

  async initialize() {
    this.store = this.config.metaStore.driver === 'mysql' ? await this.createMySqlStore() : this.createSqliteStore()
    await this.runMigrations()
    await this.ensureDefaultContent()
  }

  private async createMySqlStore(): Promise<PreparedMetaStoreRecord> {
    const pool = mysql.createPool({
      host: this.config.metaStore.mysql.host,
      port: this.config.metaStore.mysql.port,
      user: this.config.metaStore.mysql.user,
      password: this.config.metaStore.mysql.password,
      database: this.config.metaStore.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })

    return {
      driver: 'mysql',
      mysqlPool: pool,
    }
  }

  private createSqliteStore(): PreparedMetaStoreRecord {
    const sqlitePath = this.config.metaStore.sqlitePath
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true })

    const sqlite = new DatabaseSync(sqlitePath)
    sqlite.exec('PRAGMA journal_mode = WAL')

    return {
      driver: 'sqlite',
      sqliteConnection: sqlite,
    }
  }

  private async runMigrations() {
    const createMigrationTable =
      this.store.driver === 'mysql'
        ? `
            CREATE TABLE IF NOT EXISTS meta_migrations (
              id VARCHAR(255) NOT NULL PRIMARY KEY,
              executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `
        : `
            CREATE TABLE IF NOT EXISTS meta_migrations (
              id TEXT NOT NULL PRIMARY KEY,
              executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `

    await executeSql(this.store, createMigrationTable)

    const executed = new Set(
      (await executeSql(this.store, 'SELECT id FROM meta_migrations')).map(
        (row) => (row as Record<string, unknown>).id as string,
      ),
    )

    for (const migration of META_MIGRATIONS) {
      if (executed.has(migration.id)) continue

      const script = this.store.driver === 'mysql' ? migration.mysql : migration.sqlite
      const statements = script
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean)

      for (const statement of statements) {
        await executeSql(this.store, statement)
      }

      await executeSql(this.store, 'INSERT INTO meta_migrations (id) VALUES (?)', [migration.id])
    }
  }

  private async ensureDefaultContent() {
    const projects = await this.listProjects()
    if (!projects.length) {
      await this.createProject({
        name: 'Workspace',
        slug: 'workspace',
        description: 'Default local workspace',
      })
    }
  }

  async close() {
    await this.store.mysqlPool?.end()
    this.store.sqliteConnection?.close()
  }

  async applyBootstrapConfig(config: BootstrapConfig) {
    for (const user of config.users ?? []) {
      const existing = await executeSql(this.store, 'SELECT id FROM users WHERE email = ?', [user.email])

      if (!existing.length) {
        const now = nowForDriver(this.store.driver)
        await executeSql(this.store, 'INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
          crypto.randomUUID(),
          user.email,
          user.name,
          now,
          now,
        ])
      }
    }

    for (const [index, project] of (config.projects ?? []).entries()) {
      const slug = project.slug ? toSlug(project.slug) : toSlug(project.name)
      let targetProject = await this.getProjectBySlug(slug)

      if (!targetProject) {
        targetProject = await this.createProject({
          name: project.name,
          slug,
          description: project.description ?? null,
          position: index,
        })
      }

      for (const [sourceIndex, dataSource] of (project.dataSources ?? []).entries()) {
        const existingSources = await this.listDataSources(targetProject.id)
        const existing = existingSources.find((entry) => entry.name === dataSource.name)

        if (existing) {
          await this.updateDataSource(existing.id, {
            name: dataSource.name,
            type: dataSource.type,
            config: dataSource.config,
            position: dataSource.position ?? sourceIndex,
          })
          continue
        }

        await this.createDataSource({
          projectId: targetProject.id,
          name: dataSource.name,
          type: dataSource.type,
          config: dataSource.config,
          position: dataSource.position ?? sourceIndex,
        })
      }
    }
  }

  async listProjects(): Promise<ProjectRecord[]> {
    const rows = (await executeSql(
      this.store,
      'SELECT id, slug, name, description, position, created_at, updated_at FROM projects ORDER BY position ASC, name ASC',
    )) as Record<string, unknown>[]

    return rows.map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: (row.description as string | null | undefined) ?? null,
      position: Number(row.position ?? 0),
      createdAt: String(rowValue(row, 'created_at', 'createdAt') ?? ''),
      updatedAt: String(rowValue(row, 'updated_at', 'updatedAt') ?? ''),
    }))
  }

  async getProjectById(projectId: string): Promise<ProjectRecord | null> {
    const rows = (await executeSql(
      this.store,
      'SELECT id, slug, name, description, position, created_at, updated_at FROM projects WHERE id = ? LIMIT 1',
      [projectId],
    )) as Record<string, unknown>[]

    return rows[0]
      ? {
          id: rows[0].id as string,
          slug: rows[0].slug as string,
          name: rows[0].name as string,
          description: (rows[0].description as string | null | undefined) ?? null,
          position: Number(rows[0].position ?? 0),
          createdAt: String(rowValue(rows[0], 'created_at', 'createdAt') ?? ''),
          updatedAt: String(rowValue(rows[0], 'updated_at', 'updatedAt') ?? ''),
        }
      : null
  }

  async getProjectBySlug(slug: string): Promise<ProjectRecord | null> {
    const rows = (await executeSql(
      this.store,
      'SELECT id, slug, name, description, position, created_at, updated_at FROM projects WHERE slug = ? LIMIT 1',
      [slug],
    )) as Record<string, unknown>[]

    return rows[0]
      ? {
          id: rows[0].id as string,
          slug: rows[0].slug as string,
          name: rows[0].name as string,
          description: (rows[0].description as string | null | undefined) ?? null,
          position: Number(rows[0].position ?? 0),
          createdAt: String(rowValue(rows[0], 'created_at', 'createdAt') ?? ''),
          updatedAt: String(rowValue(rows[0], 'updated_at', 'updatedAt') ?? ''),
        }
      : null
  }

  async createProject(input: {
    name: string
    slug?: string
    description?: string | null
    position?: number
  }): Promise<ProjectRecord> {
    const now = nowForDriver(this.store.driver)
    const record: ProjectRecord = {
      id: crypto.randomUUID(),
      slug: input.slug ? toSlug(input.slug) : toSlug(input.name),
      name: input.name,
      description: input.description ?? null,
      position: input.position ?? 0,
      createdAt: now,
      updatedAt: now,
    }

    await executeSql(
      this.store,
      'INSERT INTO projects (id, slug, name, description, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        record.id,
        record.slug,
        record.name,
        record.description,
        record.position,
        record.createdAt,
        record.updatedAt,
      ],
    )

    return record
  }

  async updateProject(
    projectId: string,
    patch: Partial<Pick<ProjectRecord, 'name' | 'slug' | 'description' | 'position'>>,
  ) {
    const current = await this.getProjectById(projectId)
    if (!current) {
      throw new Error('Project not found')
    }

    const next = {
      ...current,
      ...patch,
      slug: patch.slug ? toSlug(patch.slug) : current.slug,
      description: patch.description === undefined ? current.description : patch.description,
      updatedAt: nowForDriver(this.store.driver),
    }

    await executeSql(
      this.store,
      'UPDATE projects SET slug = ?, name = ?, description = ?, position = ?, updated_at = ? WHERE id = ?',
      [next.slug, next.name, next.description, next.position, next.updatedAt, projectId],
    )

    return next
  }

  async deleteProject(projectId: string) {
    await executeSql(this.store, 'DELETE FROM projects WHERE id = ?', [projectId])
  }

  async listDataSources(projectId: string): Promise<DataSourceRecord[]> {
    const rows = (await executeSql(
      this.store,
      'SELECT id, project_id, name, type, config_json, position, created_at, updated_at FROM data_sources WHERE project_id = ? ORDER BY position ASC, name ASC',
      [projectId],
    )) as Record<string, unknown>[]

    return rows.map((row) => ({
      id: row.id as string,
      projectId: row.project_id as string,
      name: row.name as string,
      type: row.type as DataSourceRecord['type'],
      config: JSON.parse(String(row.config_json ?? '{}')),
      position: Number(row.position ?? 0),
      createdAt: String(rowValue(row, 'created_at', 'createdAt') ?? ''),
      updatedAt: String(rowValue(row, 'updated_at', 'updatedAt') ?? ''),
    }))
  }

  async getDataSource(dataSourceId: string): Promise<DataSourceRecord | null> {
    const rows = (await executeSql(
      this.store,
      'SELECT id, project_id, name, type, config_json, position, created_at, updated_at FROM data_sources WHERE id = ? LIMIT 1',
      [dataSourceId],
    )) as Record<string, unknown>[]

    if (!rows[0]) return null

    return {
      id: rows[0].id as string,
      projectId: rows[0].project_id as string,
      name: rows[0].name as string,
      type: rows[0].type as DataSourceRecord['type'],
      config: JSON.parse(String(rows[0].config_json ?? '{}')),
      position: Number(rows[0].position ?? 0),
      createdAt: String(rowValue(rows[0], 'created_at', 'createdAt') ?? ''),
      updatedAt: String(rowValue(rows[0], 'updated_at', 'updatedAt') ?? ''),
    }
  }

  async createDataSource(input: {
    projectId: string
    name: string
    type: DataSourceRecord['type']
    config: Record<string, unknown>
    position?: number
  }): Promise<DataSourceRecord> {
    const now = nowForDriver(this.store.driver)
    const record: DataSourceRecord = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      name: input.name,
      type: input.type,
      config: input.config,
      position: input.position ?? 0,
      createdAt: now,
      updatedAt: now,
    }

    await executeSql(
      this.store,
      'INSERT INTO data_sources (id, project_id, name, type, config_json, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        record.id,
        record.projectId,
        record.name,
        record.type,
        JSON.stringify(record.config),
        record.position,
        record.createdAt,
        record.updatedAt,
      ],
    )

    return record
  }

  async updateDataSource(
    dataSourceId: string,
    patch: Partial<Pick<DataSourceRecord, 'name' | 'type' | 'config' | 'position'>>,
  ) {
    const current = await this.getDataSource(dataSourceId)
    if (!current) {
      throw new Error('Datasource not found')
    }

    const next = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.config !== undefined ? { config: patch.config } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
      updatedAt: nowForDriver(this.store.driver),
    }

    await executeSql(
      this.store,
      'UPDATE data_sources SET name = ?, type = ?, config_json = ?, position = ?, updated_at = ? WHERE id = ?',
      [
        next.name,
        next.type,
        JSON.stringify(next.config),
        next.position,
        next.updatedAt,
        dataSourceId,
      ],
    )

    return next
  }

  async deleteDataSource(dataSourceId: string) {
    await executeSql(this.store, 'DELETE FROM data_sources WHERE id = ?', [dataSourceId])
  }
}
