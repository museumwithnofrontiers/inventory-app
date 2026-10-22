import { describe, expect, it } from 'vitest'
import {
  getCollection,
  getGlossary,
  getItem,
  getPartner,
  getRecord,
  getTimeline,
  listCollections,
  listGlossary,
  listItems,
  listPartners,
  listTimelines,
} from '../src/browse.js'
import { detectFamily } from '../src/family.js'
import { listFiles, readFile } from '../src/files.js'
import {
  exhibitionFiles,
  exploreFiles,
  galleryFiles,
  hubFiles,
  projectV1,
  viewOf,
} from './helpers/fixtures.js'

describe('detectFamily', () => {
  it('reads manifest.kind, else the file set', () => {
    expect(detectFamily(viewOf(projectV1()))).toBe('project')
    expect(detectFamily(viewOf(galleryFiles()))).toBe('dxa-gallery')
    expect(detectFamily(viewOf(exhibitionFiles()))).toBe('dxa-exhibition')
    expect(detectFamily(viewOf(hubFiles()))).toBe('galleries-hub')
    expect(detectFamily(viewOf(exploreFiles()))).toBe('explore')
    const noKind = galleryFiles()
    noKind['manifest.json'] = {}
    expect(detectFamily(viewOf(noKind))).toBe('dxa-gallery')
  })
})

