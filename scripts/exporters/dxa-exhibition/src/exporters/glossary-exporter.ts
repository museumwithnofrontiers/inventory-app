import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface GlossaryRow {
  id: string
  internal_name: string
  backward_compatibility: string | null
}

interface GlossaryTranslationRow {
  glossary_id: string
  language_id: string
  definition: string
}

interface GlossarySpellingRow {
  glossary_id: string
  language_id: string
  spelling: string
}

/**
 * `glossary.json` — the terms the item sheet links inside its descriptions.
 *
 * `glossaries` has no project or context column; it is one table shared by every
 * imported project. Scoping to terms actually reached from the site's own
 * items is what keeps a one-site package from shipping the whole
 * cross-project glossary.
 *
 * Per-language spelling lists are required, not decorative: the client
 * regex-matches every spelling inside the description text to place the links.
 */
export class GlossaryExporter extends BaseExporter {
  getName(): string {
    return 'Glossary'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting glossary.json...')

    if (this.memberItemIds.length === 0) {
      await this.writeJson('glossary.json', [])
      this.logger.warning('glossary.json (0 — exhibition has no member items)')
      return { file: 'glossary.json', count: 0 }
    }

    const itemPh = this.placeholders(this.memberItemIds.length)
    const used = await this.db.query<{ id: string }>(
      `SELECT DISTINCT gs.glossary_id AS id
       FROM glossary_spellings gs
       JOIN item_translation_spelling its ON its.spelling_id = gs.id
       JOIN item_translations it ON it.id = its.item_translation_id
       WHERE it.item_id IN (${itemPh})`,
      this.memberItemIds
    )

    if (used.length === 0) {
      await this.writeJson('glossary.json', [])
      this.logger.warning('glossary.json (0 entries used by this gallery)')
      return { file: 'glossary.json', count: 0 }
    }

    const glossaryIds = used.map(row => row.id)
    const glossaryPh = this.placeholders(glossaryIds.length)

    const [entries, translations, spellings] = await Promise.all([
      this.db.query<GlossaryRow>(
        `SELECT id, internal_name, backward_compatibility
         FROM glossaries WHERE id IN (${glossaryPh}) ORDER BY internal_name`,
        glossaryIds
      ),
      this.db.query<GlossaryTranslationRow>(
        `SELECT glossary_id, language_id, definition
         FROM glossary_translations WHERE glossary_id IN (${glossaryPh})`,
        glossaryIds
      ),
      this.db.query<GlossarySpellingRow>(
        `SELECT glossary_id, language_id, spelling
         FROM glossary_spellings WHERE glossary_id IN (${glossaryPh})`,
        glossaryIds
      ),
    ])

    const langCodeMap = await this.buildLangCodeMap()

    const definitions = new Map<string, Record<string, string>>()
    for (const row of translations) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      const bucket = definitions.get(row.glossary_id) ?? {}
      bucket[code] = row.definition
      definitions.set(row.glossary_id, bucket)
    }

    const spellingsByGlossary = new Map<string, Record<string, string[]>>()
    for (const row of spellings) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      const bucket = spellingsByGlossary.get(row.glossary_id) ?? {}
      ;(bucket[code] ??= []).push(row.spelling)
      spellingsByGlossary.set(row.glossary_id, bucket)
    }

    const allLanguages = new Set<string>()
    for (const map of definitions.values()) Object.keys(map).forEach(k => allLanguages.add(k))
    for (const map of spellingsByGlossary.values()) Object.keys(map).forEach(k => allLanguages.add(k))

    const byLang = new Map<string, Record<string, unknown>>()
    for (const entry of entries) {
      const entryDefinitions = definitions.get(entry.id) ?? {}
      const entrySpellings = spellingsByGlossary.get(entry.id) ?? {}
      for (const language of allLanguages) {
        const fields: Record<string, unknown> = {}
        if (entryDefinitions[language] !== undefined) fields['definition'] = entryDefinitions[language]
        if (entrySpellings[language] !== undefined) fields['spellings'] = entrySpellings[language]
        if (Object.keys(fields).length === 0) continue
        const bucket = byLang.get(language) ?? {}
        bucket[entry.id] = fields
        byLang.set(language, bucket)
      }
    }
    await this.writeTranslationFiles('glossary', byLang)

    const output = entries.map(entry => ({
      id: entry.id,
      word: entry.internal_name,
    }))

    await this.writeJson('glossary.json', output)
    this.logger.success(`glossary.json (${output.length} entries)`)

    return { file: 'glossary.json', count: output.length }
  }
}
