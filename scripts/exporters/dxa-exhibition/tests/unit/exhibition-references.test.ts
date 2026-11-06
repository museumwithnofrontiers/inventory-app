import { describe, expect, it } from 'vitest'

import { buildExhibitionReferences } from '../../src/exporters/exhibition-references.js'
import type { Database } from '../../src/core/database.js'
import type { ExhibitionSite } from '../../src/core/instance.js'

const ISL = 'isl-project'
const AWE = 'awe-project'

const sites = new Map<string, ExhibitionSite>([
  ['muslim-west', { slug: 'islamicart-muslim-west', kind: 'minisite', projectId: ISL }],
  ['travelling', { slug: 'sharinghistory-travelling', kind: 'minisite', projectId: AWE }],
  ['qalam', { slug: 'with-brush-and-qalam', kind: 'exhibition', projectId: null }],
  ['artintro', { slug: 'islamicart-artistic-introduction', kind: 'minisite', projectId: ISL }],
])

interface Rows {
  virtual?: unknown[]
  sharingHistory?: unknown[]
  tree?: unknown[]
  exhibition?: unknown[]
  titles?: unknown[]
}

function stubDb(rows: Rows): Database {
  return {
    query: async (sql: string) => {
      if (sql.includes('SELECT id, backward_compatibility FROM collections')) {
        return [
          { id: 'artintro', backward_compatibility: 'mwnf3:artintro:1' },
          { id: 'muslim-west', backward_compatibility: 'mwnf3:exhibitions:27' },
          { id: 'qalam', backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:47' },
          { id: 'travelling', backward_compatibility: 'mwnf3_sharing_history:sh_exhibitions:11' },
        ]
      }
      if (sql.includes('AS page_bc')) return rows.virtual ?? []
      if (sql.includes("'$.curator_status'")) return rows.sharingHistory ?? []
      if (sql.includes('AS titled_en')) return rows.tree ?? []
      if (sql.includes('AS picture_order')) return rows.exhibition ?? []
      if (sql.includes('FROM collection_translations')) return rows.titles ?? []
      if (sql.includes('FROM projects')) {
        return [
          { id: ISL, internal_name: 'Discover Islamic Art' },
          { id: AWE, internal_name: 'Sharing History' },
        ]
      }
      return []
    },
  } as unknown as Database
}

const langs = new Map([
  ['eng', 'en'],
  ['fra', 'fr'],
])
const ph = (n: number) => Array(n).fill('?').join(', ')

describe('buildExhibitionReferences', () => {
  it('lists a virtual exhibition once, on the first page placing the item', async () => {
    const db = stubDb({
      virtual: [
        { item_id: 'item', root_id: 'muslim-west', theme_id: 't6', theme_order: 6, page_bc: 'mwnf3:exhibition_pages:300', page_order: 4 },
        { item_id: 'item', root_id: 'muslim-west', theme_id: 't6', theme_order: 6, page_bc: 'mwnf3:exhibition_pages:264', page_order: 3 },
      ],
      titles: [
        { collection_id: 'muslim-west', language_id: 'eng', title: 'The Muslim West' },
        { collection_id: 't6', language_id: 'eng', title: 'Settlements and Domestic Life' },
        { collection_id: 't6', language_id: 'fra', title: 'Habitat et vie domestique' },
      ],
    })
    const refs = await buildExhibitionReferences(db, ['item'], sites, langs, ph)
    expect(refs.get('item')).toEqual([
      {
        list: 'virtual',
        site: 'islamicart-muslim-west',
        path: '/exhibition/6/3',
        project: { id: ISL, name: 'Discover Islamic Art' },
        exhibition: { id: 'muslim-west', titles: { en: 'The Muslim West' } },
        theme: { id: 't6', titles: { en: 'Settlements and Domestic Life', fr: 'Habitat et vie domestique' } },
        subtheme: null,
        legacy_order: [27],
      },
    ])
  })

  it("numbers Sharing History's themes and subthemes among those with an English title, theme first", async () => {
    const db = stubDb({
      sharingHistory: [
        { item_id: 'item', collection_id: 'sub-b' },
        { item_id: 'item', collection_id: 'theme-2' },
        { item_id: 'item', collection_id: 'untitled' },
      ],
      tree: [
        { id: 'untitled', parent_id: 'travelling', type: 'theme', display_order: 1, backward_compatibility: 'mwnf3_sharing_history:sh_exhibition_themes:9', titled_en: 0 },
        { id: 'theme-1', parent_id: 'travelling', type: 'theme', display_order: 2, backward_compatibility: 'mwnf3_sharing_history:sh_exhibition_themes:10', titled_en: 1 },
        { id: 'theme-2', parent_id: 'travelling', type: 'theme', display_order: 3, backward_compatibility: 'mwnf3_sharing_history:sh_exhibition_themes:12', titled_en: 1 },
        { id: 'sub-a', parent_id: 'theme-2', type: 'subtheme', display_order: 1, backward_compatibility: 'mwnf3_sharing_history:sh_exhibition_subthemes:40', titled_en: 1 },
        { id: 'sub-b', parent_id: 'theme-2', type: 'subtheme', display_order: 2, backward_compatibility: 'mwnf3_sharing_history:sh_exhibition_subthemes:41', titled_en: 1 },
      ],
    })
    const refs = (await buildExhibitionReferences(db, ['item'], sites, langs, ph)).get('item') ?? []
    expect(refs.map(r => [r.list, r.site, r.path, r.subtheme?.id ?? null, r.project?.name])).toEqual([
      ['sharing_history', 'sharinghistory-travelling', '/theme/2', null, 'Sharing History'],
      ['sharing_history', 'sharinghistory-travelling', '/theme/2/2', 'sub-b', 'Sharing History'],
    ])
  })

  it("links an online exhibition's sub-theme pictures, never the About theme's", async () => {
    const db = stubDb({
      exhibition: [
        {
          item_id: 'item', root_id: 'qalam', theme_id: 'about', theme_bc: 'mwnf3_thematic_gallery:theme:47:0', theme_order: 1,
          subtheme_id: 'about-sub', subtheme_order: 1, picture_order: 1, extra: null,
        },
        {
          item_id: 'item', root_id: 'qalam', theme_id: 'th', theme_bc: 'mwnf3_thematic_gallery:theme:47:3', theme_order: 3,
          subtheme_id: 'sub', subtheme_order: 2, picture_order: 5,
          extra: JSON.stringify({ source_bc_by_language: { eng: 'mwnf3_thematic_gallery:theme_item_i18n:47:10:12:en' } }),
        },
      ],
    })
    const refs = (await buildExhibitionReferences(db, ['item'], sites, langs, ph)).get('item') ?? []
    expect(refs.map(r => [r.list, r.site, r.path, r.theme.id, r.subtheme?.id, r.project, r.legacy_order])).toEqual([
      ['exhibition', 'with-brush-and-qalam', '/theme/2/2/5', 'th', 'sub', null, [12]],
    ])
  })

  it('asks nothing of the database when no exhibition has a site', async () => {
    let asked = 0
    const db = { query: async () => (asked++, []) } as unknown as Database
    expect((await buildExhibitionReferences(db, ['item'], new Map(), langs, ph)).size).toBe(0)
    expect(asked).toBe(0)
  })
})
