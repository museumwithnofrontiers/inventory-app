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

export class LanguageExporter extends BaseExporter {
  getName(): string {
    return 'Languages'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting languages.json...')

    const langs = await this.db.query<LangRow>(
      `SELECT id, internal_name, backward_compatibility, is_default
       FROM languages
       ORDER BY id`
    )

    // Row order is unspecified; sorted so each language's `names` key order is
    // byte-identical across two exports of one database.
    const translations = await this.db.query<LangTranslationRow>(
      `SELECT language_id, display_language_id, name FROM language_translations
       ORDER BY language_id, display_language_id`
    )

    // id -> backward_compatibility (2-char code, e.g. 'en')
    const idToCode = new Map<string, string>(
      langs
        .filter(l => l.backward_compatibility !== null)
        .map(l => [l.id, l.backward_compatibility as string])
    )

    // language_id -> display_language_id (2-char code) -> name
    const translationMap = new Map<string, Map<string, string>>()
    for (const t of translations) {
      if (!translationMap.has(t.language_id)) {
        translationMap.set(t.language_id, new Map())
      }
      const displayCode = idToCode.get(t.display_language_id)
      if (displayCode) {
        translationMap.get(t.language_id)!.set(displayCode, t.name)
      }
    }

    const output = langs.map(lang => {
      const rawNames = translationMap.get(lang.id) ?? new Map<string, string>()
      const names: Record<string, string> = {}
      for (const [code, name] of rawNames) {
        names[code] = name
      }
      return {
        id: lang.id,
        code: lang.backward_compatibility,
        is_default: lang.is_default === 1,
        names,
      }
    })

    await this.writeJson('languages.json', output)
    this.logger.success(`languages.json (${output.length} languages)`)

    return { file: 'languages.json', count: output.length }
  }
}
