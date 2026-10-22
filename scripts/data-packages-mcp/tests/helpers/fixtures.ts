import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PackageView } from '../../src/package-view.js'
import type { FetchLike } from '../../src/registry.js'
import { packTarball } from './tar.js'

export type Files = Record<string, unknown>

const IMG = 'https://inventory.example.org/pub'

/** A project-scoped package (islamicart/baroqueart/sharinghistory shape), first version. */
export function projectV1(): Files {
  return {
    'package.json': { name: '@museumwnf/islamicart-data', version: '1.0.1' },
    'manifest.json': {
      generatedAt: '2026-01-01T00:00:00.000Z',
      projectKeys: ['ISL'],
      projectIds: ['p-isl'],
      version: '1.0.0',
      languages: ['en', 'fr'],
      projects: { 'p-isl': { name: { en: 'Discover Islamic Art' } } },
    },
    'items.json': [
      {
        id: 'i1',
        type: 'object',
        internal_name: 'Bowl',
        backward_compatibility: 'mwnf3:objects:ISL:eg:Mus01:1',
        parent_id: null,
        partner_id: 'm1',
        country_id: 'egy',
        project_id: 'p-isl',
        images: [
          { url: `${IMG}/img-1.jpg`, display_order: 1 },
          { url: `${IMG}/img-2.jpg`, display_order: 2 },
        ],
        dynasty_ids: ['d1'],
        related_items: [{ id: 'i2' }, { id: 'outside' }],
        tags: ['Court'],
        glossary_ids: ['g1'],
        languages: ['en', 'fr'],
      },
      {
        id: 'i2',
        type: 'monument',
        internal_name: 'Mosque',
        backward_compatibility: 'mwnf3:monuments:ISL:eg:Mon01',
        parent_id: null,
        partner_id: 'm1',
        country_id: 'egy',
        project_id: 'p-isl',
        images: [],
        dynasty_ids: [],
        related_items: [],
        tags: [],
        glossary_ids: [],
        languages: ['en'],
      },
      {
        id: 'i3',
        type: 'object',
        internal_name: 'Tile',
        backward_compatibility: 'mwnf3:objects:ISL:es:Mus02:7',
        parent_id: null,
        partner_id: 'm2',
        country_id: 'esp',
        project_id: 'p-isl',
        images: [{ url: `${IMG}/img-3.jpg`, display_order: 1 }],
        dynasty_ids: [],
        related_items: [],
        tags: ['Ceramics'],
        glossary_ids: [],
        languages: ['en', 'fr'],
      },
    ],
    'collections.json': [
      {
        id: 'c-root',
        type: 'collection',
        purpose: null,
        internal_name: 'Discover Islamic Art',
        backward_compatibility: 'mwnf3:projects:ISL',
        parent_id: null,
        items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }],
      },
      {
        id: 'c-exh',
        type: 'exhibition',
        purpose: 'exhibitions-root',
        internal_name: 'Exhibitions',
        backward_compatibility: 'mwnf3:exhibitions:ISL',
        parent_id: 'c-root',
        items: [],
      },
      {
        id: 'c-theme',
        type: 'theme',
        purpose: null,
        internal_name: 'Court life',
        backward_compatibility: 'mwnf3:themes:ISL:1',
        parent_id: 'c-exh',
        items: [{ id: 'i1' }],
      },
    ],
    'partners.json': [
      {
        id: 'm1',
        type: 'museum',
        backward_compatibility: 'mwnf3:museums:Mus01:eg',
        country_id: 'egy',
        parent_id: null,
        item_count: 2,
        images: [],
      },
      {
        id: 'm2',
        type: 'institution',
        backward_compatibility: 'mwnf3:institutions:Ins02:es',
        country_id: 'esp',
        parent_id: 'm1',
        item_count: 5,
        images: [],
      },
    ],
    'glossary.json': [{ id: 'g1', word: 'Mihrab' }],
    'dynasties.json': [{ id: 'd1', from_ad: 750, to_ad: 1258 }],
    'countries.json': [{ id: 'egy', code: 'eg', internal_name: 'Egypt' }],
    'timelines.json': [
      { id: 't1', internal_name: 'Egypt timeline', country_id: 'egy', collection_id: null },
    ],
    'timeline_events.json': [
      { id: 'e1', timeline_id: 't1', year_from: 969, display_order: 1 },
      { id: 'e2', timeline_id: 't-gone', year_from: 1171, display_order: 2 },
    ],
    'translations/items.en.json': {
      i1: { name: 'Bowl with a bird', description: 'A lustre bowl.' },
      i2: { name: 'Al-Azhar Mosque' },
      i3: { name: 'Tile panel', description: '' },
    },
    'translations/items.fr.json': { i1: { name: "Coupe à l'oiseau" } },
    'translations/collections.en.json': {
      'c-root': { title: 'Discover Islamic Art' },
      'c-theme': { title: 'Life at court' },
    },
    'translations/partners.en.json': {
      m1: { name: 'Museum of Islamic Art, Cairo' },
      m2: { name: 'Alhambra' },
    },
    'translations/glossary.en.json': {
      g1: { definition: 'Prayer niche', spellings: ['Mihrab', 'Mehrab'] },
    },
    'translations/dynasties.en.json': { d1: { name: 'Abbasids' } },
    'translations/countries.en.json': { egy: { name: 'Egypt' } },
    'translations/timeline_events.en.json': { e1: { description: 'Cairo founded' } },
    'README.md': '# @museumwnf/islamicart-data\n',
  }
}

