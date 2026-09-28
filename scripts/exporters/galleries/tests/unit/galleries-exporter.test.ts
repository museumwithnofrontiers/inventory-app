import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  GalleriesExporter,
  isFeatured,
  isHidden,
  listedGalleries,
  type HubGallery,
} from '../../src/exporters/galleries-exporter.js'
import { LANGUAGES, context, fakeDb, tempDir, type Route } from './support.js'

const gallery = (id: string, names: Record<string, string>): HubGallery => ({
  id,
  backward_compatibility: `mwnf3_thematic_gallery:thg_gallery:${id}`,
  slug: null,
  legacy_host: null,
  names,
  languages: Object.keys(names).sort(),
  image_path: null,
  featured: false,
  live_date: null,
})

describe('listedGalleries', () => {
  it('drops the hidden galleries', () => {
    const listed = listedGalleries([
      { gallery: gallery('4', { en: 'Amulets and Talismans' }), hidden: false },
      { gallery: gallery('45', { en: 'Thematic Galleries' }), hidden: true },
    ])
    expect(listed.map(g => g.id)).toEqual(['4'])
  })

  // Legacy's sort_order is English-name order, not gallery-id order: Historical
  // Cars (49) sits between Gold and Silver (19) and Ivory (20).
  it('orders by English name, ignoring case, not by legacy id', () => {
    const listed = listedGalleries([
      { gallery: gallery('20', { en: 'Ivory' }), hidden: false },
      { gallery: gallery('49', { en: 'Historical Cars' }), hidden: false },
      { gallery: gallery('19', { en: 'Gold and Silver' }), hidden: false },
      { gallery: gallery('16', { en: 'Funerary objects' }), hidden: false },
      { gallery: gallery('17', { en: 'Furniture and woodwork' }), hidden: false },
    ])
    expect(listed.map(g => g.names['en'])).toEqual([
      'Funerary objects',
      'Furniture and woodwork',
      'Gold and Silver',
      'Historical Cars',
      'Ivory',
    ])
  })

  it('puts a gallery with no English name after the named ones, by key', () => {
    const listed = listedGalleries([
      { gallery: gallery('9', { fr: 'Tapis' }), hidden: false },
      { gallery: gallery('8', { fr: 'Calligraphie' }), hidden: false },
      { gallery: gallery('4', { en: 'Amulets and Talismans' }), hidden: false },
    ])
    expect(listed.map(g => g.id)).toEqual(['4', '8', '9'])
  })
})

describe('legacy flags', () => {
  it("reads featured and status as the two independent 'A'/'H' flags they are", () => {
    expect(isFeatured('A')).toBe(true)
    expect(isFeatured('H')).toBe(false)
    expect(isFeatured(undefined)).toBe(false)
    expect(isHidden('A')).toBe(false)
    expect(isHidden('H')).toBe(true)
    expect(isHidden(undefined)).toBe(true)
  })
})

describe('GalleriesExporter', () => {
  let out: ReturnType<typeof tempDir>
  beforeEach(() => {
    out = tempDir()
  })
  afterEach(() => out.cleanup())

  const chrome = (status: string, featured = 'H') => ({
    thg_gallery: { status, featured, image: 'thematic_gallery/thg_galleries/x/1.jpg', live_date: '2022-12-01' },
  })

  const routes = (galleries: unknown[]): Route[] => [
    LANGUAGES,
    [/FROM collections g\s+JOIN collections root/, () => galleries],
    [
      /FROM collection_translations/,
      () => [
        { collection_id: 'carpets', language_id: 'eng', title: 'Carpets', extra: chrome('A', 'A') },
        { collection_id: 'carpets', language_id: 'fra', title: 'Tapis', extra: chrome('A', 'A') },
        { collection_id: 'amulets', language_id: 'eng', title: 'Amulets and Talismans', extra: chrome('A') },
        { collection_id: 'hub', language_id: 'eng', title: 'Thematic Galleries', extra: chrome('H') },
      ],
    ],
  ]

  const galleryRows = [
    {
      id: 'carpets',
      backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:9',
      extra: { thg_gallery: { slug: 'carpets', host: 'https://carpets.museumwnf.org' } },
    },
    {
      id: 'amulets',
      backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:4',
      extra: { thg_gallery: { slug: 'amulets_and_talismans', host: 'https://amulets.museumwnf.org' } },
    },
    { id: 'hub', backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:45', extra: { thg_gallery: { slug: 'galleries' } } },
  ]

  it('lists the visible galleries under the root, by English name, with the sibling-gallery fields', async () => {
    const db = fakeDb(routes(galleryRows))
    const result = await new GalleriesExporter(context(db, out.dir)).export()

    expect(result).toEqual({ file: 'galleries.json', count: 2 })
    expect(out.read('galleries.json')).toEqual([
      {
        id: 'amulets',
        backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:4',
        slug: 'amulets_and_talismans',
        legacy_host: 'https://amulets.museumwnf.org',
        names: { en: 'Amulets and Talismans' },
        languages: ['en'],
        image_path: 'thematic_gallery/thg_galleries/x/1.jpg',
        featured: false,
        live_date: '2022-12-01',
      },
      {
        id: 'carpets',
        backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:9',
        slug: 'carpets',
        legacy_host: 'https://carpets.museumwnf.org',
        names: { en: 'Carpets', fr: 'Tapis' },
        languages: ['en', 'fr'],
        image_path: 'thematic_gallery/thg_galleries/x/1.jpg',
        featured: true,
        live_date: '2022-12-01',
      },
    ])
  })

  it('scopes the galleries by the root purpose, never by a legacy id', async () => {
    const db = fakeDb(routes(galleryRows))
    await new GalleriesExporter(context(db, out.dir)).export()

    const scope = db.calls.find(call => /JOIN collections root/.test(call.sql))
    expect(scope?.params).toEqual(['galleries-root'])
    expect(scope?.sql).toMatch(/g\.type = 'gallery'/)
  })

  it('fails loudly when the root has no gallery, rather than shipping an empty hub', async () => {
    const db = fakeDb(routes([]))
    await expect(new GalleriesExporter(context(db, out.dir)).export()).rejects.toThrow(/galleries-root/)
  })
})
