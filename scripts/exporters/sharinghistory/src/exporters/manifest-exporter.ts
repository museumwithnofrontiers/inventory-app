import type { ExportResult, ExportScope } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

/**
 * The language codes every page of a mini-site has a title in. A collection
 * with no title in any language is not a page: legacy listed only titled
 * themes and subthemes. Exported for unit tests.
 */
export function minisiteLanguages(
  titled: { collection_id: string; code: string }[],
  collectionIds: string[]
): string[] {
  const codes = [...new Set(titled.map(row => row.code))].sort()
  const pages = collectionIds.filter(id => titled.some(row => row.collection_id === id))
  return codes.filter(code =>
    pages.every(id => titled.some(row => row.collection_id === id && row.code === code))
  )
}

interface LanguageNameRow {
  language_id: string
  name: string
}

interface ProjectNameRow {
  language_id: string
  title: string | null
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
 * `languages` lists every language in the database, as it always has. `site`
 * is what the website's `dataset.config.js` needs at boot: the languages the
 * exported items actually carry a translation in, in switcher order, each
 * with its native label, and the name of the primary project per language.
 */
export class ManifestExporter extends BaseExporter {
  getName(): string {
    return 'Manifest'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Writing manifest.json...')

    const langRows = await this.db.query<{ backward_compatibility: string }>(
      `SELECT backward_compatibility FROM languages WHERE backward_compatibility IS NOT NULL ORDER BY id`
    )

    const manifest = {
      generatedAt: new Date().toISOString(),
      projectKeys: this.context.projectKeys,
      projectIds: this.context.projectIds,
      version: '1.0.0',
      // Keep in sync with scripts/exporters/docs/LICENSE.md.template, the
      // canonical text this quotes (viewer-core#79 reads manifest.rights).
      rights: {
        rights_holder: 'Museum Ohne Grenzen e.V. (Museum With No Frontiers)',
        terms_url: 'https://www.museumwnf.org/about/legal-notice',
        attribution: 'Content © Museum With No Frontiers, used under the MWNF legal notice.',
      },
      site: this.context.scope
        ? await this.minisite(this.context.scope)
        : {
            key: 'sharinghistory',
            languages: await this.siteLanguages(),
            names: await this.siteNames(),
          },
      languages: langRows.map(r => r.backward_compatibility),
      // Every project referenced by anything this package ships — for a
      // project-scoped exporter that is exactly the exported project(s)
      // themselves (items/partners/collections/timelines never reference a
      // project outside `this.projectIds`). Additive: `projectKeys`/
      // `projectIds` above stay untouched (epic #1727 phase 2).
      projects: await this.buildProjectsSection(this.projectIds),
    }

    await this.writeJson('manifest.json', manifest)
    this.logger.success(`manifest.json (${manifest.site.languages.map(l => l.code).join(', ')})`)

    return { file: 'manifest.json', count: 1 }
  }

  /**
   * The languages at least one exported item is translated in, as the
   * switcher shows them: the code and the language's own name for itself
   * (`language_translations` where the display language is the language), the
   * code in capitals where the table has none. Alphabetical by code, which is
   * the order these websites have always used.
   */
  private async siteLanguages(): Promise<{ code: string; label: string }[]> {
    const ph = this.placeholders(this.projectIds.length)
    const rows = await this.db.query<LanguageNameRow & { code: string }>(
      `SELECT DISTINCT l.id AS language_id, l.backward_compatibility AS code, lt.name
       FROM item_translations it
       JOIN items i ON i.id = it.item_id
       JOIN languages l ON l.id = it.language_id
       LEFT JOIN language_translations lt
         ON lt.language_id = l.id AND lt.display_language_id = l.id
       WHERE i.project_id IN (${ph}) AND l.backward_compatibility IS NOT NULL`,
      this.projectIds
    )
    return rows
      .map(row => ({ code: row.code, label: row.name || row.code.toUpperCase() }))
      .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  }

  /**
   * A mini-site's `site`: its key, the languages it is shown in, its name per
   * language, the collection it is, its legacy address, and the site that
   * carried it on legacy, named. It is shown in a language only when every
   * page of the exhibition has a title in it: Sharing History's exhibitions
   * hold a few titles in other languages, but their themes are in English
   * only, and legacy showed them in English.
   */
  private async minisite(scope: ExportScope): Promise<{
    key: string
    languages: { code: string; label: string }[]
    names: Record<string, string>
    root_collection_id: string
    legacy_url: string | null
    parent: { key: string; names: Record<string, string> }
  }> {
    const rows = await this.db.query<LanguageNameRow & { code: string; collection_id: string; title: string | null }>(
      `SELECT ct.collection_id, l.id AS language_id, l.backward_compatibility AS code, lt.name, ct.title
       FROM collection_translations ct
       JOIN languages l ON l.id = ct.language_id
       LEFT JOIN language_translations lt
         ON lt.language_id = l.id AND lt.display_language_id = l.id
       WHERE ct.collection_id IN (${this.placeholders(scope.collectionIds.length)})
         AND l.backward_compatibility IS NOT NULL
       ORDER BY l.backward_compatibility`,
      scope.collectionIds
    )
    const titled = rows.filter(row => row.title?.trim())
    const shown = minisiteLanguages(titled, scope.collectionIds)
    const root = titled.filter(row => row.collection_id === scope.rootCollectionId && shown.includes(row.code))
    return {
      key: scope.key,
      languages: root.map(row => ({ code: row.code, label: row.name || row.code.toUpperCase() })),
      names: Object.fromEntries(root.map(row => [row.code, row.title as string])),
      root_collection_id: scope.rootCollectionId,
      legacy_url: scope.legacyUrl,
      parent: { key: scope.parentKey, names: await this.siteNames() },
    }
  }

  /**
   * The name of the primary project per language, read from the collection
   * that represents the project: the importer gives that collection the
   * project's own `backward_compatibility` (`mwnf3:projects:<KEY>`).
   */
  private async siteNames(): Promise<Record<string, string>> {
    const primary = this.projectIds[0]
    if (!primary) return {}
    const rows = await this.db.query<ProjectNameRow>(
      // Row order is unspecified; sorted so `site.names`' key order is
      // byte-identical across two exports of one database.
      `SELECT l.backward_compatibility AS language_id, ct.title
       FROM collection_translations ct
       JOIN collections c ON c.id = ct.collection_id
       JOIN projects p ON p.backward_compatibility = c.backward_compatibility
       JOIN languages l ON l.id = ct.language_id
       WHERE p.id = ? AND l.backward_compatibility IS NOT NULL
       ORDER BY l.backward_compatibility`,
      [primary]
    )
    const names: Record<string, string> = {}
    for (const row of rows) {
      if (row.title) names[row.language_id] = row.title
    }
    return names
  }

  /**
   * `manifest.projects` — one entry per referenced project UUID, keyed by
   * that UUID (epic #1727 phase 2). `name` comes from the sibling Collection's
   * translations, joined by matching `backward_compatibility` — `Project`
   * itself carries no translations. The three URL columns come straight off
   * `projects` (nullable, populated at import time — epic #1727 phase 1,
   * #1753/#1756).
   */
  protected async buildProjectsSection(projectIds: string[]): Promise<Record<string, ProjectEntry>> {
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