/** The next version: one item edited, one removed, one added, a partner fixed, a language added. */
export function projectV2(): Files {
  const files = projectV1()
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
  const manifest = clone(files['manifest.json']) as Record<string, unknown>
  manifest.generatedAt = '2026-02-01T00:00:00.000Z'
  manifest.version = '1.0.1'
  files['manifest.json'] = manifest
  files['package.json'] = { name: '@museumwnf/islamicart-data', version: '1.0.2' }
  const items = clone(files['items.json']) as Record<string, unknown>[]
  items[0].images = [...(items[0].images as unknown[])].reverse()
  items[0].tags = ['Court', 'Gold']
  const i4 = {
    ...clone(items[2]),
    id: 'i4',
    internal_name: 'Lamp',
    backward_compatibility: 'mwnf3:objects:ISL:sy:Mus03:2',
    partner_id: 'm1',
  }
  files['items.json'] = [items[0], items[1], i4]
  files['collections.json'] = (clone(files['collections.json']) as Record<string, unknown>[]).map(
    c => (c.id === 'c-root' ? { ...c, items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i4' }] } : c)
  )
  const partners = clone(files['partners.json']) as Record<string, unknown>[]
  partners[0].item_count = 3
  partners[1].item_count = 0
  files['partners.json'] = partners
  files['translations/items.en.json'] = {
    i1: { name: 'Bowl with a bird', description: 'A lustre-painted bowl.' },
    i2: { name: 'Al-Azhar Mosque' },
    i4: { name: 'Mosque lamp' },
  }
  files['translations/items.fr.json'] = {
    i1: { name: "Coupe à l'oiseau" },
    i2: { name: 'Mosquée al-Azhar' },
  }
  files['translations/items.de.json'] = { i1: { name: 'Schale mit Vogel' } }
  return files
}

export function galleryFiles(): Files {
  return {
    'manifest.json': {
      generatedAt: '2026-01-01T00:00:00.000Z',
      version: '1.0.0',
      kind: 'gallery',
      languages: ['en'],
      itemCount: 2,
    },
    'gallery.json': {
      id: 'gal',
      backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:9',
      kind: 'gallery',
      slug: 'carpets',
      names: { en: 'Carpets', fr: 'Tapis' },
    },
    'items.json': [
      {
        id: 'x1',
        type: 'object',
        internal_name: 'Rug',
        backward_compatibility: 'mwnf3:objects:DCA:de:Mus01:1',
        partner_id: 'pm',
        country_id: 'deu',
        images: [{ url: `${IMG}/rug.jpg` }],
        tag_ids: ['tg1'],
        languages: ['en'],
      },
      {
        id: 'x2',
        type: 'object',
        internal_name: 'Kilim',
        backward_compatibility: 'mwnf3:objects:ISL:tr:Mus02:4',
        partner_id: 'pm',
        country_id: 'tur',
        images: [],
        tag_ids: ['tg2', 'tg-missing'],
        languages: ['en'],
      },
    ],
    'tags.json': [
      {
        id: 'tg1',
        backward_compatibility: 'thg:tags:material_1',
        category: 'material',
        label: 'Wool',
      },
      { id: 'tg2', backward_compatibility: 'thg:tags:type_2', category: 'type', label: 'Kilim' },
    ],
    'partners.json': [
      { id: 'pm', type: 'museum', backward_compatibility: 'mwnf3:museums:Mus01:de', item_count: 2 },
    ],
    'translations/items.en.json': { x1: { name: 'Prayer rug' }, x2: { name: 'Kilim' } },
  }
}

export function exhibitionFiles(): Files {
  return {
    'manifest.json': {
      generatedAt: '2026-01-01T00:00:00.000Z',
      version: '1.0.0',
      kind: 'exhibition',
      languages: ['en', 'de'],
    },
    'exhibition.json': {
      id: 'exh',
      backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:47',
      kind: 'exhibition',
      titles: { en: 'The Use of Colours in Art' },
    },
    'items.json': [
      {
        id: 'y1',
        type: 'object',
        internal_name: 'Vase',
        backward_compatibility: 'mwnf3:objects:EPM:qt:Mus21:7',
        images: [{ url: `${IMG}/vase.jpg` }],
      },
      {
        id: 'y2',
        type: 'monument',
        internal_name: 'Palace',
        backward_compatibility: 'mwnf3:monuments:ISL:es:Mon2',
        images: [],
      },
      {
        id: 'y3',
        type: 'object',
        internal_name: 'Robe',
        backward_compatibility: 'mwnf3:objects:BAR:hu:Mus11:16',
        images: [],
      },
    ],
    'themes.json': [
      {
        id: 'th1',
        backward_compatibility: 'mwnf3_thematic_gallery:theme:47:0',
        internal_name: 'theme_47_0',
        display_order: 1,
        pictures: [
          {
            picture_item_id: 'p1',
            parent_item_id: 'y1',
            display_order: 1,
            image_url: `${IMG}/p1.jpg`,
            related: [],
          },
        ],
        sub_themes: [
          {
            id: 'th1a',
            backward_compatibility: 'mwnf3_thematic_gallery:theme:47:3',
            internal_name: 'theme_47_3',
            display_order: 1,
            pictures: [
              {
                picture_item_id: 'p2',
                parent_item_id: 'y2',
                display_order: 1,
                image_url: `${IMG}/p2.jpg`,
                related: [],
              },
            ],
            sub_themes: [],
          },
        ],
      },
    ],
    'related_content.json': [{ legacy_id: '5', kind: 'document', titles: { en: '1.pdf' } }],
    'translations/themes.en.json': {
      th1: { title: 'The Basics', quote: 'Colours…' },
      th1a: { title: 'Hue' },
      'th1/p1': { contextual_description: 'Blue glaze' },
    },
    'translations/items.en.json': {
      y1: { name: 'Blue vase' },
      y2: { name: 'Palace' },
      y3: { name: 'Robe' },
    },
  }
}

export function hubFiles(): Files {
  return {
    'manifest.json': {
      version: '1.0.0',
      kind: 'galleries-hub',
      hub: { id: 'hub', backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:45' },
    },
    'galleries.json': [
      {
        id: 'ga',
        backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:4',
        slug: 'amulets',
        names: { en: 'Amulets' },
      },
      {
        id: 'gb',
        backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:9',
        slug: 'carpets',
        names: { en: 'Carpets' },
      },
    ],
    'partners.json': [
      { id: 'hp', type: 'museum', backward_compatibility: 'mwnf3:museums:Mus09:at' },
    ],
    'countries.json': [{ id: 'aut' }],
    'translations/partners.en.json': { hp: { name: 'MAK' } },
  }
}

export function exploreFiles(): Files {
  return {
    'manifest.json': { version: '1.0.0', kind: 'explore', projectKeys: [], languages: ['en'] },
    'collections.json': [
      {
        id: 'er',
        type: 'collection',
        purpose: 'explore-root',
        internal_name: 'explore',
        backward_compatibility: 'mwnf3_explore:root',
        parent_id: null,
        items: [],
        extra: {},
      },
      {
        id: 'loc',
        type: 'location',
        purpose: null,
        internal_name: 'Vienna',
        backward_compatibility: 'mwnf3_explore:location:558',
        parent_id: 'er',
        items: [{ id: 'mon', extra: { explore_monument_ids: [1501] } }],
        extra: {},
      },
    ],
    'items.json': [
      {
        id: 'mon',
        type: 'monument',
        internal_name: 'Jesuitenkirche',
        backward_compatibility: 'mwnf3_explore:monument:1501',
        parent_id: null,
        images: [],
      },
      {
        id: 'det',
        type: 'detail',
        internal_name: 'Altar',
        backward_compatibility: 'mwnf3_explore:detail:1501:1',
        parent_id: 'mon',
        images: [],
      },
    ],
    'translations/collections.en.json': { loc: { title: 'Innsbruck' } },
    'translations/items.en.json': { mon: { name: 'Jesuit Church' } },
  }
}

/** Writes a package's files to a fresh directory and opens it. */
export function viewOf(
  files: Files,
  name = '@museumwnf/test-data',
  version = '1.0.0'
): PackageView {
  const root = mkdtempSync(path.join(tmpdir(), 'dpmcp-'))
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, ...file.split('/'))
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content))
  }
  return new PackageView(name, version, root)
}

