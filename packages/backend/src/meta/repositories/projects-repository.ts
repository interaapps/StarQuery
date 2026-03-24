import crypto from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import type { ProjectRecord } from '../types.ts'
import type { MetaRepositoryContext } from './context.ts'
import { nowForDriver, toSlug } from '../utils.ts'

function mapProjectRow(row: Record<string, unknown>): ProjectRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: (row.description as string | null | undefined) ?? null,
    position: Number(row.position ?? 0),
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
  }
}

export async function listProjects(context: MetaRepositoryContext): Promise<ProjectRecord[]> {
  const rows = await context.db
    .select()
    .from(context.schema.projects)
    .orderBy(asc(context.schema.projects.position), asc(context.schema.projects.name))

  return rows.map((row: Record<string, unknown>) => mapProjectRow(row))
}

async function getProjectByColumn(context: MetaRepositoryContext, column: any, value: string) {
  const rows = await context.db.select().from(context.schema.projects).where(eq(column, value)).limit(1)
  return rows[0] ? mapProjectRow(rows[0]) : null
}

export async function getProjectById(context: MetaRepositoryContext, projectId: string) {
  return getProjectByColumn(context, context.schema.projects.id, projectId)
}

export async function getProjectBySlug(context: MetaRepositoryContext, slug: string) {
  return getProjectByColumn(context, context.schema.projects.slug, slug)
}

export async function createProject(
  context: MetaRepositoryContext,
  input: {
    name: string
    slug?: string
    description?: string | null
    position?: number
  },
): Promise<ProjectRecord> {
  const now = nowForDriver(context.driver)
  const record: ProjectRecord = {
    id: crypto.randomUUID(),
    slug: input.slug ? toSlug(input.slug) : toSlug(input.name),
    name: input.name,
    description: input.description ?? null,
    position: input.position ?? 0,
    createdAt: now,
    updatedAt: now,
  }

  await context.db.insert(context.schema.projects).values({
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    position: record.position,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })

  return record
}

export async function updateProject(
  context: MetaRepositoryContext,
  projectId: string,
  patch: Partial<Pick<ProjectRecord, 'name' | 'slug' | 'description' | 'position'>>,
) {
  const current = await getProjectById(context, projectId)
  if (!current) {
    throw new Error('Project not found')
  }

  const next = {
    ...current,
    ...patch,
    slug: patch.slug ? toSlug(patch.slug) : current.slug,
    description: patch.description === undefined ? current.description : patch.description,
    updatedAt: nowForDriver(context.driver),
  }

  await context.db
    .update(context.schema.projects)
    .set({
      slug: next.slug,
      name: next.name,
      description: next.description,
      position: next.position,
      updatedAt: next.updatedAt,
    })
    .where(eq(context.schema.projects.id, projectId))

  return next
}

export async function deleteProject(context: MetaRepositoryContext, projectId: string) {
  await context.db.delete(context.schema.projects).where(eq(context.schema.projects.id, projectId))
}
