import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'
import { GLOBAL_TIMELINE_LIKE_PATTERNS } from './timeline-exporter.js'

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

/**
 * `countries.json` — scoped to the gallery, not the whole world.
 *
 * THREE sets of countries need names on a gallery site, and the file is wrong
 * if any one of them is left out:
 *
 *  1. the member items' own countries — the collection-search dropdown
 *     (legacy `/items/countries`);
 *  2. their holding museums' countries — the partners page groups by these, and
 *     they are not always the item's;
 *  3. the countries of the global timeline — the timeline page's country picker
 *     (legacy `/events/countries`), which is project-independent and therefore
 *     names countries no member item comes from.
 *
 * Omitting (3), as an earlier fork of this exporter did, makes the viewer fall
 * back to `Intl.DisplayNames` for every timeline-only country — the global
 * timeline routinely names countries that hold no member item and no member's
 * holding museum, since it is project-independent.
 *
 * Nothing else belongs here — the full table is 180-odd rows the site can never
 * show.
 */
export class CountryExporter extends BaseExporter {
  getName(): string {
    return 'Countries'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting countries.json...')

    const timelineBranch = `SELECT DISTINCT t.country_id
       FROM timelines t
       WHERE t.country_id IS NOT NULL
         AND (${GLOBAL_TIMELINE_LIKE_PATTERNS.map(() => 't.backward_compatibility LIKE ?').join(' OR ')})`

    let used: { country_id: string }[]

    if (this.memberItemIds.length === 0) {
      // A gallery with no members still shows the worldwide timeline, so the
      // country names it needs are not conditional on membership.
      this.logger.warning('countries.json: gallery has no member items — timeline countries only')
      used = await this.db.query<{ country_id: string }>(timelineBranch, [
        ...GLOBAL_TIMELINE_LIKE_PATTERNS,
      ])
    } else {
      const itemPh = this.placeholders(this.memberItemIds.length)
      used = await this.db.query<{ country_id: string }>(
        `SELECT DISTINCT i.country_id
         FROM items i
         WHERE i.id IN (${itemPh}) AND i.country_id IS NOT NULL

         UNION

         SELECT DISTINCT p.country_id
         FROM partners p
         JOIN items i ON i.partner_id = p.id
         WHERE i.id IN (${itemPh}) AND p.country_id IS NOT NULL

         UNION

         ${timelineBranch}`,
        [...this.memberItemIds, ...this.memberItemIds, ...GLOBAL_TIMELINE_LIKE_PATTERNS]
      )
    }

    const countryIds = used.map(row => row.country_id)
    if (countryIds.length === 0) {
      await this.writeJson('countries.json', [])
      this.logger.warning('countries.json (0 countries referenced)')
      return { file: 'countries.json', count: 0 }
    }

    const countryPh = this.placeholders(countryIds.length)
    const [countries, translations] = await Promise.all([
      this.db.query<CountryRow>(
        `SELECT id, internal_name, backward_compatibility
         FROM countries WHERE id IN (${countryPh}) ORDER BY id`,
        countryIds
      ),
      this.db.query<CountryTranslationRow>(
        `SELECT country_id, language_id, name
         FROM country_translations WHERE country_id IN (${countryPh})`,
        countryIds
      ),
    ])

    const langCodeMap = await this.buildLangCodeMap()

    const byLang = new Map<string, Record<string, unknown>>()
    for (const row of translations) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      const bucket = byLang.get(code) ?? {}
      bucket[row.country_id] = { name: row.name }
      byLang.set(code, bucket)
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