describe('project family', () => {
  const view = viewOf(projectV1())

  it('lists items with filters, id and backward_compatibility first', () => {
    const all = listItems(view, {})
    expect(all.total).toBe(3)
    expect(all.types).toEqual({ object: 2, monument: 1 })
    expect(all.results[0]).toMatchObject({
      id: 'i1',
      backward_compatibility: 'mwnf3:objects:ISL:eg:Mus01:1',
      name: 'Bowl with a bird',
      images: 2,
    })
    expect(listItems(view, { type: 'monument' }).results.map(r => r.id)).toEqual(['i2'])
    expect(listItems(view, { has_images: false }).results.map(r => r.id)).toEqual(['i2'])
    expect(listItems(view, { partner: 'mwnf3:museums:Mus01:eg' }).total).toBe(2)
    expect(listItems(view, { country: 'ESP' }).results.map(r => r.id)).toEqual(['i3'])
    expect(listItems(view, { language: 'fr' }).results.map(r => r.id)).toEqual(['i1'])
    expect(listItems(view, { language: 'fr' }).results[0].name).toBe("Coupe à l'oiseau")
    expect(listItems(view, { text: 'azhar' }).results.map(r => r.id)).toEqual(['i2'])
    expect(listItems(view, { text: 'Mus02' }).results.map(r => r.id)).toEqual(['i3'])
    expect(listItems(view, { tag: 'court' }).results.map(r => r.id)).toEqual(['i1'])
  })

  it('filters by collection, sub-collections included unless told otherwise', () => {
    expect(listItems(view, { collection: 'mwnf3:exhibitions:ISL' }).results.map(r => r.id)).toEqual(
      ['i1']
    )
    expect(listItems(view, { collection: 'c-exh', include_sub_collections: false }).total).toBe(0)
    expect(() => listItems(view, { collection: 'nope' })).toThrow(/No collection/)
  })

  it('pages', () => {
    const page = listItems(view, { page: 2, page_size: 2 })
    expect(page).toMatchObject({ total: 3, page: 2, pages: 2 })
    expect(page.results.map(r => r.id)).toEqual(['i3'])
  })

  it('gets an item by id or legacy key, merged with translations and resolved references', () => {
    const byBc = getItem(view, 'MWNF3:OBJECTS:ISL:EG:MUS01:1', {})
    expect(byBc.id).toBe('i1')
    expect(byBc.translations).toEqual({
      en: { name: 'Bowl with a bird', description: 'A lustre bowl.' },
      fr: { name: "Coupe à l'oiseau" },
    })
    expect(byBc.resolved.partner).toMatchObject({ id: 'm1', name: 'Museum of Islamic Art, Cairo' })
    expect(byBc.resolved.project).toEqual({ id: 'p-isl', name: 'Discover Islamic Art' })
    expect(byBc.resolved.country).toBe('Egypt')
    expect(byBc.resolved.collections.map(c => c.id).sort()).toEqual(['c-root', 'c-theme'])
    expect(byBc.resolved.dynasties).toEqual([{ id: 'd1', name: 'Abbasids' }])
    expect(byBc.resolved.glossary).toEqual([{ id: 'g1', word: 'Mihrab' }])
    expect(byBc.resolved.related_items).toEqual([
      { id: 'i2', in_package: true, name: 'Al-Azhar Mosque' },
      { id: 'outside', in_package: false },
    ])
    expect(getItem(view, 'i1', { languages: ['fr'] }).translations).toEqual({
      fr: { name: "Coupe à l'oiseau" },
    })
  })

  it('flags languages declared on an item but not translated', () => {
    expect(getItem(view, 'i3', {}).language_check).toMatchObject({
      declared_but_missing: ['fr'],
      translated_but_undeclared: [],
    })
    expect(() => getItem(view, 'zzz', {})).toThrow(/No item/)
  })

  it('walks the collection tree', () => {
    const tree = listCollections(view, {})
    expect(tree.results.map(r => [r.id, r.depth])).toEqual([
      ['c-root', 0],
      ['c-exh', 1],
      ['c-theme', 2],
    ])
    expect(tree.results[2].title).toBe('Life at court')
    expect(
      listCollections(view, { parent: 'c-root', max_depth: 0 }).results.map(r => r.id)
    ).toEqual(['c-exh'])
    expect(listCollections(view, { type: 'theme' }).results.map(r => r.id)).toEqual(['c-theme'])
    const theme = getCollection(view, 'mwnf3:themes:ISL:1', {})
    expect(theme.ancestors.map(a => a.id)).toEqual(['c-root', 'c-exh'])
    expect(theme.members.results).toEqual([
      {
        id: 'i1',
        backward_compatibility: 'mwnf3:objects:ISL:eg:Mus01:1',
        name: 'Bowl with a bird',
        type: 'object',
      },
    ])
    expect(theme.record.items).toBeUndefined()
  })

  it('compares partner item_count with the items shipped', () => {
    const partners = listPartners(view, {})
    expect(partners.results.map(p => [p.id, p.item_count, p.items_in_package])).toEqual([
      ['m1', 2, 2],
      ['m2', 5, 1],
    ])
    const m2 = getPartner(view, 'm2', {})
    expect(m2.resolved.item_count_matches).toBe(false)
    expect(m2.resolved.parent).toMatchObject({ id: 'm1' })
    expect(getPartner(view, 'm1', {}).resolved.children.map(c => c.id)).toEqual(['m2'])
  })

  it('reads the glossary and timelines', () => {
    expect(listGlossary(view, { text: 'mehrab' }).results).toEqual([
      { id: 'g1', word: 'Mihrab', spellings: ['Mihrab', 'Mehrab'], has_definition: true },
    ])
    expect(getGlossary(view, 'Mihrab', {}).used_by_items).toBe(1)
    const timelines = listTimelines(view)
    expect(timelines.timelines[0]).toMatchObject({ id: 't1', events: 1 })
    expect(timelines.orphan_events).toBe(1)
    expect(getTimeline(view, 't1', {}).events.results[0].text).toEqual({
      description: 'Cairo founded',
    })
  })

  it('reads any record with its translations', () => {
    expect(getRecord(view, 'dynasties.json', 'd1', {}).translations).toEqual({
      en: { name: 'Abbasids' },
    })
    expect(getRecord(view, 'countries', 'egy', {}).record).toMatchObject({ internal_name: 'Egypt' })
    expect(() => getRecord(view, 'tags', 'x', {})).toThrow(/no tags.json/)
  })

  it('lists and pages files', () => {
    const files = listFiles(view, 'translations/items')
    expect(files.files.map(f => f.path)).toEqual([
      'translations/items.en.json',
      'translations/items.fr.json',
    ])
    expect(listFiles(view).files.find(f => f.path === 'items.json')?.records).toBe(3)
    expect(readFile(view, 'items.json', { page_size: 2 })).toMatchObject({
      unit: 'records',
      total: 3,
      pages: 2,
    })
    expect(readFile(view, 'manifest.json')).toMatchObject({ unit: 'whole' })
    expect(readFile(view, 'README.md')).toMatchObject({
      unit: 'characters',
      content: '# @museumwnf/islamicart-data\n',
    })
    expect(() => readFile(view, '../secret')).toThrow(/Invalid package path/)
    expect(() => readFile(view, 'nope.json')).toThrow(/has no file/)
  })
})

