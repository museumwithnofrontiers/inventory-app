import mysql from 'mysql2/promise'
import type { Gallery, GalleryAnchor, GalleryChrome } from './types.js'

interface GalleryRow {
  id: string
  backward_compatibility: string
  type: string
  extra: unknown
}

interface MemberRow {
  item_id: string
  project_id: string | null
}

interface ProjectRow {
  id: string
  backward_compatibility: string | null
  context_id: string | null
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

  /**
   * Resolve the gallery collection this exporter is pinned to.
   *
   * A DXA gallery site is one `collections` row of type 'gallery', identified
   * by its UUID (the instance file's `collection_id`, obtained ahead of time
   * via `php artisan importer:find-collection gallery <legacy id|slug|title>`).
   * Everything the site shows hangs off it: the anchor in `extra.thg_gallery`
   * (slug, host, source project) and the membership union in `collection_item`.
   */
  async resolveGallery(collectionId: string): Promise<Gallery> {
    const rows = await this.query<GalleryRow>(
      `SELECT id, backward_compatibility, type, extra
       FROM collections
       WHERE id = ?`,
      [collectionId]
    )

    const row = rows[0]
    if (!row) {
      throw new Error(
        `Gallery collection not found: ${collectionId}\n` +
          `Run: php artisan importer:find-collection gallery <legacy id|slug|title> --json to look up a collection_id.`
      )
    }

    if (row.type !== 'gallery') {
      throw new Error(
        `${collectionId} is a '${row.type}', not a 'gallery'. ` +
          `Exhibitions need the exhibition package shape (themes, curated texts) — use dxa-exhibition instead.`
      )
    }

    const extra = (parseJson<{ thg_gallery?: GalleryAnchor }>(row.extra) ?? {}) as {
      thg_gallery?: GalleryAnchor
    }
    const anchor = extra.thg_gallery ?? {}

    const mwnf3ProjectId = anchor.mwnf3_project_id ?? null

    return {
      id: row.id,
      backwardCompatibility: row.backward_compatibility,
      slug: anchor.slug ?? null,
      host: anchor.host ?? null,
      mwnf3ProjectId,
      projectId: await this.resolveProjectId(mwnf3ProjectId),
      anchor,
      chrome: await this.loadGalleryChrome(row.id),
    }
  }

  /**
   * Inventory UUID of an mwnf3 project, by its legacy code.
   *
   * The inverse of `legacyProjectKey`, and the reason the gallery's project is
   * never a hardcoded string anywhere downstream: the code comes from the
   * gallery's own anchor, and this turns it into the id `partners.project_id`
   * and `items.project_id` actually store. Null (never an error) when the code
   * is absent or the project was not imported — the callers all degrade to
   * "that branch contributes nothing", which is the right answer.
   */
  private async resolveProjectId(mwnf3ProjectId: string | null): Promise<string | null> {
    if (!mwnf3ProjectId) return null

    const rows = await this.query<{ id: string }>(
      `SELECT id FROM projects WHERE backward_compatibility = ?`,
      [`mwnf3:projects:${mwnf3ProjectId}`]
    )
    return rows[0]?.id ?? null
  }

  /**
   * The `thg_gallery` fields the importer copied onto each language row of
   * `collection_translations.extra`. They are identical across languages (they
   * describe the gallery, not the language), so the first row wins.
   */
  private async loadGalleryChrome(collectionId: string): Promise<GalleryChrome> {
    const rows = await this.query<{ extra: unknown }>(
      `SELECT extra FROM collection_translations
       WHERE collection_id = ? AND extra IS NOT NULL
       ORDER BY language_id`,
      [collectionId]
    )

    for (const row of rows) {
      const parsed = parseJson<{ thg_gallery?: GalleryChrome }>(row.extra)
      if (parsed?.thg_gallery) return parsed.thg_gallery
    }
    return {}
  }

  /**
   * The gallery's item universe: the members of its collection.
   *
   * Legacy computed this as an OR predicate — items of the gallery's native
   * mwnf3 project UNION items listed in the six `thg_gallery_*` link tables.
   * The importer materializes that union in `collection_item`
   * (museumwithnofrontiers/inventory-app#1517, gap G1), so membership is a plain join here.
   *
   * 'picture' children are excluded: they ship as `images` on their parent.
   */
  async resolveMembers(collectionId: string): Promise<MemberRow[]> {
    return this.query<MemberRow>(
      `SELECT i.id AS item_id, i.project_id
       FROM collection_item ci
       JOIN items i ON i.id = ci.item_id
       WHERE ci.collection_id = ?
         AND i.type IN ('object', 'monument')
       ORDER BY i.type, i.display_order, i.internal_name`,
      [collectionId]
    )
  }

  /**
   * Per-item project key and own-project context, for the member items.
   *
   * A gallery's members can be a mix of native and BORROWED records — the split
   * varies per gallery, from purely-curated (nothing native) to native-heavy —
   * so neither the project key shown on the item sheet nor the context that
   * selects its canonical translation can be a per-export constant the way it
   * is for the single-project exporters.
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
    const projects = await this.query<ProjectRow>(
      `SELECT id, backward_compatibility, context_id
       FROM projects
       WHERE id IN (${placeholders})`,
      projectIds
    )

    const keyByProject = new Map<string, string>()
    const contextByProject = new Map<string, string>()
    for (const project of projects) {
      const key = legacyProjectKey(project.backward_compatibility)
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
}

/**
 * The legacy project code from a project's backward_compatibility key —
 * `mwnf3:projects:EPM` → `EPM`, `mwnf3_sharing_history:sh_projects:awe` → `awe`
 * (the SH keyspace is lowercase by importer convention). This is the code the
 * legacy item sheet prints as the "source database" and the one a future link
 * resolver will pair with the item's backward_compatibility.
 */
export function legacyProjectKey(backwardCompatibility: string | null): string | null {
  if (!backwardCompatibility) return null
  const segments = backwardCompatibility.split(':')
  const last = segments[segments.length - 1]
  return last && last.length > 0 ? last : null
}

/**
 * Parses a MySQL JSON column value. mysql2 auto-decodes native JSON columns
 * into JS objects already, so `raw` is usually an object/array, not a string
 * — only fall back to JSON.parse for the (defensive) string case.
 */
function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(raw as string) as T
  } catch {
    return null
  }
}
