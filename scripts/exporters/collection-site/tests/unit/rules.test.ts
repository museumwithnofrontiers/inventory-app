import { describe, expect, it } from 'vitest'
import { collectTree, compact, memberIds, pickTexts, toNumber, topOf } from '../../src/core/rules.js'
import type { PlacedItem } from '../../src/core/rules.js'

describe('collectTree (R1)', () => {
  const rows = [
    { id: 'root', parent_id: null },
    { id: 'theme-1', parent_id: 'root' },
    { id: 'theme-2', parent_id: 'root' },
    { id: 'sub-1', parent_id: 'theme-1' },
    { id: 'other', parent_id: null },
    { id: 'other-child', parent_id: 'other' },
  ]

  it('takes the root and everything below it, parents first', () => {
    expect(collectTree(rows, 'root').map(r => r.id)).toEqual(['root', 'theme-1', 'theme-2', 'sub-1'])
  })

  it('leaves out an excluded collection with its subtree', () => {
    expect(collectTree(rows, 'root', new Set(['theme-1', 'sub-1'])).map(r => r.id)).toEqual(['root', 'theme-2'])
  })

  it('is empty when the root is unknown or excluded', () => {
    expect(collectTree(rows, 'missing')).toEqual([])
    expect(collectTree(rows, 'root', new Set(['root']))).toEqual([])
  })

  it('a site rooted below the top holds only its own subtree', () => {
    expect(collectTree(rows, 'theme-1').map(r => r.id)).toEqual(['theme-1', 'sub-1'])
  })
})

describe('memberIds (R2)', () => {
  const items: PlacedItem[] = [
    { id: 'obj', type: 'object', parent_id: null },
    { id: 'pic', type: 'picture', parent_id: 'obj' },
    { id: 'mon', type: 'monument', parent_id: null },
    { id: 'det', type: 'detail', parent_id: 'mon' },
    { id: 'det-pic', type: 'picture', parent_id: 'det' },
  ]
  const byId = new Map(items.map(i => [i.id, i]))

  it('a placed picture or detail stands for its object or monument', () => {
    const placed = [byId.get('pic')!, byId.get('det-pic')!, byId.get('obj')!, byId.get('det')!]
    expect(memberIds(placed, byId)).toEqual(['obj', 'mon'])
  })

  it('topOf climbs at most to the grandparent', () => {
    expect(topOf(byId.get('det-pic')!, byId).id).toBe('mon')
    expect(topOf({ id: 'orphan', type: 'picture', parent_id: 'gone' }, byId).id).toBe('orphan')
  })
})

describe('pickTexts (R3)', () => {
  const texts = [
    { language_id: 'eng', context_id: 'default', name: 'default en' },
    { language_id: 'eng', context_id: 'project', name: 'project en' },
    { language_id: 'fra', context_id: 'default', name: 'default fr' },
    { language_id: 'ara', context_id: 'elsewhere', name: 'elsewhere ar' },
  ]

  it("takes the site's context, then the Project's, then the default, per language", () => {
    const picked = pickTexts(texts, ['site', 'project', 'default'])
    expect([...picked.keys()]).toEqual(['eng', 'fra'])
    expect(picked.get('eng')!.name).toBe('project en')
    expect(picked.get('fra')!.name).toBe('default fr')
  })

  it('prefers a text written in the site context', () => {
    const picked = pickTexts([...texts, { language_id: 'eng', context_id: 'site', name: 'site en' }], ['site', 'project', 'default'])
    expect(picked.get('eng')!.name).toBe('site en')
  })

  it('skips an item with no Project and never takes a context outside the order', () => {
    const picked = pickTexts(texts, ['site', null, 'default'])
    expect(picked.get('eng')!.name).toBe('default en')
    expect(picked.has('ara')).toBe(false)
  })
})

describe('compact and toNumber', () => {
  it('drops null, undefined and empty strings, keeps zero and false', () => {
    expect(compact({ a: null, b: undefined, c: '', d: 0, e: false, f: 'x' })).toEqual({ d: 0, e: false, f: 'x' })
  })

  it('reads DECIMAL strings as numbers', () => {
    expect(toNumber('31.12345678')).toBe(31.12345678)
    expect(toNumber(null)).toBeNull()
    expect(toNumber('n/a')).toBeNull()
  })
})
