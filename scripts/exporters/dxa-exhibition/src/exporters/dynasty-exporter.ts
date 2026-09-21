import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface DynastyRow {
  id: string
  backward_compatibility: string | null
  from_ah: number | null
  to_ah: number | null
  from_ad: number | null
  to_ad: number | null
}

interface DynastyTranslationRow {
  dynasty_id: string
  language_id: string
  name: string | null
  also_known_as: string | null
  area: string | null
  history: string | null
  date_description_ah: string | null
  date_description_ad: string | null
}

interface DynastyImageRow {
  dynasty_id: string
  path: string
}

/**
 * `dynasties.json` — the dynasty panel on the item sheet.
 *
 * Scoped to dynasties the exhibition's own items reference. This differs from the
 * islamicart exporter, which ships the whole table because the Discover Islamic
 * Art site has a dynasty browser listing every defined dynasty; a DXA gallery or exhibition
 * has no such page — it shows a dynasty only as part of an item record, and its
 * dynasty facet is driven by THG tags, not by this table.
 */
export class DynastyExporter extends BaseExporter {
  getName(): string {
    return 'Dynasties'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting dynasties.json...')

    if (this.memberItemIds.length === 0) {
      await this.writeJson('dynasties.json', [])
      this.logger.warning('dynasties.json (0 — exhibition has no member items)')
      return { file: 'dynasties.json', count: 0 }
    }

    const itemPh = this.placeholders(this.memberItemIds.length)
    const dynasties = await this.db.query<DynastyRow>(
      `SELECT DISTINCT d.id, d.backward_compatibility, d.from_ah, d.to_ah, d.from_ad, d.to_ad
       FROM dynasties d
       JOIN item_dynasty idyn ON idyn.dynasty_id = d.id
       WHERE idyn.item_id IN (${itemPh})
       ORDER BY d.from_ad`,
      this.memberItemIds
    )

    if (dynasties.length === 0) {
      await this.writeJson('dynasties.json', [])
      this.logger.warning('dynasties.json (0 — no member item references a dynasty)')
      return { file: 'dynasties.json', count: 0 }
    }

    const dynastyIds = dynasties.map(d => d.id)
    const dynastyPh = this.placeholders(dynastyIds.length)
    const langCodeMap = await this.buildLangCodeMap()

    const [translations, images] = await Promise.all([
      this.db.query<DynastyTranslationRow>(
        `SELECT dynasty_id, language_id, name, also_known_as, area, history,
                date_description_ah, date_description_ad
         FROM dynasty_translations
         WHERE dynasty_id IN (${dynastyPh})`,
        dynastyIds
      ),
      // A representative image: the first picture (by display order) of any
      // member item linked to the dynasty, so the thumbnail always comes from
      // content this exhibition actually shows.
      this.db.query<DynastyImageRow>(
        `SELECT idyn.dynasty_id, ii.path
         FROM item_dynasty idyn
         JOIN items pic ON pic.parent_id = idyn.item_id AND pic.type = 'picture'
         JOIN item_images ii ON ii.item_id = pic.id
         WHERE idyn.dynasty_id IN (${dynastyPh})
           AND idyn.item_id IN (${itemPh})
         ORDER BY idyn.dynasty_id, pic.display_order`,
        [...dynastyIds, ...this.memberItemIds]
      ),
    ])

    const byLang = new Map<string, Record<string, unknown>>()
    for (const row of translations) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      const bucket = byLang.get(code) ?? {}
      bucket[row.dynasty_id] = this.stripNulls({
        name: row.name,
        also_known_as: row.also_known_as,
        area: row.area,
        history: row.history,
        date_description_ah: row.date_description_ah,
        date_description_ad: row.date_description_ad,
      })
      byLang.set(code, bucket)
    }
    await this.writeTranslationFiles('dynasties', byLang)

    const imageMap = new Map<string, string>()
    for (const row of images) {
      if (!imageMap.has(row.dynasty_id)) imageMap.set(row.dynasty_id, this.imageUrl(row.path))
    }

    const output = dynasties.map(dynasty => ({
      id: dynasty.id,
      backward_compatibility: dynasty.backward_compatibility,
      from_ah: dynasty.from_ah,
      to_ah: dynasty.to_ah,
      from_ad: dynasty.from_ad,
      to_ad: dynasty.to_ad,
      image: imageMap.get(dynasty.id) ?? null,
    }))

    await this.writeJson('dynasties.json', output)
    this.logger.success(`dynasties.json (${output.length} dynasties)`)

    return { file: 'dynasties.json', count: output.length }
  }
}