export interface FakePackage {
  versions: Record<string, Files>
  tags?: Record<string, string>
  /** Corrupt the advertised integrity of these versions. */
  badIntegrity?: string[]
  tarballOrigin?: string
}

/**
 * An in-memory npm registry: search, org listing, packuments and tarballs,
 * with real integrity hashes. `calls` records every URL requested.
 */
export function fakeRegistry(
  packages: Record<string, FakePackage>,
  options: { orgOnly?: string[]; searchExtra?: string[] } = {}
) {
  const base = 'https://registry.test'
  const calls: string[] = []
  const tarballs = new Map<string, Buffer>()
  const packuments = new Map<string, unknown>()
  for (const [name, pkg] of Object.entries(packages)) {
    const versions: Record<string, unknown> = {}
    const time: Record<string, string> = { modified: '2026-03-01T00:00:00.000Z' }
    let day = 1
    for (const [version, files] of Object.entries(pkg.versions)) {
      const tgz = packTarball(files)
      const bare = name.split('/')[1]
      const url = `${pkg.tarballOrigin ?? base}/${name}/-/${bare}-${version}.tgz`
      tarballs.set(url, tgz)
      const digest = createHash('sha512').update(tgz).digest('base64')
      versions[version] = {
        name,
        version,
        dist: {
          tarball: url,
          integrity: pkg.badIntegrity?.includes(version)
            ? `sha512-${Buffer.alloc(64).toString('base64')}`
            : `sha512-${digest}`,
          shasum: createHash('sha1').update(tgz).digest('hex'),
          fileCount: Object.keys(files).length,
          unpackedSize: tgz.length,
        },
      }
      time[version] = `2026-0${Math.min(day++, 9)}-01T00:00:00.000Z`
    }
    const latest = Object.keys(pkg.versions).at(-1)!
    packuments.set(name, { name, 'dist-tags': { latest, ...pkg.tags }, versions, time })
  }
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  const fetchImpl: FetchLike = async url => {
    calls.push(url)
    const u = new URL(url)
    if (u.pathname === '/-/v1/search') {
      const names = [...packuments.keys()]
        .filter(n => !options.orgOnly?.includes(n))
        .concat(options.searchExtra ?? [])
      const from = Number(u.searchParams.get('from') ?? 0)
      const size = Number(u.searchParams.get('size') ?? 20)
      const objects = names.slice(from, from + size).map(n => {
        const p = packuments.get(n) as { 'dist-tags': { latest: string } } | undefined
        return {
          package: {
            name: n,
            version: p?.['dist-tags'].latest ?? '9.9.9',
            date: '2026-03-01T00:00:00.000Z',
            description: 'Static data export',
          },
        }
      })
      return json({ total: names.length, objects })
    }
    if (u.pathname.startsWith('/-/org/'))
      return json(Object.fromEntries([...packuments.keys()].map(n => [n, 'write'])))
    const tgz = tarballs.get(url)
    if (tgz) return new Response(new Uint8Array(tgz), { status: 200 })
    const name = decodeURIComponent(u.pathname.slice(1))
    const packument = packuments.get(name)
    if (packument) return json(packument)
    return new Response('not found', { status: 404 })
  }
  return { base, calls, fetchImpl }
}
