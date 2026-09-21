import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

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
 * `languages.json` — the languages this site can actually put on screen.
 *
 * Two different sets meet here. The site ships a fixed set of UI languages
 * (which can include a right-to-left one, so the viewer must be able to
 * render RTL), but an individual record offers whatever languages it happens
 * to have — the sheet's language switcher is built from the record, not the
 * site — and a borrowed item or a partner can add a language the UI roster
 * never listed. Both are needed, and nothing else is: exporting the whole
 * `languages` table would ship a great many rows of names the site can never
 * show.
 */
export class LanguageExporter extends BaseExporter {
  getName(): string {
    return 'Languages'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting languages.json...')

    const used = await this.resolveUsedLanguageIds()
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
      // Display names are only useful for languages we ship, in languages we
      // ship — a Swahili label for Arabic would never be rendered.
      this.db.query<LangTranslationRow>(
        `SELECT language_id, display_language_id, name
         FROM language_translations
         WHERE language_id IN (${usedPh}) AND display_language_id IN (${usedPh})`,
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

    const galleryLanguages = new Set(await this.resolveGalleryLanguageIds())

    const output = langs.map(lang => ({
      id: lang.id,
      code: lang.backward_compatibility,
      is_default: lang.is_default === 1,
      // Whether the gallery itself shipped in this language, as opposed to it
      // merely appearing on some borrowed record.
      site_language: galleryLanguages.has(lang.id),
      names: namesById.get(lang.id) ?? {},
    }))

    await this.writeJson('languages.json', output)
    this.logger.success(
      `languages.json (${output.length} languages, ${output.filter(l => l.site_language).length} site languages)`
    )

    return { file: 'languages.json', count: output.length }
  }

  private async resolveGalleryLanguageIds(): Promise<string[]> {
    const rows = await this.db.query<{ language_id: string }>(
      `SELECT DISTINCT language_id FROM collection_translations WHERE collection_id = ?`,
      [this.exhibition.id]
    )
    return rows.map(row => row.language_id)
  }

  private async resolveUsedLanguageIds(): Promise<string[]> {
    const galleryLanguages = await this.resolveGalleryLanguageIds()
    if (this.memberItemIds.length === 0) return galleryLanguages

    const itemPh = this.placeholders(this.memberItemIds.length)
    const rows = await this.db.query<{ language_id: string }>(
      `SELECT DISTINCT it.language_id
       FROM item_translations it
       WHERE it.item_id IN (${itemPh})

       UNION

       SELECT DISTINCT pt.language_id
       FROM partner_translations pt
       JOIN items i ON i.partner_id = pt.partner_id
       WHERE i.id IN (${itemPh})`,
      [...this.memberItemIds, ...this.memberItemIds]
    )

    return [...new Set([...galleryLanguages, ...rows.map(row => row.language_id)])]
  }
}
