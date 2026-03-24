import type { AppConfig } from '../config/app-config.ts'
import { applyMetaBootstrapConfig } from './bootstrap.ts'
import { createMetaDatabaseConnection, type MetaDatabaseConnection } from './connection.ts'
import { ensureDefaultMetaContent } from './default-content.ts'
import { runMetaMigrations } from './migration-runner.ts'
import {
  createAuthToken,
  createOidcState,
  deleteAuthToken,
  deleteAuthTokenByHash,
  deleteOidcState,
  getAuthTokenByHash,
  getOidcState,
  listAuthTokens,
  updateAuthTokenLastUsed,
} from './repositories/auth-repository.ts'
import {
  createDataSource,
  deleteDataSource,
  getDataSource,
  listDataSources,
  updateDataSource,
} from './repositories/data-sources-repository.ts'
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjectBySlug,
  listProjects,
  updateProject,
} from './repositories/projects-repository.ts'
import {
  countUsers,
  createRole,
  createUser,
  deleteRole,
  deleteUser,
  getRoleById,
  getRoleBySlug,
  getUserByEmail,
  getUserByExternalSubject,
  getUserById,
  getUserWithRoles,
  listRoles,
  listUserRoleIds,
  listUsers,
  setUserRoleIds,
  updateRole,
  updateUser,
} from './repositories/users-repository.ts'
import type {
  AuthTokenRecord,
  BootstrapConfig,
  DataSourceRecord,
  OidcStateRecord,
  ProjectRecord,
  RoleRecord,
  UserRecord,
  UserWithRolesRecord,
} from './types.ts'

export class MetaStore {
  private connection: MetaDatabaseConnection | null = null

  constructor(private readonly config: AppConfig) {}

  private getConnection() {
    if (!this.connection) {
      throw new Error('MetaStore has not been initialized yet')
    }

    return this.connection
  }

  async initialize() {
    if (this.connection) {
      return
    }

    const connection = await createMetaDatabaseConnection(this.config)
    this.connection = connection

    try {
      await this.runMigrations()
      await ensureDefaultMetaContent(this.config, connection)
    } catch (error) {
      await this.close().catch(() => {})
      throw error
    }
  }

  async close() {
    const connection = this.connection
    this.connection = null
    if (!connection) {
      return
    }

    await connection.close()
  }

  async applyBootstrapConfig(bootstrapConfig: BootstrapConfig) {
    await applyMetaBootstrapConfig(this.config, this.getConnection(), bootstrapConfig)
  }

  private async runMigrations() {
    await runMetaMigrations(this.getConnection())
  }

  async countUsers() {
    return countUsers(this.getConnection())
  }

  async listUsers(): Promise<UserRecord[]> {
    return listUsers(this.getConnection())
  }

  async getUserById(userId: string) {
    return getUserById(this.getConnection(), userId)
  }

  async getUserByEmail(email: string) {
    return getUserByEmail(this.getConnection(), email)
  }

  async getUserByExternalSubject(authProvider: UserRecord['authProvider'], externalSubject: string) {
    return getUserByExternalSubject(this.getConnection(), authProvider, externalSubject)
  }

  async createUser(input: Parameters<typeof createUser>[1]): Promise<UserRecord> {
    return createUser(this.getConnection(), input)
  }

  async updateUser(userId: string, patch: Parameters<typeof updateUser>[2]) {
    return updateUser(this.getConnection(), userId, patch)
  }

  async deleteUser(userId: string) {
    return deleteUser(this.getConnection(), userId)
  }

  async listRoles(): Promise<RoleRecord[]> {
    return listRoles(this.getConnection())
  }

  async getRoleById(roleId: string) {
    return getRoleById(this.getConnection(), roleId)
  }

  async getRoleBySlug(slug: string) {
    return getRoleBySlug(this.getConnection(), slug)
  }

  async createRole(input: Parameters<typeof createRole>[1]): Promise<RoleRecord> {
    return createRole(this.getConnection(), input)
  }

  async updateRole(roleId: string, patch: Parameters<typeof updateRole>[2]) {
    return updateRole(this.getConnection(), roleId, patch)
  }

  async deleteRole(roleId: string) {
    return deleteRole(this.getConnection(), roleId)
  }

  async listUserRoleIds(userId: string) {
    return listUserRoleIds(this.getConnection(), userId)
  }

  async setUserRoleIds(userId: string, roleIds: string[]) {
    return setUserRoleIds(this.getConnection(), userId, roleIds)
  }

  async getUserWithRoles(userId: string): Promise<UserWithRolesRecord | null> {
    return getUserWithRoles(this.getConnection(), userId)
  }

  async createAuthToken(input: Parameters<typeof createAuthToken>[1]): Promise<AuthTokenRecord> {
    return createAuthToken(this.getConnection(), input)
  }

  async listAuthTokens(userId: string, kind?: AuthTokenRecord['kind']) {
    return listAuthTokens(this.getConnection(), userId, kind)
  }

  async getAuthTokenByHash(tokenHash: string) {
    return getAuthTokenByHash(this.getConnection(), tokenHash)
  }

  async updateAuthTokenLastUsed(tokenId: string) {
    return updateAuthTokenLastUsed(this.getConnection(), tokenId)
  }

  async deleteAuthToken(tokenId: string) {
    return deleteAuthToken(this.getConnection(), tokenId)
  }

  async deleteAuthTokenByHash(tokenHash: string) {
    return deleteAuthTokenByHash(this.getConnection(), tokenHash)
  }

  async createOidcState(input: Parameters<typeof createOidcState>[1]): Promise<OidcStateRecord> {
    return createOidcState(this.getConnection(), input)
  }

  async getOidcState(state: string) {
    return getOidcState(this.getConnection(), state)
  }

  async deleteOidcState(state: string) {
    return deleteOidcState(this.getConnection(), state)
  }

  async listProjects(): Promise<ProjectRecord[]> {
    return listProjects(this.getConnection())
  }

  async getProjectById(projectId: string) {
    return getProjectById(this.getConnection(), projectId)
  }

  async getProjectBySlug(slug: string) {
    return getProjectBySlug(this.getConnection(), slug)
  }

  async createProject(input: Parameters<typeof createProject>[1]): Promise<ProjectRecord> {
    return createProject(this.getConnection(), input)
  }

  async updateProject(projectId: string, patch: Parameters<typeof updateProject>[2]) {
    return updateProject(this.getConnection(), projectId, patch)
  }

  async deleteProject(projectId: string) {
    return deleteProject(this.getConnection(), projectId)
  }

  async listDataSources(projectId: string): Promise<DataSourceRecord[]> {
    return listDataSources(this.getConnection(), projectId)
  }

  async getDataSource(dataSourceId: string) {
    return getDataSource(this.getConnection(), dataSourceId)
  }

  async createDataSource(input: Parameters<typeof createDataSource>[1]): Promise<DataSourceRecord> {
    return createDataSource(this.getConnection(), input)
  }

  async updateDataSource(dataSourceId: string, patch: Parameters<typeof updateDataSource>[2]) {
    return updateDataSource(this.getConnection(), dataSourceId, patch)
  }

  async deleteDataSource(dataSourceId: string) {
    return deleteDataSource(this.getConnection(), dataSourceId)
  }
}
