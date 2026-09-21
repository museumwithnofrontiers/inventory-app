import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface TagRow {
  id: string
  internal_name: string
  category: string
  description: string | null
  backward_compatibility: string
}

/**
 * The five THG tag families that drive the collection-search facets. Legacy
 * infers the facet from the tag id prefix (`material_1a59` → material); the
 * package keeps the category as data so the viewer never parses ids.
 */
const FACET_CATEGORIES = ['artist', 'dynasty', 'material', 'subject', 'type']

/**
 * `tags.json` — the gallery's facet vocabulary.
 *
 * Only THG tags belong here. The same `item_tag` pivot also carries the mwnf3
 * `keyword` and `material` tags parsed out of the object records, which are
 * per-language free text shown on the item sheet, NOT facets — mixing them in
 * would bury the 103 real Material facets of this gallery under thousands of
 * free-text lines. Those ship as `keywords`/`materials` in the item
 * translations instead.
 *
 * THG tags are English-only (accepted gap G5): legacy renders the same English
 * label in every UI language.
 */
export class TagExporter extends BaseExporter {
  getName(): string {
    return 'Tags'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting tags.json...')

    if (this.memberItemIds.length === 0) {
      await this.writeJson('tags.json', [])
      this.logger.warning('tags.json (0 — gallery has no member items)')
      return { file: 'tags.json', count: 0 }
    }

    const itemPh = this.placeholders(this.memberItemIds.length)
    const categoryPh = this.placeholders(FACET_CATEGORIES.length)

    const tags = await this.db.query<TagRow>(
      `SELECT DISTINCT t.id, t.internal_name, t.category, t.description,
              t.backward_compatibility
       FROM item_tag it
       JOIN tags t ON t.id = it.tag_id
       WHERE it.item_id IN (${itemPh})
         AND t.category IN (${categoryPh})
         AND t.backward_compatibility LIKE '%thg:tags:%'
       ORDER BY t.category, t.description`,
      [...this.memberItemIds, ...FACET_CATEGORIES]
    )

    const output = tags.map(tag => ({
      id: tag.id,
      backward_compatibility: tag.backward_compatibility,
      // The legacy tag id (`material_1a59`) — the value the legacy search URLs
      // carry, so the viewer can keep deep links working.
      legacy_tag_id: legacyTagId(tag.backward_compatibility) ?? tag.internal_name,
      category: tag.category,
      label: tag.description ?? tag.internal_name,
    }))

    await this.writeJson('tags.json', output)

    const perCategory = FACET_CATEGORIES.map(
      category => `${category} ${output.filter(t => t.category === category).length}`
    ).join(', ')
    this.logger.success(`tags.json (${output.length} tags — ${perCategory})`)

    return { file: 'tags.json', count: output.length }
  }
}

/**
 * The THG tag id out of a tag's backward_compatibility.
 *
 * A THG tag that matched an existing mwnf3 tag was deduplicated by the importer
 * (ThgTagImporter), which appends the THG key to the existing one:
 * `mwnf3:tags:material:eng:carnelian;thg:tags:material_1ce4`. So the THG segment
 * has to be searched for, not assumed to be the whole value.
 */
export function legacyTagId(backwardCompatibility: string): string | null {
  for (const candidate of backwardCompatibility.split(';')) {
    const trimmed = candidate.trim()
    if (trimmed.startsWith('thg:tags:')) {
      return trimmed.slice('thg:tags:'.length)
    }
  }
  return null
}
