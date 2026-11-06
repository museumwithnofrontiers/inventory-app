import mysql from 'mysql2/promise'
import type { Hub } from './types.js'

/** A member item and its project. */
export interface MemberRow {
  item_id: string
  project_id: string | null
}

export class Database {
  private connection: mysql.Connection | null = null

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection({
      host: process.env['DB_HOST'] ?? 'localhost',
      port: parseInt(process.env['DB_PORT'] ?? '3306', 10),
      user: process.env['DB_USERNAME'] ?? 'root',
      password: process.env['DB_PASSWORD'] ?? '',
      database: process.env['DB_DATABASE'] ?? 'inventory',
    })
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end()
      this.connection = null
    }
  }

  async query<T>(sql: string, params?: (string | number | null)[]): Promise<T[]> {
    if (!this.connection) {
      throw new Error('Database not connected')
    }
    const [rows] = await this.connection.execute(sql, params)
    return rows as T[]
  }

  /** The hub's own collection, by its backward-compatibility key. */
  async resolveHub(backwardCompatibility: string): Promise<Hub> {
    const rows = await this.query<{ id: string; backward_compatibility: string }>(
      `SELECT id, backward_compatibility FROM collections WHERE backward_compatibility = ?`,
      [backwardCompatibility]
    )
    const row = rows[0]
    if (!row) {
      throw new Error(
        `Hub collection not found: ${backwardCompatibility} — check that the importer's phase 10 ran against this database.`
      )
    }
    return { id: row.id, backwardCompatibility: row.backward_compatibility }
  }

  /**
   * The hub's objects: the MWNF Galleries records (the partner project's
   * objects and monuments) of the hub's partners, the museums legacy's hub
   * listed with "View objects" (Pascal, 2026-11-06, #2425). Their 'picture'
   * children ship as `images` on their parent, as in a gallery package.
   */
  async resolveHubMembers(projectId: string): Promise<MemberRow[]> {
    return this.query<MemberRow>(
      `SELECT i.id AS item_id, i.project_id
       FROM items i
       JOIN partners p ON p.id = i.partner_id
       WHERE i.project_id = ?
         AND p.project_id = ?
         AND p.type = 'museum'
         AND i.type IN ('object', 'monument')
       ORDER BY i.type, i.display_order, i.internal_name`,
      [projectId, projectId]
    )
  }

  /**
   * Per-item project key and own-project context, for the member items: the
   * context selects each record's canonical translation, as in the
   * dxa-gallery exporter.
   */
  async resolveItemProjects(members: MemberRow[]): Promise<{
    projectKeys: Map<string, string>
    ownContextIds: Map<string, string>
  }> {
    const projectKeys = new Map<string, string>()
    const ownContextIds = new Map<string, string>()

    const projectIds = [...new Set(members.map(m => m.project_id).filter((p): p is string => !!p))]
    if (projectIds.length === 0) return { projectKeys, ownContextIds }

    const placeholders = projectIds.map(() => '?').join(', ')
    const projects = await this.query<{ id: string; backward_compatibility: string | null; context_id: string | null }>(
      `SELECT id, backward_compatibility, context_id
       FROM projects
       WHERE id IN (${placeholders})`,
      projectIds
    )

    const keyByProject = new Map<string, string>()
    const contextByProject = new Map<string, string>()
    for (const project of projects) {
      const key = project.backward_compatibility?.split(':').pop()
      if (key) keyByProject.set(project.id, key)
      if (project.context_id) contextByProject.set(project.id, project.context_id)
    }

    for (const member of members) {
      if (!member.project_id) continue
      const key = keyByProject.get(member.project_id)
      if (key) projectKeys.set(member.item_id, key)
      const contextId = contextByProject.get(member.project_id)
      if (contextId) ownContextIds.set(member.item_id, contextId)
    }

    return { projectKeys, ownContextIds }
  }

  /** Inventory UUID of a project, by its backward-compatibility key. */
  async resolveProjectId(backwardCompatibility: string): Promise<string> {
    const rows = await this.query<{ id: string }>(
      `SELECT id FROM projects WHERE backward_compatibility = ?`,
      [backwardCompatibility]
    )
    const row = rows[0]
    if (!row) {
      throw new Error(`Project not found: ${backwardCompatibility}`)
    }
    return row.id
  }
}

/**
 * Parses a MySQL JSON column value. mysql2 auto-decodes native JSON columns
 * into JS objects already, so `raw` is usually an object/array, not a string
 * — only fall back to JSON.parse for the (defensive) string case.
 */
export function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(raw as string) as T
  } catch {
    return null
  }
}
