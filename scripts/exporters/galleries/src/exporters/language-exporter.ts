import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'
import { GALLERIES_ROOT_PURPOSE } from './galleries-exporter.js'

interface LangRow {
  id: string
  internal_name: string
  backward_compatibility: string | null
  is_default: number
}

interface LangTranslationRow {
  language_id: string
  display_language_id: string
  name: string
}

/**
 * `languages.json` — the languages this package can put on screen: the hub's
 * own UI languages, and every language a gallery name or a partner text is
 * written in. Exporting the whole `languages` table would ship names the site
 * can never show. The shape is dxa-gallery's; `site_language` marks the hub's
 * own UI languages.
 */
export class LanguageExporter extends BaseExporter {
  getName(): string {
    return 'Languages'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting languages.json...')

    const hubLanguages = await this.hubLanguageIds()
    const used = await this.usedLanguageIds(hubLanguages)
    if (used.length === 0) {
      await this.writeJson('languages.json', [])
      this.logger.warning('languages.json (0 languages in scope)')
      return { file: 'languages.json', count: 0 }
    }

    const usedPh = this.placeholders(used.length)
    const [langs, translations] = await Promise.all([
      this.db.query<LangRow>(
        `SELECT id, internal_name, backward_compatibility, is_default
         FROM languages WHERE id IN (${usedPh}) ORDER BY id`,
        used
      ),
      this.db.query<LangTranslationRow>(
        // Row order is unspecified; sorted so each language's `names` key
        // order is byte-identical across two exports of one database.
        `SELECT language_id, display_language_id, name
         FROM language_translations
         WHERE language_id IN (${usedPh}) AND display_language_id IN (${usedPh})
         ORDER BY language_id, display_language_id`,
        [...used, ...used]
      ),
    ])

    const codeById = new Map<string, string>(
      langs
        .filter(lang => lang.backward_compatibility !== null)
        .map(lang => [lang.id, lang.backward_compatibility as string])
    )

    const namesById = new Map<string, Record<string, string>>()
    for (const row of translations) {
      const displayCode = codeById.get(row.display_language_id)
      if (!displayCode) continue
      const bucket = namesById.get(row.language_id) ?? {}
      bucket[displayCode] = row.name
      namesById.set(row.language_id, bucket)
    }

    const siteLanguages = new Set(hubLanguages)
    const output = langs.map(lang => ({
      id: lang.id,
      code: lang.backward_compatibility,
      is_default: lang.is_default === 1,
      site_language: siteLanguages.has(lang.id),
      names: namesById.get(lang.id) ?? {},
    }))

    await this.writeJson('languages.json', output)
    this.logger.success(
      `languages.json (${output.length} languages, ${output.filter(l => l.site_language).length} site languages)`
    )

    return { file: 'languages.json', count: output.length }
  }

  private async hubLanguageIds(): Promise<string[]> {
    const rows = await this.db.query<{ language_id: string }>(
      `SELECT DISTINCT language_id FROM collection_translations WHERE collection_id = ? ORDER BY language_id`,
      [this.hub.id]
    )
    return rows.map(row => row.language_id)
  }

  private async usedLanguageIds(hubLanguages: string[]): Promise<string[]> {
    const partnerIds = await this.partnerIds()
    const partnerBranch =
      partnerIds.length === 0
        ? ''
        : `UNION
           SELECT DISTINCT language_id FROM partner_translations
           WHERE partner_id IN (${this.placeholders(partnerIds.length)})`

    const rows = await this.db.query<{ language_id: string }>(
      `SELECT DISTINCT ct.language_id
       FROM collection_translations ct
       JOIN collections g ON g.id = ct.collection_id
       JOIN collections root ON root.id = g.parent_id
       WHERE root.purpose = ? AND g.type = 'gallery' AND ct.title IS NOT NULL
       ${partnerBranch}`,
      [GALLERIES_ROOT_PURPOSE, ...partnerIds]
    )

    return [...new Set([...hubLanguages, ...rows.map(row => row.language_id)])].sort()
  }
}
