import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveScope } from '../../src/core/scope.js'
import { EditionExporter } from '../../src/exporters/edition-exporter.js'
import { ManifestExporter } from '../../src/exporters/manifest-exporter.js'
import { PublicationExporter, isServableDocument, pickCover } from '../../src/exporters/publication-exporter.js'
import { TrailExporter } from '../../src/exporters/trail-exporter.js'
import { contextWith, fakeDb, scopeWith } from './support.js'

const DOC = '0c6f5a52-8a4b-4d61-9d7e-111111111111.pdf'

describe('the Publications exporters', () => {
  let outputDir: string
  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'publications-'))
  })
  afterEach(() => rmSync(outputDir, { recursive: true, force: true }))
  const read = (file: string) => JSON.parse(readFileSync(join(outputDir, file), 'utf-8'))

  const languages: [string, unknown[]] = [
    'FROM languages',
    [
      { id: 'eng', backward_compatibility: 'en' },
      { id: 'fra', backward_compatibility: 'fr' },
    ],
  ]

  it('resolves the scope: trails, catalogue items and trail entries', async () => {
    const db = fakeDb([
      ['FROM publications', [{ id: 'p1', project_id: 'iam' }, { id: 'p2', project_id: null }]],
      ['FROM publication_collection', [{ key: 'p1', value: 't1' }]],
      ['FROM publication_item', [{ key: 'p1', value: 'm9' }]],
      ['FROM collection_item', [{ key: 't1', value: 'o2' }, { key: 't1', value: 'o1' }]],
    ])
    const scope = await resolveScope(db)
    expect(scope.publicationIds).toEqual(['p1', 'p2'])
    expect(scope.projectIds).toEqual(['iam'])
    expect(scope.trailsByPublication.get('p1')).toEqual(['t1'])
    expect(scope.catalogueByPublication.get('p1')).toEqual(['m9'])
    expect(scope.entriesByTrail.get('t1')).toEqual(['o2', 'o1'])
    expect(scope.referenceIds).toEqual(['m9', 'o1', 'o2'])
  })

  it('writes each publication with its cover, pages, PDFs and texts, and leaves hidden editions out', async () => {
    const db = fakeDb([
      languages,
      [
        'FROM publications p',
        [
          {
            id: 'p1',
            internal_name: 'Jordan',
            backward_compatibility: 'mwnf3:bookbase:7',
            category: 'exhibition-trail',
            project_id: 'iam',
            project_context_id: 'ctx-iam',
            country_id: 'jor',
            language_id: 'eng',
            status: 'published',
            display_order: null,
            extra: { region: 'Middle East' },
          },
        ],
      ],
      [
        'FROM publication_translations',
        [
          { publication_id: 'p1', language_id: 'eng', context_id: 'ctx-default', title: 'Wrong context', subtitle: null, description: null, introduction: null, author_credit: null, photography_credit: null, coordination_credit: null },
          { publication_id: 'p1', language_id: 'eng', context_id: 'ctx-iam', title: 'The Umayyads', subtitle: 'Rise', description: 'About', introduction: null, author_credit: 'Ed. by A', photography_credit: 'B', coordination_credit: null },
        ],
      ],
      [
        'FROM publication_editions',
        [
          { id: 'e-fr', publication_id: 'p1', language_id: 'fra' },
          { id: 'e-en', publication_id: 'p1', language_id: 'eng' },
        ],
      ],
      [
        'FROM publication_images',
        [
          { publication_id: 'p1', publication_edition_id: 'e-fr', kind: 'cover', path: 'fr.jpg', alt_text: null, display_order: 1, extra: null },
          { publication_id: 'p1', publication_edition_id: 'e-hidden', kind: 'cover', path: 'hidden.jpg', alt_text: null, display_order: 2, extra: null },
          { publication_id: 'p1', publication_edition_id: 'e-en', kind: 'cover', path: 'en.jpg', alt_text: 'Cover', display_order: 3, extra: { photographer: 'C' } },
          { publication_id: 'p1', publication_edition_id: null, kind: 'page', path: 'page1.jpg', alt_text: null, display_order: 1, extra: null },
        ],
      ],
      [
        'FROM publication_documents',
        [
          { id: 'd1', publication_id: 'p1', publication_edition_id: null, language_id: 'eng', kind: 'sample', path: DOC },
          { id: 'd2', publication_id: 'p1', publication_edition_id: null, language_id: null, kind: 'credits', path: 'books/7/credits.pdf' },
        ],
      ],
      ['FROM publication_tag', [{ publication_id: 'p1', tag_id: 'tag-1' }]],
    ])
    const scope = scopeWith({
      publicationIds: ['p1'],
      trailsByPublication: new Map([['p1', ['t1']]]),
      catalogueByPublication: new Map([['p1', ['m9']]]),
    })
    await new PublicationExporter(contextWith(db, outputDir, scope)).export()

    const [p] = read('publications.json')
    expect(p).toMatchObject({
      id: 'p1',
      category: 'exhibition-trail',
      country_id: 'jor',
      language: 'en',
      extra: { region: 'Middle East' },
      cover: { url: 'https://example.test/pub/en.jpg', alt_text: 'Cover', photographer: 'C', edition_id: 'e-en' },
      pages: [{ url: 'https://example.test/pub/page1.jpg', edition_id: null }],
      documents: [{ id: 'd1', kind: 'sample', url: `https://example.test/doc/${DOC}`, language: 'en' }],
      edition_ids: ['e-fr', 'e-en'],
      tag_ids: ['tag-1'],
      trail_ids: ['t1'],
      catalogue_item_ids: ['m9'],
      languages: ['en'],
    })
    expect(JSON.stringify(p)).not.toContain('hidden.jpg')
    expect(read('translations/publications.en.json')).toEqual({
      p1: { title: 'The Umayyads', subtitle: 'Rise', description: 'About', author_credit: 'Ed. by A', photography_credit: 'B' },
    })
  })

  it('writes the editions without their shop links', async () => {
    const db = fakeDb([
      languages,
      [
        'FROM publication_editions',
        [
          {
            id: 'e1', publication_id: 'p1', language_id: 'eng', format: 'print', edition: 1, publish_year: 2000,
            isbn: '978-3-902782-00-0', publisher: 'MWNF', page_count: 200, image_count: 100, plan_count: 3,
            dimensions: '24 × 17 cm', binding: 'paperback', display_order: null,
            backward_compatibility: 'mwnf3:books:7:en:1:book:1',
            extra: { legacy_texts: { title: 'Edition title' }, shop_links: [{ name: 'Shop', url: 'https://shop.test' }] },
          },
        ],
      ],
      [
        'FROM publication_images',
        [{ publication_id: 'p1', publication_edition_id: 'e1', kind: 'cover', path: 'c.jpg', alt_text: null, display_order: 1, extra: null }],
      ],
      [
        'FROM publication_documents',
        [{ id: 'd1', publication_id: 'p1', publication_edition_id: 'e1', language_id: 'eng', kind: 'credits', path: DOC }],
      ],
    ])
    await new EditionExporter(contextWith(db, outputDir, scopeWith({ publicationIds: ['p1'] }))).export()
    const [e] = read('editions.json')
    expect(e).toMatchObject({
      id: 'e1',
      language: 'en',
      format: 'print',
      isbn: '978-3-902782-00-0',
      cover: { url: 'https://example.test/pub/c.jpg' },
      documents: [{ kind: 'credits', url: `https://example.test/doc/${DOC}` }],
      texts: { title: 'Edition title' },
    })
    expect(JSON.stringify(e)).not.toContain('shop')
  })

  it('writes the trails with their Travels page and entries', async () => {
    const db = fakeDb([
      ['FROM collections WHERE', [{ id: 't1', backward_compatibility: 'mwnf3_travels:trail:IAM:jo:1' }]],
      ['FROM collection_translations', [{ id: 't1', language: 'en', title: 'The Umayyads', extra: null }]],
    ])
    const scope = scopeWith({ trailIds: ['t1'], entriesByTrail: new Map([['t1', ['o1', 'o2']]]) })
    await new TrailExporter(contextWith(db, outputDir, scope)).export()
    expect(read('trails.json')).toEqual([
      {
        id: 't1',
        backward_compatibility: 'mwnf3_travels:trail:IAM:jo:1',
        titles: { en: 'The Umayyads' },
        subtitles: {},
        site: 'travels',
        path: '/trail/t1',
        url: 'https://example.test/travels/#/trail/t1',
        entry_ids: ['o1', 'o2'],
      },
    ])
  })

  it("names the site's address in the manifest", async () => {
    const db = fakeDb([
      ['FROM languages WHERE', [{ backward_compatibility: 'en' }]],
      ['FROM publication_translations', [{ language_id: 'eng', code: 'en', name: 'English' }]],
    ])
    await new ManifestExporter(contextWith(db, outputDir, scopeWith({ publicationIds: ['p1'] }))).export()
    expect(read('manifest.json')).toMatchObject({
      kind: 'publications',
      site: { key: 'publications', languages: [{ code: 'en', label: 'English' }], names: {}, origin: 'https://example.test/publications' },
    })
  })
})

describe('pickCover and isServableDocument', () => {
  const cover = (edition_id: string | null, url: string) => ({ url, alt_text: null, photographer: null, display_order: 0, edition_id })
  it('takes no cover of a hidden edition', () => {
    expect(pickCover([cover('hidden', 'h'), cover(null, 'n')], new Map(), 'eng')?.url).toBe('n')
  })
  it('serves only a document stored under its /doc name', () => {
    expect(isServableDocument(DOC)).toBe(true)
    expect(isServableDocument('books/7/sample.pdf')).toBe(false)
  })
})
