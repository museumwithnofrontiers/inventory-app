import { resolveReferences } from '../../../shared/references.mjs'
import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

/**
 * references.json: the exhibition trails' entries, Islamic Art's objects and
 * monuments, as references only — id, type, legacy key, name per language,
 * first picture and the sites that show the item (`shared/sites.mjs`), its
 * home site first. No item sheet is copied: a website links each reference
 * to one of its sites.
 */
export class ReferenceExporter extends BaseExporter {
  getName(): string {
    return 'References'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting references.json...')
    const references = await resolveReferences(
      (sql, params) => this.db.query(sql, params),
      this.scope.entryIds,
      { baseUrl: this.baseUrl, sites: this.sites }
    )
    const unlisted = references.filter(r => r.sites.length === 0).length
    if (unlisted > 0) this.logger.warning(`${unlisted} references are shown by no site`)
    await this.writeJson('references.json', references)
    this.logger.success(`references.json (${references.length} references)`)
    return { file: 'references.json', count: references.length }
  }
}
