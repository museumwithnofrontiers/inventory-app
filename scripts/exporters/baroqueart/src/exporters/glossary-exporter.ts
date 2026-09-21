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

export class GlossaryExporter extends BaseExporter {
  getName(): string {
    return 'Glossary'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting glossary.json...')

    // `glossaries` has no project/context column — it's a single table shared across every
    // imported project's legacy glossary variants. Scope to entries actually referenced (via
    // a spelling) from this project's items, collection text, or timeline event text; without
    // this every project's export would ship every other project's glossary too.
    const ph = this.placeholders(this.projectIds.length)
    const usedIds = await this.db.query<{ id: string }>(
      `SELECT DISTINCT gs.glossary_id AS id
       FROM glossary_spellings gs
       JOIN item_translation_spelling its ON its.spelling_id = gs.id
       JOIN item_translations it ON it.id = its.item_translation_id
       JOIN items i ON i.id = it.item_id
       WHERE i.project_id IN (${ph})
         AND i.type IN ('object', 'monument', 'detail')
         -- 'detail' stays here on purpose: detail texts remain published
         -- (embedded on the parent monument, #1515), so glossary terms they
         -- use must stay in the package.

       UNION

       SELECT DISTINCT gs.glossary_id AS id
       FROM glossary_spellings gs
       JOIN collection_translation_spelling cts ON cts.spelling_id = gs.id
       JOIN collection_translations ct ON ct.id = cts.collection_translation_id
       JOIN collections c ON c.id = ct.collection_id
       WHERE c.context_id IN (SELECT p.context_id FROM projects p WHERE p.id IN (${ph}))

       UNION

       SELECT DISTINCT gs.glossary_id AS id
       FROM glossary_spellings gs
       JOIN timeline_event_translation_spelling tets ON tets.spelling_id = gs.id
       JOIN timeline_event_translations tet ON tet.id = tets.timeline_event_translation_id
       JOIN timeline_events te ON te.id = tet.timeline_event_id
       JOIN timelines t ON t.id = te.timeline_id
       WHERE t.collection_id IN (
         SELECT c.id FROM collections c
         WHERE c.context_id IN (SELECT p.context_id FROM projects p WHERE p.id IN (${ph}))
       )`,
      [...this.projectIds, ...this.projectIds, ...this.projectIds]
    )

    if (usedIds.length === 0) {
      await this.writeJson('glossary.json', [])
      this.logger.warning('glossary.json (0 entries used by this project)')
      return { file: 'glossary.json', count: 0 }
    }

    const usedPh = this.placeholders(usedIds.length)
    const entries = await this.db.query<GlossaryRow>(
      `SELECT id, internal_name, backward_compatibility FROM glossaries
       WHERE id IN (${usedPh})
       ORDER BY internal_name`,
      usedIds.map(r => r.id)
    )

    if (entries.length === 0) {
      await this.writeJson('glossary.json', [])
      this.logger.warning('glossary.json (0 entries)')
      return { file: 'glossary.json', count: 0 }
    }

    const glossaryIds = entries.map(e => e.id)
    const glossPh = this.placeholders(glossaryIds.length)

    const [translations, spellings] = await Promise.all([
      this.db.query<GlossaryTranslationRow>(
        `SELECT glossary_id, language_id, definition FROM glossary_translations WHERE glossary_id IN (${glossPh})`,
        glossaryIds
      ),
      this.db.query<GlossarySpellingRow>(
        // Row order is unspecified; sorted so two exports of one database are byte-identical.
        `SELECT glossary_id, language_id, spelling FROM glossary_spellings WHERE glossary_id IN (${glossPh})
         ORDER BY glossary_id, language_id, spelling`,
        glossaryIds
      ),
    ])

    const langCodeMap = await this.buildLangCodeMap()

    // Build: glossary_id -> lang_code -> definition
    const definitionMap = new Map<string, Record<string, string>>()
    for (const t of translations) {
      if (!definitionMap.has(t.glossary_id)) {
        definitionMap.set(t.glossary_id, {})
      }
      const code = langCodeMap.get(t.language_id)
      if (code) {
        definitionMap.get(t.glossary_id)![code] = t.definition
      }
    }

    // Build: glossary_id -> lang_code -> spellings[]
    const spellingMap = new Map<string, Record<string, string[]>>()
    for (const s of spellings) {
      if (!spellingMap.has(s.glossary_id)) {
        spellingMap.set(s.glossary_id, {})
      }
      const code = langCodeMap.get(s.language_id)
      if (code) {
        const map = spellingMap.get(s.glossary_id)!
        if (!map[code]) {
          map[code] = []
        }
        map[code].push(s.spelling)
      }
    }

    // Collect all language codes that appear in either map
    const allLangs = new Set<string>()
    for (const m of definitionMap.values()) Object.keys(m).forEach(k => allLangs.add(k))
    for (const m of spellingMap.values()) Object.keys(m).forEach(k => allLangs.add(k))

    // Write one translations/glossary.{lang}.json per language
    const byLang = new Map<string, Record<string, unknown>>()
    for (const entry of entries) {
      const defs = definitionMap.get(entry.id) ?? {}
      const spells = spellingMap.get(entry.id) ?? {}
      for (const lang of allLangs) {
        if (!byLang.has(lang)) byLang.set(lang, {})
        const obj: Record<string, unknown> = {}
        if (defs[lang] !== undefined) obj['definition'] = defs[lang]
        if (spells[lang] !== undefined) obj['spellings'] = spells[lang]
        if (Object.keys(obj).length > 0) byLang.get(lang)![entry.id] = obj
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
