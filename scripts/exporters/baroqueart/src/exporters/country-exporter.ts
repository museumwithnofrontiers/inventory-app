import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface CountryRow {
  id: string
  internal_name: string
  backward_compatibility: string
}

interface CountryTranslationRow {
  country_id: string
  language_id: string
  name: string
}

export class CountryExporter extends BaseExporter {
  getName(): string {
    return 'Countries'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting countries.json...')

    const countries = await this.db.query<CountryRow>(
      `SELECT id, internal_name, backward_compatibility FROM countries ORDER BY id`
    )
    // Row order is unspecified; sorted so two exports of one database are byte-identical.
    const translations = await this.db.query<CountryTranslationRow>(
      `SELECT country_id, language_id, name FROM country_translations ORDER BY country_id`
    )

    // language id -> 2-char code
    const langCodeMap = await this.buildLangCodeMap()

    // Build: country_id -> lang_code -> name
    const translationMap = new Map<string, Record<string, string>>()
    for (const t of translations) {
      if (!translationMap.has(t.country_id)) {
        translationMap.set(t.country_id, {})
      }
      const code = langCodeMap.get(t.language_id)
      if (code) {
        translationMap.get(t.country_id)![code] = t.name
      }
    }

    // Write one translations/countries.{lang}.json per language
    const byLang = new Map<string, Record<string, unknown>>()
    for (const [countryId, langMap] of translationMap) {
      for (const [langCode, name] of Object.entries(langMap)) {
        if (!byLang.has(langCode)) byLang.set(langCode, {})
        byLang.get(langCode)![countryId] = { name }
      }
    }
    await this.writeTranslationFiles('countries', byLang)

    const output = countries.map(country => ({
      id: country.id,
      code: country.backward_compatibility,
      internal_name: country.internal_name,
    }))

    await this.writeJson('countries.json', output)
    this.logger.success(`countries.json (${output.length} countries)`)

    return { file: 'countries.json', count: output.length }
  }
}
