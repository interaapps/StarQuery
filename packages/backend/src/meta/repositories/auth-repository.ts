import crypto from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import type { AuthTokenRecord, OidcStateRecord } from '../types.ts'
import type { MetaRepositoryContext } from './context.ts'
import { normalizeNullableDateTimeForDriver, normalizeStoredDateTimeToIso, nowForDriver } from '../utils.ts'

function mapAuthTokenRow(row: Record<string, unknown>): AuthTokenRecord {
  return {
    id: String(row.id),
    userId: String(row.userId),
    kind: row.kind as AuthTokenRecord['kind'],
    name: String(row.name),
    tokenPrefix: String(row.tokenPrefix),
    tokenHash: String(row.tokenHash),
    storage: row.storage as AuthTokenRecord['storage'],
    expiresAt: normalizeStoredDateTimeToIso(row.expiresAt),
    lastUsedAt: normalizeStoredDateTimeToIso(row.lastUsedAt),
    createdAt: normalizeStoredDateTimeToIso(row.createdAt) ?? '',
  }
}

function mapOidcStateRow(row: Record<string, unknown>): OidcStateRecord {
  return {
    id: String(row.id),
    state: String(row.state),
    nonce: String(row.nonce),
    codeVerifier: String(row.codeVerifier),
    returnTo: String(row.returnTo),
    storage: row.storage as OidcStateRecord['storage'],
    createdAt: String(row.createdAt ?? ''),
  }
}

export async function createAuthToken(
  context: MetaRepositoryContext,
  input: {
    userId: string
    kind: AuthTokenRecord['kind']
    name: string
    tokenPrefix: string
    tokenHash: string
    storage: AuthTokenRecord['storage']
    expiresAt?: string | null
  },
): Promise<AuthTokenRecord> {
  const now = nowForDriver(context.driver)
  const storedExpiresAt = normalizeNullableDateTimeForDriver(input.expiresAt, context.driver)
  const record: AuthTokenRecord = {
    id: crypto.randomUUID(),
    userId: input.userId,
    kind: input.kind,
    name: input.name,
    tokenPrefix: input.tokenPrefix,
    tokenHash: input.tokenHash,
    storage: input.storage,
    expiresAt: normalizeStoredDateTimeToIso(storedExpiresAt),
    lastUsedAt: null,
    createdAt: normalizeStoredDateTimeToIso(now) ?? now,
  }

  await context.db.insert(context.schema.authTokens).values({
    id: record.id,
    userId: record.userId,
    kind: record.kind,
    name: record.name,
    tokenPrefix: record.tokenPrefix,
    tokenHash: record.tokenHash,
    storage: record.storage,
    expiresAt: storedExpiresAt,
    lastUsedAt: record.lastUsedAt,
    createdAt: now,
  })

  return record
}

export async function listAuthTokens(
  context: MetaRepositoryContext,
  userId: string,
  kind?: AuthTokenRecord['kind'],
) {
  const whereClause = kind
    ? and(eq(context.schema.authTokens.userId, userId), eq(context.schema.authTokens.kind, kind))
    : eq(context.schema.authTokens.userId, userId)

  const rows = await context.db
    .select()
    .from(context.schema.authTokens)
    .where(whereClause)
    .orderBy(desc(context.schema.authTokens.createdAt))

  return rows.map((row: Record<string, unknown>) => mapAuthTokenRow(row))
}

export async function getAuthTokenByHash(context: MetaRepositoryContext, tokenHash: string) {
  const rows = await context.db
    .select()
    .from(context.schema.authTokens)
    .where(eq(context.schema.authTokens.tokenHash, tokenHash))
    .limit(1)

  return rows[0] ? mapAuthTokenRow(rows[0]) : null
}

export async function updateAuthTokenLastUsed(context: MetaRepositoryContext, tokenId: string) {
  await context.db
    .update(context.schema.authTokens)
    .set({ lastUsedAt: nowForDriver(context.driver) })
    .where(eq(context.schema.authTokens.id, tokenId))
}

export async function deleteAuthToken(context: MetaRepositoryContext, tokenId: string) {
  await context.db.delete(context.schema.authTokens).where(eq(context.schema.authTokens.id, tokenId))
}

export async function deleteAuthTokenByHash(context: MetaRepositoryContext, tokenHash: string) {
  await context.db.delete(context.schema.authTokens).where(eq(context.schema.authTokens.tokenHash, tokenHash))
}

export async function createOidcState(
  context: MetaRepositoryContext,
  input: {
    state: string
    nonce: string
    codeVerifier: string
    returnTo: string
    storage: OidcStateRecord['storage']
  },
) {
  const record: OidcStateRecord = {
    id: crypto.randomUUID(),
    state: input.state,
    nonce: input.nonce,
    codeVerifier: input.codeVerifier,
    returnTo: input.returnTo,
    storage: input.storage,
    createdAt: nowForDriver(context.driver),
  }

  await context.db.insert(context.schema.oidcStates).values({
    id: record.id,
    state: record.state,
    nonce: record.nonce,
    codeVerifier: record.codeVerifier,
    returnTo: record.returnTo,
    storage: record.storage,
    createdAt: record.createdAt,
  })

  return record
}

export async function getOidcState(context: MetaRepositoryContext, state: string) {
  const rows = await context.db
    .select()
    .from(context.schema.oidcStates)
    .where(eq(context.schema.oidcStates.state, state))
    .limit(1)

  return rows[0] ? mapOidcStateRow(rows[0]) : null
}

export async function deleteOidcState(context: MetaRepositoryContext, state: string) {
  await context.db.delete(context.schema.oidcStates).where(eq(context.schema.oidcStates.state, state))
}
