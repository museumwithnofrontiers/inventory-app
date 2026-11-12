import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface TagRow {
  id: string
  internal_name: string
  category: string | null
  language_id: string | null
  description: string
}

/**
 * tags.json: the subjects, themes and target readers the publications carry
 * (`publication_tag`), as Tag records with their category and language.
 */
export class TagExporter extends BaseExporter {
  getName(): string {
    return 'Tags'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting tags.json...')
    const ids = this.scope.publicationIds
    const langCodeMap = await this.buildLangCodeMap()
    const tags =
      ids.length === 0
        ? []
        : await this.db.query<TagRow>(
            // The collation holds "Wood" and "wood" equal, so the binary order breaks that tie.
            `SELECT DISTINCT t.id, t.internal_name, t.category, t.language_id, t.description
             FROM publication_tag pt
             JOIN tags t ON t.id = pt.tag_id
             WHERE pt.publication_id IN (${this.placeholders(ids.length)})
             ORDER BY t.category, t.description, t.description COLLATE utf8mb4_bin, t.id`,
            ids
          )
    const output = tags.map(t => ({
      id: t.id,
      internal_name: t.internal_name,
      category: t.category,
      language: t.language_id ? (langCodeMap.get(t.language_id) ?? null) : null,
      description: t.description,
    }))
    await this.writeJson('tags.json', output)
    this.logger.success(`tags.json (${output.length} tags)`)
    return { file: 'tags.json', count: output.length }
  }
}
