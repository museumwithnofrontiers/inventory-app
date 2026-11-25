import { describe, expect, it, vi } from 'vitest'
import {
  COLLECTION_CREDIT_CATEGORIES,
  creditKey,
  loadCollectionCredits,
  mysqlJsonOrder,
  withCollectionCredits,
} from '../../../shared/credits.mjs'

describe('withCollectionCredits', () => {
  it('puts the credits back under their keys, in MySQL JSON key order', () => {
    const extra = withCollectionCredits(
      { subtitle: 'Along the Nile', region_territory: 'Upper Egypt' },
      { curated_by: 'Curated by Ana', photo_by: 'Photos: Ana' }
    ) as Record<string, unknown>
    expect(Object.keys(extra)).toEqual(['photo_by', 'subtitle', 'curated_by', 'region_territory'])
    expect(extra.curated_by).toBe('Curated by Ana')
  })

  it('makes an extra when the translation has only credits', () => {
    expect(withCollectionCredits(null, { source_text_author: '' })).toEqual({ source_text_author: '' })
  })

  it('leaves extra as it is without credits', () => {
    const extra = { b: 1, a: 2 }
    expect(withCollectionCredits(extra, undefined)).toBe(extra)
    expect(withCollectionCredits(null, undefined)).toBeNull()
  })
})

describe('mysqlJsonOrder', () => {
  it('orders by byte length, then bytes', () => {
    expect(Object.keys(mysqlJsonOrder({ bb: 1, a: 1, ab: 1, é: 1, z: 1 }))).toEqual(['a', 'z', 'ab', 'bb', 'é'])
  })
})

describe('loadCollectionCredits', () => {
  it('reads the visible credit contributors, by translation', async () => {
    const query = vi.fn().mockResolvedValue([
      { collection_id: 'c1', language_id: 'eng', context_id: 'x', category: 'author', name: 'Ana', description: null },
      { collection_id: 'c1', language_id: 'eng', context_id: 'x', category: 'exhibition_credits', name: null, description: 'Text: Ana' },
      { collection_id: 'c1', language_id: 'fra', context_id: 'x', category: 'source_text_author', name: null, description: null },
    ])

    const credits = await loadCollectionCredits(query, ['c1'])

    // The two renamed credits ship under their new key only (#2795).
    expect(credits.get(creditKey('c1', 'eng', 'x'))).toEqual({ author: 'Ana', exhibition_credits: 'Text: Ana' })
    expect(credits.get(creditKey('c1', 'fra', 'x'))).toEqual({ source_text_author: '' })
    const [sql, params] = query.mock.calls[0] as [string, string[]]
    expect(sql).toContain('c.visible = 1')
    expect(params).toEqual(['c1', ...COLLECTION_CREDIT_CATEGORIES])
  })

  it('asks nothing for no collection', async () => {
    const query = vi.fn()
    expect((await loadCollectionCredits(query, [])).size).toBe(0)
    expect(query).not.toHaveBeenCalled()
  })
})
