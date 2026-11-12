import type { ExportResult, PublicationDocument, PublicationImage } from '../core/types.js'
import { BaseExporter, parseJson } from './base-exporter.js'

interface PublicationRow {
  id: string
  internal_name: string
  backward_compatibility: string | null
  category: string
  project_id: string | null
  project_context_id: string | null
  country_id: string | null
  language_id: string
  status: string
  display_order: number | null
  extra: unknown
}

interface TranslationRow {
  publication_id: string
  language_id: string
  context_id: string
  title: string
  subtitle: string | null
  description: string | null
  introduction: string | null
  author_credit: string | null
  photography_credit: string | null
  coordination_credit: string | null
}

export interface ImageRow {
  publication_id: string
  publication_edition_id: string | null
  kind: string
  path: string
  alt_text: string | null
  display_order: number
  extra: unknown
}

export interface DocumentRow {
  id: string
  publication_id: string
  publication_edition_id: string | null
  language_id: string | null
  kind: string
  path: string
}

// The name /doc serves: a publication document's UUID and `.pdf`.
const DOCUMENT_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i

/** Whether `/doc` can serve a stored document name; a path not yet synced cannot. */
export function isServableDocument(path: string): boolean {
  return DOCUMENT_NAME.test(path)
}

/**
 * The translation of one publication in one language: its project's context
 * when it has one there, else the first row (the rows sorted by context).
 */
export function pickTranslation<T extends { context_id: string }>(rows: T[], ownContextId: string | null): T | undefined {
  return (ownContextId ? rows.find(r => r.context_id === ownContextId) : undefined) ?? rows[0]
}

/**
 * The publication's cover: the cover of a visible edition in its main
 * language, else the first cover of a visible edition, else the first cover
 * with no edition. Covers come sorted by display order.
 */
export function pickCover(
  covers: PublicationImage[],
  editionLanguage: ReadonlyMap<string, string>,
  mainLanguage: string
): PublicationImage | null {
  const ofVisible = covers.filter(c => c.edition_id !== null && editionLanguage.has(c.edition_id))
  return (
    ofVisible.find(c => editionLanguage.get(c.edition_id!) === mainLanguage) ??
    ofVisible[0] ??
    covers.find(c => c.edition_id === null) ??
    null
  )
}

/**
 * publications.json and translations/publications.<lang>.json: each work
 * with its category, project, country, main language and status, its cover
 * and sample pages as `/pub` renditions, its PDFs at their `/doc` URL, and
 * the ids of its editions, tags, trails and catalogue items. Its texts per
 * language go to the translations: title, subtitle, description,
 * introduction and the three credit lines as printed.
 *
 * Only the editions legacy shows ship (`visible`): a hidden edition's cover,
 * pages and PDFs stay out with it.
 */
