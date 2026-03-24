import crypto from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import type { DataSourceRecord } from '../types.ts'
import type { MetaRepositoryContext } from './context.ts'
import { nowForDriver, parseJsonObject } from '../utils.ts'

function mapDataSourceRow(row: Record<string, unknown>): DataSourceRecord {
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    name: String(row.name),
    type: row.type as DataSourceRecord['type'],
    config: parseJsonObject(row.configJson),
    position: Number(row.position ?? 0),
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
  }
}

export async function listDataSources(context: MetaRepositoryContext, projectId: string): Promise<DataSourceRecord[]> {
  const rows = await context.db
    .select()
    .from(context.schema.dataSources)
    .where(eq(context.schema.dataSources.projectId, projectId))
    .orderBy(asc(context.schema.dataSources.position), asc(context.schema.dataSources.name))

  return rows.map((row: Record<string, unknown>) => mapDataSourceRow(row))
}

export async function getDataSource(context: MetaRepositoryContext, dataSourceId: string) {
  const rows = await context.db
    .select()
    .from(context.schema.dataSources)
    .where(eq(context.schema.dataSources.id, dataSourceId))
    .limit(1)

  return rows[0] ? mapDataSourceRow(rows[0]) : null
}

export async function createDataSource(
  context: MetaRepositoryContext,
  input: {
    projectId: string
    name: string
    type: DataSourceRecord['type']
    config: Record<string, unknown>
    position?: number
  },
): Promise<DataSourceRecord> {
  const now = nowForDriver(context.driver)
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

  await context.db.insert(context.schema.dataSources).values({
    id: record.id,
    projectId: record.projectId,
    name: record.name,
    type: record.type,
    configJson: JSON.stringify(record.config),
    position: record.position,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })

  return record
}

export async function updateDataSource(
  context: MetaRepositoryContext,
  dataSourceId: string,
  patch: Partial<Pick<DataSourceRecord, 'name' | 'type' | 'config' | 'position'>>,
) {
  const current = await getDataSource(context, dataSourceId)
  if (!current) {
    throw new Error('Datasource not found')
  }

  const next = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.config !== undefined ? { config: patch.config } : {}),
    ...(patch.position !== undefined ? { position: patch.position } : {}),
    updatedAt: nowForDriver(context.driver),
  }

  await context.db
    .update(context.schema.dataSources)
    .set({
      name: next.name,
      type: next.type,
      configJson: JSON.stringify(next.config),
      position: next.position,
      updatedAt: next.updatedAt,
    })
    .where(eq(context.schema.dataSources.id, dataSourceId))

  return next
}

export async function deleteDataSource(context: MetaRepositoryContext, dataSourceId: string) {
  await context.db.delete(context.schema.dataSources).where(eq(context.schema.dataSources.id, dataSourceId))
}
