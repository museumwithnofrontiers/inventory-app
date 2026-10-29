import { describe, expect, it } from 'vitest'

import { buildCollectionImageEntry } from '../../src/exporters/collection-exporter.js'
import { minisiteLanguages } from '../../src/exporters/manifest-exporter.js'
import type { MinisiteInstance } from '../../src/minisite/instance.js'
import { resolveScope } from '../../src/minisite/scope.js'

/**
 * A Sharing History mini-site's package is read from the database, narrowed
 * to one exhibition: its themes and subthemes, the items they place with
 * their parent records, and the museums those items name.
 */
const ROOT = '00000000-0000-4000-8000-000000000001'
const MUSEUM = '00000000-0000-4000-8000-0000000000aa'
const ELSEWHERE_MUSEUM = '00000000-0000-4000-8000-0000000000bb'

const instance: MinisiteInstance = {
  kind: 'minisite',
  slug: 'sharinghistory-travelling',
  name: 'Travelling',
  exporter: 'sharinghistory',
  parent: 'sharinghistory',
  collectionId: ROOT,
  partnerIds: [],
  packageName: '@museumwnf/sharinghistory-travelling-data',
  legacyUrl: 'https://sharinghistory.museumwnf.org/exhibitions/AWE/exh_items.php?eId=11',
}

const collections = [
  { id: ROOT, parent_id: 'root' },
  { id: 'theme', parent_id: ROOT },
  { id: 'subtheme', parent_id: 'theme' },
  { id: 'elsewhere', parent_id: 'root' },
]
const items = [
  { id: 'monument', type: 'monument', parent_id: null, partner_id: null },
  { id: 'detail', type: 'detail', parent_id: 'monument', partner_id: null },
  { id: 'painting', type: 'object', parent_id: null, partner_id: MUSEUM },
  { id: 'other', type: 'object', parent_id: null, partner_id: ELSEWHERE_MUSEUM },
]
const placements = [
  { collection_id: ROOT, item_id: 'painting' },
  { collection_id: 'subtheme', item_id: 'detail' },
  { collection_id: 'elsewhere', item_id: 'other' },
]

/** The few queries resolveScope makes, answered from the arrays above. */
const db = {
  query: async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
    const ids = new Set(params as string[])
    if (sql.includes('FROM collections WHERE id =')) return collections.filter(c => ids.has(c.id)).map(c => ({ id: c.id })) as T[]
    if (sql.includes('FROM collections WHERE parent_id')) return collections.filter(c => ids.has(c.parent_id)).map(c => ({ id: c.id })) as T[]
    if (sql.includes('FROM collection_item')) {
      return placements.filter(p => ids.has(p.collection_id)).map(p => ({ id: p.item_id })) as T[]
    }
    if (sql.includes('SELECT DISTINCT parent_id AS id FROM items')) {
      return items.filter(i => ids.has(i.id) && i.parent_id).map(i => ({ id: i.parent_id })) as T[]
    }
    if (sql.includes('SELECT DISTINCT partner_id AS id FROM items')) {
      return [...new Set(items.filter(i => ids.has(i.id) && i.partner_id).map(i => i.partner_id))].map(id => ({ id })) as T[]
    }
    if (sql.includes('FROM partners')) return [MUSEUM].filter(id => ids.has(id)).map(id => ({ id })) as T[]
    throw new Error(`unexpected query: ${sql}`)
  },
}

describe('resolveScope', () => {
  it('keeps the exhibition, its themes and subthemes, nothing beside it', async () => {
    const scope = await resolveScope(db, instance)
    expect(scope.collectionIds).toEqual([ROOT, 'theme', 'subtheme'])
  })

  it('keeps the placed items with their parent records, and the museums they name', async () => {
    const scope = await resolveScope(db, instance)
    expect(scope.itemIds).toEqual(['detail', 'monument', 'painting'])
    expect(scope.partnerIds).toEqual([MUSEUM])
  })

  it('fails on a partner the database does not have', async () => {
    await expect(
      resolveScope(db, { ...instance, partnerIds: ['00000000-0000-4000-8000-00000000ffff'] })
    ).rejects.toThrow('No partner')
  })
})

describe('minisiteLanguages', () => {
  it('keeps a language only when every page of the exhibition has a title in it', () => {
    const titled = [
      { collection_id: ROOT, code: 'ar' },
      { collection_id: ROOT, code: 'en' },
      { collection_id: ROOT, code: 'es' },
      { collection_id: 'theme', code: 'en' },
      { collection_id: 'subtheme', code: 'en' },
    ]
    expect(minisiteLanguages(titled, [ROOT, 'theme', 'subtheme'])).toEqual(['en'])
  })
})

describe('buildCollectionImageEntry', () => {
  it("carries an image's role and a logo's link", () => {
    expect(
      buildCollectionImageEntry(
        { alt_text: null, display_order: 1, extra: { link: 'https://example.org/partner' } },
        'logo',
        'https://img/logo.png'
      )
    ).toEqual({ url: 'https://img/logo.png', alt_text: null, display_order: 1, type: 'logo', link: 'https://example.org/partner' })
    expect(buildCollectionImageEntry({ alt_text: null, display_order: 0, extra: null }, null, 'u')).toEqual({
      url: 'u',
      alt_text: null,
      display_order: 0,
    })
  })
})
