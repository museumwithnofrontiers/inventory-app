import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Database } from '../../src/core/database.js'
import { GalleryRecordExporter } from '../../src/exporters/gallery-record-exporter.js'
import { LANGUAGES, context, fakeDb, tempDir } from './support.js'

// Legacy's hub is DXA gallery 45: the gallery family's shell reads its record
// from `gallery.json`, and captions the banner with the object it names
// (#2425).
describe('GalleryRecordExporter', () => {
  let out: ReturnType<typeof tempDir>
  beforeEach(() => {
    out = tempDir()
  })
  afterEach(() => out.cleanup())

  const routes = (bannerRows: unknown[] = [{ id: 'chest-uuid' }]) =>
    fakeDb([
      LANGUAGES,
      [/FROM collections WHERE id = \?/, () => [{ extra: { thg_gallery: { slug: 'galleries', host: 'https://gallery-partners.museumwnf.org' } } }]],
      [
        /FROM collection_translations/,
        () => [
          {
            language_id: 'eng',
            title: 'MWNF Galleries',
            extra: {
              thg_gallery: {
                banner_item: 'mwnf#obj#GALLERIES;sw;Mus01;42',
                banner_image: 'thematic_gallery/thg_galleries/45/banner.jpg',
              },
            },
          },
        ],
      ],
      [/FROM items WHERE backward_compatibility = \?/, () => bannerRows],
    ])

  it("writes the hub's record in a gallery package's shape, its banner object resolved", async () => {
    const db = routes()
    const result = await new GalleryRecordExporter(context(db, out.dir)).export()

    expect(result).toEqual({ file: 'gallery.json', count: 1 })
    expect(out.read('gallery.json')).toMatchObject({
      id: 'hub-uuid',
      backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:45',
      kind: 'gallery',
      slug: 'galleries',
      legacy_host: 'https://gallery-partners.museumwnf.org',
      project_id: 'galleries-project-uuid',
      languages: ['en'],
      names: { en: 'MWNF Galleries' },
      banner_item_id: 'chest-uuid',
      banner_image_path: 'thematic_gallery/thg_galleries/45/banner.jpg',
      has_timeline: false,
      sibling_galleries: [],
    })
    const lookup = db.calls.find(call => /FROM items WHERE backward_compatibility/.test(call.sql))
    expect(lookup?.params).toEqual(['mwnf3:objects:GALLERIES:sw:Mus01:42'])
  })

  it('names no banner object when its reference does not resolve', async () => {
    await new GalleryRecordExporter(context(routes([]), out.dir)).export()
    expect(out.read('gallery.json')).toMatchObject({ banner_item_id: null })
  })
})

describe('Database.resolveHubMembers', () => {
  it("reads the partner project's objects and monuments held by its museums", async () => {
    const db = new Database()
    const calls: { sql: string; params: unknown[] }[] = []
    db.query = (async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params })
      return [{ item_id: 'bordino', project_id: 'galleries-project-uuid' }]
    }) as Database['query']

    expect(await db.resolveHubMembers('galleries-project-uuid')).toEqual([
      { item_id: 'bordino', project_id: 'galleries-project-uuid' },
    ])
    expect(calls[0]?.params).toEqual(['galleries-project-uuid', 'galleries-project-uuid'])
    expect(calls[0]?.sql).toMatch(/p\.type = 'museum'/)
    expect(calls[0]?.sql).toMatch(/i\.type IN \('object', 'monument'\)/)
  })
})
