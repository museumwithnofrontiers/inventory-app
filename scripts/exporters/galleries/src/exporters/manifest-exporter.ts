import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface HubTranslationRow {
  language_id: string
  title: string | null
}

interface LanguageNameRow {
  language_id: string
  name: string
}

interface ProjectRow {
  id: string
  site_url: string | null
  related_database_url: string | null
  artistic_introduction_url: string | null
}

interface ProjectTitleRow {
  project_id: string
  language_id: string
  title: string | null
}

/** One entry of `manifest.projects`, the shape viewer-core's `projectLabel`/`projectLinks` read. */
export interface ProjectEntry {
  name: Record<string, string>
  site_url: string | null
  related_database_url: string | null
  artistic_introduction_url: string | null
}

/**
 * `manifest.json` — what this package is, and what the website reads before
 * it mounts: the hub's UI languages with their native labels and its name per
 * language, both from the hub's own collection (legacy gallery 45, "Thematic
 * Galleries"), the same reads a gallery package's manifest makes. `projects`
 * names the partner project, which every partner's `project_uuids` points at.
 */
export class ManifestExporter extends BaseExporter {
  getName(): string {
    return 'Manifest'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Writing manifest.json...')

    const langCodeMap = await this.buildLangCodeMap()
    const rows = await this.db.query<HubTranslationRow>(
      // Row order is unspecified; sorted so `site.names`' key order is
      // byte-identical across two exports of one database.
      `SELECT language_id, title FROM collection_translations WHERE collection_id = ?
       ORDER BY language_id`,
      [this.hub.id]
    )

    const names: Record<string, string> = {}
    const languageIds: string[] = []
    for (const row of rows) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      languageIds.push(row.language_id)
      if (row.title) names[code] = row.title
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
        key: this.context.siteKey,
        languages: await this.siteLanguages(languageIds, langCodeMap),
        names,
      },
      kind: 'galleries-hub',
      hub: {
        id: this.hub.id,
        backward_compatibility: this.hub.backwardCompatibility,
      },
      languages: languageIds
        .map(id => langCodeMap.get(id))
        .filter((code): code is string => !!code)
        .sort(),
      projects: await this.buildProjectsSection([this.partnerProjectId]),
    }

    await this.writeJson('manifest.json', manifest)
    this.logger.success(`manifest.json (${manifest.languages.join(', ')})`)

    return { file: 'manifest.json', count: 1 }
  }

  /**
   * The hub's languages as the switcher shows them: the code and the
   * language's own name for itself, the code in capitals where the table has
   * none. Alphabetical by code.
   */
  private async siteLanguages(
    languageIds: string[],
    langCodeMap: Map<string, string>
  ): Promise<{ code: string; label: string }[]> {
    if (languageIds.length === 0) return []
    const rows = await this.db.query<LanguageNameRow>(
      `SELECT language_id, name FROM language_translations
       WHERE language_id IN (${this.placeholders(languageIds.length)}) AND display_language_id = language_id`,
      languageIds
    )
    const labels = new Map(rows.map(row => [row.language_id, row.name]))
    return languageIds
      .filter(id => langCodeMap.has(id))
      .map(id => ({
        code: langCodeMap.get(id) as string,
        label: labels.get(id) || (langCodeMap.get(id) as string).toUpperCase(),
      }))
      .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  }

  /**
   * `manifest.projects` keyed by project UUID. `name` comes from the sibling
   * collection's translations, joined by `backward_compatibility` — `projects`
   * carries no translations — and the URLs straight off `projects`.
   */
  private async buildProjectsSection(projectIds: string[]): Promise<Record<string, ProjectEntry>> {
    const ph = this.placeholders(projectIds.length)
    const langCodeMap = await this.buildLangCodeMap()

    const [projects, titles] = await Promise.all([
      this.db.query<ProjectRow>(
        `SELECT id, site_url, related_database_url, artistic_introduction_url
         FROM projects WHERE id IN (${ph}) ORDER BY id`,
        projectIds
      ),
      this.db.query<ProjectTitleRow>(
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
      const names = namesByProject.get(row.project_id) ?? {}
      names[code] = row.title
      namesByProject.set(row.project_id, names)
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
