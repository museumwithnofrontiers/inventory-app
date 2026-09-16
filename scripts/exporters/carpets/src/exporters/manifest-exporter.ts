import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface GalleryTranslationRow {
  language_id: string
  title: string | null
}

interface LanguageNameRow {
  language_id: string
  name: string
}

interface MemberProjectRow {
  project_id: string | null
}

interface ProjectRow {
  id: string
  backward_compatibility: string | null
  site_url: string | null
  related_database_url: string | null
  artistic_introduction_url: string | null
}

interface ProjectTitleRow {
  project_id: string
  language_id: string
  title: string | null
}

/** One entry of `manifest.projects` — see `ManifestExporter.buildProjectsSection`. */
export interface ProjectEntry {
  name: Record<string, string>
  site_url: string | null
  related_database_url: string | null
  artistic_introduction_url: string | null
}

/**
 * `manifest.json` — what this package is and when it was made, and the one
 * thing a website reads before it mounts.
 *
 * `languages` lists every language the gallery collection carries a
 * translation row for (`thg_gallery_lang`). It is metadata only: a website
 * offers a language only where the item translation files actually carry it,
 * since an individual record may carry more languages than the gallery
 * shipped in.
 *
 * `site` is what the website's `dataset.config.js` needs at boot and cannot
 * read from `gallery.json` any more, now that every entity is loaded lazily:
 * the gallery's own languages in switcher order with their native labels, and
 * its name per language.
 */
export class ManifestExporter extends BaseExporter {
  getName(): string {
    return 'Manifest'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Writing manifest.json...')

    const langCodeMap = await this.buildLangCodeMap()
    const rows = await this.db.query<GalleryTranslationRow>(
      `SELECT language_id, title FROM collection_translations WHERE collection_id = ?`,
      [this.gallery.id]
    )

    const names: Record<string, string> = {}
    const languageIds: string[] = []
    for (const row of rows) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      languageIds.push(row.language_id)
      if (row.title) names[code] = row.title
    }

    const languages = languageIds
      .map(id => langCodeMap.get(id))
      .filter((code): code is string => !!code)
      .sort()

    const manifest = {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      // Keep in sync with scripts/exporters/docs/LICENSE.md.template, the
      // canonical text this quotes (viewer-core#79 reads manifest.rights).
      rights: {
        rights_holder: 'Museum Ohne Grenzen e.V. (Museum With No Frontiers)',
        terms_url: 'https://www.museumwnf.org/about/legal-notice',
        attribution: 'Content © Museum With No Frontiers, used under the MWNF legal notice.',
      },
      site: {
        key: 'carpets',
        languages: await this.siteLanguages(languageIds, langCodeMap),
        names,
      },
      kind: 'gallery',
      gallery: {
        id: this.gallery.id,
        backward_compatibility: this.gallery.backwardCompatibility,
        slug: this.gallery.slug,
        mwnf3_project_id: this.gallery.mwnf3ProjectId,
      },
      languages,
      itemCount: this.memberItemIds.length,
      // Every project referenced by anything this package ships: the source
      // project of each member item (a hybrid gallery borrows from several)
      // plus the gallery's own native project, even when it happens to hold
      // no member (epic #1727 phase 2). Additive — nothing above is renamed.
      projects: await this.buildProjectsSection(await this.collectProjectIds()),
    }

    await this.writeJson('manifest.json', manifest)
    this.logger.success(`manifest.json (${languages.join(', ')})`)

    return { file: 'manifest.json', count: 1 }
  }

  /**
   * The gallery's languages as the switcher shows them: the code and the
   * language's own name for itself (`language_translations` where the display
   * language is the language), the code in capitals where the table has none.
   * Alphabetical by code, which is the order the gallery has always used.
   */
  private async siteLanguages(
    languageIds: string[],
    langCodeMap: Map<string, string>
  ): Promise<{ code: string; label: string }[]> {
    if (languageIds.length === 0) return []
    const ph = this.placeholders(languageIds.length)
    const rows = await this.db.query<LanguageNameRow>(
      `SELECT language_id, name FROM language_translations
       WHERE language_id IN (${ph}) AND display_language_id = language_id`,
      languageIds
    )
    const labels = new Map(rows.map(row => [row.language_id, row.name]))
    return languageIds
      .map(id => ({ code: langCodeMap.get(id) as string, label: labels.get(id) || (langCodeMap.get(id) as string).toUpperCase() }))
      .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  }

  /**
   * Every project UUID this package's items reference, plus the gallery's own
   * native project (`gallery.projectId`) even if it happens to hold no member
   * item today. A hybrid gallery's members carry several distinct source
   * projects — see `ItemExporter`/`items.json`'s `project_id` — so this is
   * not a per-export constant.
   */
  private async collectProjectIds(): Promise<string[]> {
    const ids = new Set<string>()
    if (this.gallery.projectId) ids.add(this.gallery.projectId)
    if (this.memberItemIds.length > 0) {
      const ph = this.placeholders(this.memberItemIds.length)
      const rows = await this.db.query<MemberProjectRow>(
        `SELECT DISTINCT project_id FROM items WHERE id IN (${ph}) AND project_id IS NOT NULL`,
        this.memberItemIds
      )
      for (const row of rows) {
        if (row.project_id) ids.add(row.project_id)
      }
    }
    return [...ids]
  }

  /**
   * `manifest.projects` — one entry per referenced project UUID, keyed by
   * that UUID (epic #1727 phase 2). `name` comes from the sibling Collection's
   * translations, joined by matching `backward_compatibility` — `Project`
   * itself carries no translations. The three URL columns come straight off
   * `projects` (nullable, populated at import time — epic #1727 phase 1,
   * #1753/#1756).
   */
  private async buildProjectsSection(projectIds: string[]): Promise<Record<string, ProjectEntry>> {
    if (projectIds.length === 0) return {}
    const ph = this.placeholders(projectIds.length)
    const langCodeMap = await this.buildLangCodeMap()

    const [projects, titles] = await Promise.all([
      this.db.query<ProjectRow>(
        `SELECT id, backward_compatibility, site_url, related_database_url, artistic_introduction_url
         FROM projects
         WHERE id IN (${ph})`,
        projectIds
      ),
      this.db.query<ProjectTitleRow>(
        `SELECT p.id AS project_id, ct.language_id, ct.title
         FROM projects p
         JOIN collections c ON c.backward_compatibility = p.backward_compatibility
         JOIN collection_translations ct ON ct.collection_id = c.id
         WHERE p.id IN (${ph})`,
        projectIds
      ),
    ])

    const namesByProject = new Map<string, Record<string, string>>()
    for (const row of titles) {
      const code = langCodeMap.get(row.language_id)
      if (!code || !row.title) continue
      if (!namesByProject.has(row.project_id)) namesByProject.set(row.project_id, {})
      namesByProject.get(row.project_id)![code] = row.title
    }

    const result: Record<string, ProjectEntry> = {}
    for (const p of projects) {
      result[p.id] = {
        name: namesByProject.get(p.id) ?? {},
        site_url: p.site_url,
        related_database_url: p.related_database_url,
        artistic_introduction_url: p.artistic_introduction_url,
      }
    }
    return result
  }
}
