import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface ExhibitionTranslationRow {
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
 * `languages` lists every language the exhibition collection carries a
 * translation row for (`thg_gallery_lang`), not every language in the
 * database. It is metadata only: a website offers a language only where the
 * item translation files actually carry it, since an individual record may
 * carry more languages than the exhibition shipped in.
 *
 * `site` is what the website's `dataset.config.js` needs at boot and cannot
 * read from `exhibition.json` any more, now that every entity is loaded
 * lazily: the languages legacy actually publishes (`exhibition_i18n.enabled`
 * — the same set as `exhibition.json.languages_enabled`), each with its
 * native label, and the exhibition's title per language. When the instance
 * carries a `languagesEnabled` override, `site.languages` is built from that
 * list instead — see `exhibition-exporter.ts`'s note on the same override.
 */
export class ManifestExporter extends BaseExporter {
  getName(): string {
    return 'Manifest'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Writing manifest.json...')

    const langCodeMap = await this.buildLangCodeMap()
    const rows = await this.db.query<ExhibitionTranslationRow>(
      // Row order is unspecified; sorted so `site.names`' key order is
      // byte-identical across two exports of one database.
      `SELECT language_id, title FROM collection_translations WHERE collection_id = ?
       ORDER BY language_id`,
      [this.exhibition.id]
    )

    const languagesOverride = this.context.languagesEnabled
    if (languagesOverride) {
      const knownCodes = new Set(langCodeMap.values())
      for (const code of languagesOverride) {
        if (!knownCodes.has(code)) {
          throw new Error(
            `Instance override 'languages_enabled' names an unknown language code '${code}'`
          )
        }
      }
    }

    const names: Record<string, string> = {}
    const enabledIds: string[] = []
    const languages: string[] = []
    for (const row of rows) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      languages.push(code)
      if (row.title) names[code] = row.title
      if (!languagesOverride && this.exhibition.i18n.get(row.language_id)?.enabled === 'Y') {
        enabledIds.push(row.language_id)
      }
    }
    languages.sort()

    if (languagesOverride) {
      const idByCode = new Map([...langCodeMap.entries()].map(([id, code]) => [code, id]))
      for (const code of languagesOverride) {
        const id = idByCode.get(code)
        if (id) enabledIds.push(id)
      }
    }

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
        key: this.siteKey,
        languages: await this.siteLanguages(enabledIds, langCodeMap),
        names,
      },
      kind: 'exhibition',
      exhibition: {
        id: this.exhibition.id,
        backward_compatibility: this.exhibition.backwardCompatibility,
        slug: this.exhibition.slug,
        mwnf3_project_id: this.exhibition.mwnf3ProjectId,
        project_id: this.exhibition.projectId,
      },
      languages,
      itemCount: this.memberItemIds.length,
      themeCount: this.themes.length,
      // Every project referenced by anything this package ships: the source
      // project of each member item (the borrowed case) plus the
      // exhibition's own native project, even when it happens to hold no
      // member (epic #1727 phase 2). Additive — nothing above is renamed.
      projects: await this.buildProjectsSection(await this.collectProjectIds()),
    }

    await this.writeJson('manifest.json', manifest)
    this.logger.success(`manifest.json (${languages.join(', ')})`)

    return { file: 'manifest.json', count: 1 }
  }

  /**
   * The exhibition's published languages as the switcher shows them: the code
   * and the language's own name for itself (`language_translations` where the
   * display language is the language), the code in capitals where the table
   * has none. Alphabetical by code.
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
   * Every project UUID this package's items reference, plus the exhibition's
   * own native project (`exhibition.projectId`) even if it happens to hold no
   * member item today. A borrowed exhibition's members carry several
   * distinct source projects — see `ItemExporter`/`items.json`'s
   * `project_id` — so this is not a per-export constant.
   */
  private async collectProjectIds(): Promise<string[]> {
    const ids = new Set<string>()
    if (this.exhibition.projectId) ids.add(this.exhibition.projectId)
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
        // Row order is unspecified; sorted so `manifest.projects`' key order
        // is byte-identical across two exports of one database.
        `SELECT id, backward_compatibility, site_url, related_database_url, artistic_introduction_url
         FROM projects
         WHERE id IN (${ph})
         ORDER BY id`,
        projectIds
      ),
      this.db.query<ProjectTitleRow>(
        // Row order is unspecified; sorted so each project's `name` key order
        // is byte-identical across two exports of one database.
        `SELECT p.id AS project_id, ct.language_id, ct.title
         FROM projects p
         JOIN collections c ON c.backward_compatibility = p.backward_compatibility
         JOIN collection_translations ct ON ct.collection_id = c.id
         WHERE p.id IN (${ph})
         ORDER BY p.id, ct.language_id`,
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
