/**
 * Read-only access to the legacy MWNF database.
 *
 * Every statement this class issues is a SELECT. The tool has no write path and
 * no connection to the inventory database — extraction goes legacy → files, and
 * stops there.
 */
import mysql from 'mysql2/promise'

import type { ExplorePageRow } from '../explore.js'
import type { SiteRegistryEntry, SiteKind, TranslationRow } from './types.js'

interface LegacyGalleryRow {
  gallery_id: number
  project_id: string | null
  mwnf3_project_id: string | null
  link: string | null
  name: string
  status: string
  i18n_group_id: number | null
  i18n_common_group_id: number | null
}

export class LegacyDatabase {
  private connection: mysql.Connection | null = null

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection({
      host: process.env['LEGACY_DB_HOST'] ?? 'localhost',
      port: parseInt(process.env['LEGACY_DB_PORT'] ?? '3306', 10),
      user: process.env['LEGACY_DB_USER'] ?? 'root',
      password: process.env['LEGACY_DB_PASSWORD'] ?? '',
      database: process.env['LEGACY_DB_DATABASE'] ?? 'mwnf3',
    })
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end()
      this.connection = null
    }
  }

  private async query<T>(sql: string, params: (string | number)[] = []): Promise<T[]> {
    if (!this.connection) {
      throw new Error('Legacy database not connected')
    }
    const [rows] = await this.connection.execute(sql, params)
    return rows as T[]
  }

  /**
   * Load the site registry: every gallery and exhibition, with its slug, canonical
   * host and i18n group ids.
   *
   * `thg_gallery` is the authoritative registry — it is the only source that covers
   * exhibitions as well as galleries, and it is what the importer reads for the
   * gallery anchor. The hosts come from `thg_gallery_url`, queried separately
   * because a gallery may in principle carry more than one URL row.
   */
  async loadRegistry(): Promise<SiteRegistryEntry[]> {
    const galleries = await this.query<LegacyGalleryRow>(
      `SELECT gallery_id, project_id, mwnf3_project_id, link, name, status,
              i18n_group_id, i18n_common_group_id
         FROM mwnf3_thematic_gallery.thg_gallery
        ORDER BY gallery_id`
    )

    const urls = await this.query<{ gallery_id: number; link: string | null }>(
      `SELECT gallery_id, link FROM mwnf3_thematic_gallery.thg_gallery_url`
    )
    const hostByGallery = new Map<number, string>()
    for (const row of urls) {
      if (row.link) {
        hostByGallery.set(row.gallery_id, row.link)
      }
    }

    return galleries.map((row) => ({
      galleryId: row.gallery_id,
      thgProjectId: row.project_id,
      kind: (row.project_id === 'EXH' ? 'exhibition' : 'gallery') as SiteKind,
      mwnf3ProjectId: row.mwnf3_project_id,
      slug: row.link,
      host: hostByGallery.get(row.gallery_id) ?? null,
      name: row.name,
      status: row.status,
      i18nGroupId: row.i18n_group_id,
      i18nCommonGroupId: row.i18n_common_group_id,
    }))
  }

  /** Load every translation row of one i18n group. */
  async loadTranslationGroup(groupId: number): Promise<TranslationRow[]> {
    const rows = await this.query<{ word_id: string; lang_id: string; value: string | null }>(
      `SELECT word_id, lang_id, \`value\`
         FROM mwnf3.translation
        WHERE group_id = ?
        ORDER BY word_id, lang_id`,
      [groupId]
    )
    return rows.map((row) => ({ wordId: row.word_id, langId: row.lang_id, value: row.value }))
  }

  /** Load every language of every Explore page (`explore_pages` + `explore_pages_langs`). */
  async loadExplorePages(): Promise<ExplorePageRow[]> {
    return this.query<ExplorePageRow>(
      `SELECT p.pagename, l.langId, l.title, l.description
         FROM mwnf3_explore.explore_pages p
         JOIN mwnf3_explore.explore_pages_langs l ON l.pageId = p.pageId
        ORDER BY p.pageId, l.langId`
    )
  }

  /** Load the named words of Explore's own dictionary, `mwnf3_explore.translation`, in every group. */
  async loadExploreWords(wordIds: string[]): Promise<TranslationRow[]> {
    if (wordIds.length === 0) {
      return []
    }
    const rows = await this.query<{ word_id: string; lang_id: string; value: string | null }>(
      `SELECT word_id, lang_id, \`value\`
         FROM mwnf3_explore.translation
        WHERE word_id IN (${wordIds.map(() => '?').join(', ')})
        ORDER BY word_id, lang_id, group_id`,
      wordIds
    )
    return rows.map((row) => ({ wordId: row.word_id, langId: row.lang_id, value: row.value }))
  }
}