export class PublicationExporter extends BaseExporter {
  getName(): string {
    return 'Publications'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting publications.json...')
    const ids = this.scope.publicationIds
    if (ids.length === 0) {
      await this.writeJson('publications.json', [])
      this.logger.warning('publications.json (0 publications)')
      return { file: 'publications.json', count: 0 }
    }
    const ph = this.placeholders(ids.length)
    const langCodeMap = await this.buildLangCodeMap()

    const [publications, translations, editions, images, documents, tags] = await Promise.all([
      this.db.query<PublicationRow>(
        `SELECT p.id, p.internal_name, p.backward_compatibility, p.category, p.project_id,
                pr.context_id AS project_context_id, p.country_id, p.language_id, p.status,
                p.display_order, p.extra
         FROM publications p
         LEFT JOIN projects pr ON pr.id = p.project_id
         WHERE p.id IN (${ph})`,
        ids
      ),
      this.db.query<TranslationRow>(
        // Row order is unspecified; sorted so two exports of one database are byte-identical.
        `SELECT publication_id, language_id, context_id, title, subtitle, description, introduction,
                author_credit, photography_credit, coordination_credit
         FROM publication_translations
         WHERE publication_id IN (${ph})
         ORDER BY publication_id, language_id, context_id`,
        ids
      ),
      this.db.query<{ id: string; publication_id: string; language_id: string }>(
        `SELECT id, publication_id, language_id FROM publication_editions
         WHERE publication_id IN (${ph}) AND visible = 1
         ORDER BY publication_id, display_order IS NULL, display_order, id`,
        ids
      ),
      this.db.query<ImageRow>(
        `SELECT publication_id, publication_edition_id, kind, path, alt_text, display_order, extra
         FROM publication_images
         WHERE publication_id IN (${ph})
         ORDER BY publication_id, kind, display_order, path`,
        ids
      ),
      this.db.query<DocumentRow>(
        `SELECT id, publication_id, publication_edition_id, language_id, kind, path
         FROM publication_documents
         WHERE publication_id IN (${ph})
         ORDER BY publication_id, display_order, kind, id`,
        ids
      ),
      this.db.query<{ publication_id: string; tag_id: string }>(
        `SELECT publication_id, tag_id FROM publication_tag
         WHERE publication_id IN (${ph})
         ORDER BY publication_id, tag_id`,
        ids
      ),
    ])

    const editionLanguage = new Map(editions.map(e => [e.id, e.language_id]))
    const hiddenEdition = (editionId: string | null) => editionId !== null && !editionLanguage.has(editionId)

    // Texts: one entry per publication and language.
    const ownContext = new Map(publications.map(p => [p.id, p.project_context_id]))
    const rowsByKey = new Map<string, TranslationRow[]>()
    for (const t of translations) {
      const key = `${t.publication_id}\u0000${t.language_id}`
      rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), t])
    }
    const byLang = new Map<string, Record<string, unknown>>()
    const languagesOf = new Map<string, string[]>()
    for (const rows of rowsByKey.values()) {
      const first = rows[0]!
      const code = langCodeMap.get(first.language_id)
      if (!code) continue
      const t = pickTranslation(rows, ownContext.get(first.publication_id) ?? null)!
      if (!byLang.has(code)) byLang.set(code, {})
      byLang.get(code)![t.publication_id] = this.stripNulls({
        title: t.title,
        subtitle: t.subtitle,
        description: t.description,
        introduction: t.introduction,
        author_credit: t.author_credit,
        photography_credit: t.photography_credit,
        coordination_credit: t.coordination_credit,
      })
      languagesOf.set(t.publication_id, [...(languagesOf.get(t.publication_id) ?? []), code])
    }
    await this.writeTranslationFiles('publications', byLang)

    const imagesOf = (publicationId: string, kind: string): PublicationImage[] =>
      images
        .filter(i => i.publication_id === publicationId && i.kind === kind && !hiddenEdition(i.publication_edition_id))
        .map(i => toImage(i, url => this.imageUrl(url)))

    let skippedDocuments = 0
    const documentsOf = (publicationId: string): PublicationDocument[] =>
      documents
        .filter(d => d.publication_id === publicationId && d.publication_edition_id === null)
        .filter(d => {
          if (isServableDocument(d.path)) return true
          skippedDocuments++
          return false
        })
        .map(d => toDocument(d, langCodeMap, path => this.documentUrl(path)))

    const byId = new Map(publications.map(p => [p.id, p]))
    const output = ids
      .map(id => byId.get(id))
      .filter((p): p is PublicationRow => p !== undefined)
      .map(p => {
        const covers = imagesOf(p.id, 'cover')
        return {
          id: p.id,
          backward_compatibility: p.backward_compatibility,
          internal_name: p.internal_name,
          category: p.category,
          project_id: p.project_id,
          country_id: p.country_id,
          language: langCodeMap.get(p.language_id) ?? null,
          status: p.status,
          display_order: p.display_order,
          extra: parseJson(p.extra),
          cover: pickCover(covers, editionLanguage, p.language_id),
          pages: imagesOf(p.id, 'page'),
          documents: documentsOf(p.id),
          edition_ids: editions.filter(e => e.publication_id === p.id).map(e => e.id),
          tag_ids: tags.filter(t => t.publication_id === p.id).map(t => t.tag_id),
          trail_ids: this.scope.trailsByPublication.get(p.id) ?? [],
          catalogue_item_ids: this.scope.catalogueByPublication.get(p.id) ?? [],
          languages: (languagesOf.get(p.id) ?? []).sort(),
        }
      })
    if (skippedDocuments > 0) {
      this.logger.warning(`${skippedDocuments} publication documents not yet stored under their /doc name: left out`)
    }

    await this.writeJson('publications.json', output)
    this.logger.success(`publications.json (${output.length} publications)`)
    return { file: 'publications.json', count: output.length }
  }
}

export function toImage(row: ImageRow, imageUrl: (path: string) => string): PublicationImage {
  const extra = parseJson(row.extra) as Record<string, unknown> | null
  const photographer = extra?.['photographer']
  return {
    url: imageUrl(row.path),
    alt_text: row.alt_text,
    photographer: typeof photographer === 'string' && photographer.trim() !== '' ? photographer : null,
    display_order: row.display_order,
    edition_id: row.publication_edition_id,
  }
}

export function toDocument(
  row: DocumentRow,
  langCodeMap: ReadonlyMap<string, string>,
  documentUrl: (path: string) => string
): PublicationDocument {
  return {
    id: row.id,
    kind: row.kind,
    url: documentUrl(row.path),
    language: row.language_id ? (langCodeMap.get(row.language_id) ?? null) : null,
  }
}
