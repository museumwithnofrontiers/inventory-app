import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import { loadMinisiteInstance, type MinisiteInstance } from '../../src/minisite/instance.js'
import { resolveScope } from '../../src/minisite/scope.js'

/**
 * A mini-site's package is read from the database, narrowed to one collection
 * subtree: its collections, the items they place (a picture placement as its
 * parent item) with their parent records, and the partners it names.
 */
const ROOT = '00000000-0000-4000-8000-000000000001'
const CURATOR = '00000000-0000-4000-8000-0000000000aa'

const instance: MinisiteInstance = {
  kind: 'minisite',
  slug: 'parent-exhibition',
  name: 'Exhibition',
  exporter: 'islamicart',
  parent: 'parent',
  collectionId: ROOT,
  partnerIds: [CURATOR],
  packageName: '@museumwnf/parent-exhibition-data',
  legacyUrl: 'https://example.org/exhibitions/one/',
}

const collections = [
  { id: ROOT, parent_id: 'site' },
  { id: 'theme', parent_id: ROOT },
  { id: 'page', parent_id: 'theme' },
  { id: 'elsewhere', parent_id: 'site' },
]
const items = [
  { id: 'monument', type: 'monument', parent_id: null },
  { id: 'monument-picture-2', type: 'picture', parent_id: 'monument' },
  { id: 'detail', type: 'detail', parent_id: 'monument' },
  { id: 'coin', type: 'object', parent_id: null },
  { id: 'other', type: 'object', parent_id: null },
]
const placements = [
  { collection_id: ROOT, item_id: 'coin' },
  { collection_id: 'page', item_id: 'monument-picture-2' },
  { collection_id: 'page', item_id: 'detail' },
  { collection_id: 'elsewhere', item_id: 'other' },
]

/** The few queries resolveScope makes, answered from the arrays above. */
const db = {
  query: async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
    const ids = new Set(params as string[])
    if (sql.includes('FROM collections WHERE id =')) return collections.filter(c => ids.has(c.id)).map(c => ({ id: c.id })) as T[]
    if (sql.includes('FROM collections WHERE parent_id')) return collections.filter(c => ids.has(c.parent_id)).map(c => ({ id: c.id })) as T[]
    if (sql.includes('FROM collection_item')) {
      return placements
        .filter(p => ids.has(p.collection_id))
        .map(p => items.find(i => i.id === p.item_id)!)
        .map(i => ({ id: i.type === 'picture' ? i.parent_id : i.id })) as T[]
    }
    if (sql.includes('SELECT DISTINCT parent_id AS id FROM items')) {
      return items.filter(i => ids.has(i.id) && i.parent_id).map(i => ({ id: i.parent_id })) as T[]
    }
    if (sql.includes('FROM partners')) return [CURATOR].filter(id => ids.has(id)).map(id => ({ id })) as T[]
    throw new Error(`unexpected query: ${sql}`)
  },
}

describe('resolveScope', () => {
  it('keeps the collection and everything under it, nothing beside it', async () => {
    const scope = await resolveScope(db, instance)
    expect(scope.collectionIds).toEqual([ROOT, 'theme', 'page'])
  })

  it('keeps the placed items, a picture placement as its parent item, and their parent records', async () => {
    const scope = await resolveScope(db, instance)
    expect(scope.itemIds).toEqual(['coin', 'detail', 'monument'])
  })

  it('keeps the partners the instance names, and describes the mini-site', async () => {
    const scope = await resolveScope(db, instance)
    expect(scope).toMatchObject({
      key: 'parent-exhibition',
      rootCollectionId: ROOT,
      legacyUrl: 'https://example.org/exhibitions/one/',
      parentKey: 'parent',
      partnerIds: [CURATOR],
    })
  })

  it('fails on a collection or partner the database does not have', async () => {
    await expect(resolveScope(db, { ...instance, collectionId: '00000000-0000-4000-8000-00000000ffff' })).rejects.toThrow(
      'No collection'
    )
    await expect(
      resolveScope(db, { ...instance, partnerIds: ['00000000-0000-4000-8000-00000000ffff'] })
    ).rejects.toThrow('No partner')
  })
})

describe('loadMinisiteInstance', () => {
  const write = (data: unknown): string => {
    const file = join(mkdtempSync(join(tmpdir(), 'minisite-')), 'instance.json')
    writeFileSync(file, JSON.stringify(data))
    return file
  }
  const valid = {
    kind: 'minisite',
    slug: 'parent-exhibition',
    name: 'Exhibition',
    exporter: 'islamicart',
    parent: 'parent',
    collection_id: ROOT,
    partner_ids: [CURATOR],
    package_name: '@museumwnf/parent-exhibition-data',
    legacy_url: 'https://example.org/exhibitions/one/',
  }

  it('reads a valid instance', () => {
    expect(loadMinisiteInstance(write(valid))).toEqual(instance)
  })

  it('rejects an unknown field, a non-UUID collection and a bad partner list', () => {
    expect(() => loadMinisiteInstance(write({ ...valid, colection_id: ROOT }))).toThrow('unknown field "colection_id"')
    expect(() => loadMinisiteInstance(write({ ...valid, collection_id: 'mwnf3:exhibitions:10' }))).toThrow('is not a UUID')
    expect(() => loadMinisiteInstance(write({ ...valid, partner_ids: ['mwnf3:museums:Mus01:jo'] }))).toThrow(
      '"partner_ids" must be a list of partner UUIDs'
    )
  })
})