describe('dxa-gallery family', () => {
  const view = viewOf(galleryFiles())

  it('treats the gallery as the one collection and resolves tag_ids against tags.json', () => {
    expect(listCollections(view, {}).results).toEqual([
      expect.objectContaining({ id: 'gal', type: 'gallery', title: 'Carpets', items: 2 }),
    ])
    expect(listItems(view, { collection: 'carpets' }).total).toBe(2)
    expect(listItems(view, { tag: 'wool' }).results.map(r => r.id)).toEqual(['x1'])
    const item = getItem(view, 'x2', {})
    expect(item.resolved.tags).toEqual([
      { id: 'tg2', category: 'type', label: 'Kilim' },
      { id: 'tg-missing', missing_from_tags_json: true },
    ])
    expect(getRecord(view, 'tags', 'thg:tags:material_1', {}).record).toMatchObject({
      label: 'Wool',
    })
  })
})

describe('dxa-exhibition family', () => {
  const view = viewOf(exhibitionFiles())

  it('builds exhibition → theme → sub-theme with the pictures’ parent items as members', () => {
    const tree = listCollections(view, {})
    expect(tree.results.map(r => [r.id, r.type, r.depth, r.title])).toEqual([
      ['exh', 'exhibition', 0, 'The Use of Colours in Art'],
      ['th1', 'theme', 1, 'The Basics'],
      ['th1a', 'sub_theme', 2, 'Hue'],
    ])
    expect(listItems(view, { collection: 'th1' }).results.map(r => r.id)).toEqual(['y1', 'y2'])
    expect(
      listItems(view, { collection: 'mwnf3_thematic_gallery:theme:47:3' }).results.map(r => r.id)
    ).toEqual(['y2'])
  })

  it('returns a theme with its per-picture texts', () => {
    const theme = getCollection(view, 'th1', {})
    expect(theme.translations).toMatchObject({
      en: { title: 'The Basics' },
      'en:pictures': { p1: { contextual_description: 'Blue glaze' } },
    })
    expect(theme.children.map(c => c.id)).toEqual(['th1a'])
    expect(getItem(view, 'y2', {}).resolved.collections.map(c => c.id)).toEqual(['th1a'])
  })

  it('reads sub-themes and related content as records', () => {
    expect(getRecord(view, 'themes', 'th1a', {}).translations).toEqual({ en: { title: 'Hue' } })
    expect(getRecord(view, 'related_content', '5', {}).id).toBe('5')
  })
})

describe('galleries-hub family', () => {
  const view = viewOf(hubFiles())

  it('lists the hub and its galleries, and has no items', () => {
    expect(listCollections(view, {}).results.map(r => [r.id, r.depth, r.title])).toEqual([
      ['hub', 0, null],
      ['ga', 1, 'Amulets'],
      ['gb', 1, 'Carpets'],
    ])
    expect(listItems(view, {}).total).toBe(0)
    expect(getPartner(view, 'hp', {}).name).toBe('MAK')
  })
})

describe('explore family', () => {
  const view = viewOf(exploreFiles())

  it('walks the explore tree and links details to their monument', () => {
    expect(listCollections(view, {}).results.map(r => [r.id, r.type, r.purpose])).toEqual([
      ['er', 'collection', 'explore-root'],
      ['loc', 'location', null],
    ])
    expect(listItems(view, { collection: 'mwnf3_explore:root' }).results.map(r => r.id)).toEqual([
      'mon',
    ])
    const monument = getItem(view, 'mon', {})
    expect(monument.resolved.children.map(c => c.id)).toEqual(['det'])
    expect(getItem(view, 'det', {}).resolved.parent).toMatchObject({
      id: 'mon',
      name: 'Jesuit Church',
    })
  })
})
