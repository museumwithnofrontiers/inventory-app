import { trailLinks } from '../../../shared/links.mjs'
import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

/**
 * trails.json: the exhibition trails the publications accompany, each with
 * its title and subtitle per language, its page on the Travels site, and its
 * entries (the ids of their references in references.json).
 */
export class TrailExporter extends BaseExporter {
  getName(): string {
    return 'Trails'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting trails.json...')
    const links = await trailLinks((sql, params) => this.db.query(sql, params), this.scope.trailIds, this.sites)
    const output = links.map(link => ({
      ...link,
      entry_ids: this.scope.entriesByTrail.get(link.id) ?? [],
    }))
    await this.writeJson('trails.json', output)
    this.logger.success(`trails.json (${output.length} trails)`)
    return { file: 'trails.json', count: output.length }
  }
}
