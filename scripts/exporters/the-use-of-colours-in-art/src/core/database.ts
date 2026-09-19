import mysql from 'mysql2/promise'
import type {
  Exhibition,
  ExhibitionAnchor,
  ExhibitionChrome,
  ExhibitionI18n,
  Theme,
} from './types.js'

interface CollectionRow {
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

interface ThemeRow {
  id: string
  internal_name: string
  backward_compatibility: string | null
  display_order: number | null
  parent_id: string | null
  extra: unknown
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
   * Resolve the exhibition collection this exporter is pinned to.
   *
   * A DXA exhibition is one `collections` row of type 'exhibition', identified
   * by the legacy gallery id — legacy stores exhibitions in the same
   * `thg_gallery` table as galleries. Everything the site shows hangs off it:
   * the anchor in `extra.thg_gallery`, the per-language chrome and
   * `exhibition_i18n` block in `collection_translations.extra`, the membership
   * union in `collection_item`, and the curated theme tree in child collections.
   */
  async resolveExhibition(backwardCompatibility: string): Promise<Exhibition> {
    const rows = await this.query<CollectionRow>(
      `SELECT id, backward_compatibility, type, extra
       FROM collections
       WHERE backward_compatibility = ?`,
      [backwardCompatibility]
    )

    const row = rows[0]
    if (!row) {
      throw new Error(
        `Exhibition collection not found: ${backwardCompatibility}\n` +
          `Run: SELECT backward_compatibility FROM collections WHERE type = 'exhibition'; to list available exhibitions.`
      )
    }

    if (row.type !== 'exhibition') {
      throw new Error(
        `${backwardCompatibility} is a '${row.type}', not an 'exhibition'. ` +
          `Galleries have no curated theme layer — use a gallery exporter (scripts/exporters/carpets).`
      )
    }

    const extra = (parseJson<{ thg_gallery?: ExhibitionAnchor }>(row.extra) ?? {}) as {
      thg_gallery?: ExhibitionAnchor
    }
    const anchor = extra.thg_gallery ?? {}
    const mwnf3ProjectId = anchor.mwnf3_project_id ?? null

    const { chrome, i18n } = await this.loadExhibitionTranslationExtras(row.id)

    return {
      id: row.id,
      backwardCompatibility: row.backward_compatibility,
      slug: anchor.slug ?? null,
      host: anchor.host ?? null,
      mwnf3ProjectId,
      projectId: await this.resolveProjectId(mwnf3ProjectId),
      anchor,
      chrome,
      i18n,
    }
  }

  /**
   * Inventory UUID of an mwnf3 project, by its legacy code.
   *
   * The code comes from the exhibition's own anchor, never a hardcoded string:
   * this turns it into the id `partners.project_id` and `items.project_id`
   * actually store. Null (never an error) when the code is absent or the
   * project was not imported — callers degrade to "that branch contributes
   * nothing", which is the right answer.
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
   * The two blocks the importer writes into `collection_translations.extra`.
   *
   * `thg_gallery` is identical across languages (it describes the site, not the
   * language), so the first row wins. `exhibition_i18n` is genuinely
   * per-language — `enabled` in particular is 'Y' for English and 'N' for
   * German on Colours — so it is kept as a map keyed by language id.
   */
  private async loadExhibitionTranslationExtras(collectionId: string): Promise<{
    chrome: ExhibitionChrome
    i18n: Map<string, ExhibitionI18n>
  }> {
    const rows = await this.query<{ language_id: string; extra: unknown }>(
      `SELECT language_id, extra FROM collection_translations
       WHERE collection_id = ? AND extra IS NOT NULL
       ORDER BY language_id`,
      [collectionId]
    )

    let chrome: ExhibitionChrome = {}
    const i18n = new Map<string, ExhibitionI18n>()

    for (const row of rows) {
      const parsed = parseJson<{
        thg_gallery?: ExhibitionChrome
        exhibition_i18n?: ExhibitionI18n
      }>(row.extra)
      if (!parsed) continue
      if (parsed.thg_gallery && Object.keys(chrome).length === 0) chrome = parsed.thg_gallery
      if (parsed.exhibition_i18n) i18n.set(row.language_id, parsed.exhibition_i18n)
    }

    return { chrome, i18n }
  }

  /**
   * The curated theme tree.
   *
   * Themes and sub-themes are both `collections.type = 'theme'` — the nesting
   * lives in `parent_id`, not in the type. A top-level theme's parent is the
   * exhibition collection; a sub-theme's parent is a theme. Legacy nests
   * exactly one level (`isSubTheme` in the API), and this exporter ships the
   * flat list with `parentId` so the viewer builds the same shape without
   * having to trust that depth.
   *
   * The theme id in the keyspace is NOT the display order and the two must not
   * be conflated: on gallery 47 the five top-level themes are 0, 1, 2, 3 and
   * **11**, and theme 6 does not exist at all.
   */
  async resolveThemes(collectionId: string): Promise<Theme[]> {
    const rows = await this.query<ThemeRow>(
      `SELECT c.id, c.internal_name, c.backward_compatibility, c.display_order,
              c.parent_id, c.extra
       FROM collections c
       WHERE c.type = 'theme'
         AND (c.parent_id = ?
              OR c.parent_id IN (SELECT id FROM (
                   SELECT id FROM collections WHERE type = 'theme' AND parent_id = ?
                 ) AS top_level))
       ORDER BY c.display_order, c.internal_name`,
      [collectionId, collectionId]
    )

    return rows.map(row => ({
      id: row.id,
      backwardCompatibility: row.backward_compatibility,
      internalName: row.internal_name,
      displayOrder: row.display_order ?? 0,
      parentId: row.parent_id,
      coverPictureItemId: coverPictureItemId(row.extra),
    }))
  }

  /**
   * The exhibition's item universe: the members of its collection.
   *
   * Legacy computed this as an OR predicate — items of the exhibition's native
   * mwnf3 project UNION items listed in the six `thg_gallery_*` link tables.
   * The importer materializes that union in `collection_item`
   * (museumwithnofrontiers/inventory-app#1517, gap G1), so membership is a plain join here.
   *
   * 'picture' children are excluded: they ship as `images` on their parent, and
   * separately as the curated selections of `themes.json`.
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
   * An exhibition's members are overwhelmingly BORROWED records — Colours holds
   * 24 of its own EXHCOLOUR items among 171, the rest coming from AWE, BAR,
   * EPM, ISL, DCA, GALLERIES and DGA — so neither the project key shown on the
   * item sheet nor the context that selects its canonical translation can be a
   * per-export constant.
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
 * `extra.thg_theme.cover_picture` (legacy `theme_cover_image`, gap E4). The
 * importer resolves the legacy composite key to an item UUID at import time and
 * stores both, so the exporter reads the id and never re-parses the key.
 */
export function coverPictureItemId(raw: unknown): string | null {
  const parsed = parseJson<{ thg_theme?: { cover_picture?: { item_id?: string } } }>(raw)
  return parsed?.thg_theme?.cover_picture?.item_id ?? null
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
