import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertNoDraftItems,
  itemIdShipped,
  itemShipped,
  loadDraftCollectionIds,
  loadDraftItemIds,
  textShipped,
} from '../../../shared/drafts.mjs'

const DRAFT = '11111111-1111-4111-8111-111111111111'
const DETAIL = '22222222-2222-4222-8222-222222222222'
const PICTURE = '33333333-3333-4333-8333-333333333333'
const PUBLISHED = '44444444-4444-4444-8444-444444444444'

describe('itemShipped, itemIdShipped and textShipped', () => {
  it('checks the item, its parent and its grandparent, with subquery aliases of its own', () => {
    const sql = itemShipped('i')
    expect(sql).toContain('i.draft = 0')
    expect(sql).toContain('dr_p_i.id = i.parent_id')
    expect(sql).toContain('dr_p_i.draft = 1')
    expect(sql).toContain('dr_g_i.id = dr_p_i.parent_id AND dr_g_i.draft = 1')
    // Two uses in one query do not collide.
    expect(itemShipped('pic')).toContain('dr_p_pic')
    expect(itemShipped('pic')).not.toContain('dr_p_i ')
  })

  it("lets a reference column through when it is null or names a shipped item", () => {
    const sql = itemIdShipped('p.monument_item_id', 'dr_m')
    expect(sql).toMatch(/^NOT EXISTS \(SELECT 1 FROM items dr_m WHERE dr_m\.id = p\.monument_item_id AND NOT \(dr_m\.draft = 0/)
  })

  it('leaves out a draft text', () => {
    expect(textShipped('it')).toBe('it.draft = 0')
  })
})

describe('loadDraftCollectionIds', () => {
  it('returns every draft collection and every collection under it, any depth', async () => {
    const asked: string[] = []
    const query = async (sql: string) => {
      asked.push(sql)
      return [
        { id: 'root', parent_id: null, draft: 0 },
        { id: 'exhibition', parent_id: 'root', draft: 1 },
        { id: 'theme', parent_id: 'exhibition', draft: 0 },
        { id: 'page', parent_id: 'theme', draft: false },
        { id: 'other', parent_id: 'root', draft: 0 },
        { id: 'hidden-theme', parent_id: 'other', draft: true },
      ]
    }
    expect([...(await loadDraftCollectionIds(query))].sort()).toEqual(['exhibition', 'hidden-theme', 'page', 'theme'])
    expect(asked[0]).toMatch(/SELECT id, parent_id, draft FROM collections/)
  })

  it('returns nothing when no collection is a draft', async () => {
    const query = vi.fn(async () => [{ id: 'root', parent_id: null, draft: 0 }])
    expect((await loadDraftCollectionIds(query)).size).toBe(0)
  })
})

describe('loadDraftItemIds', () => {
  it('returns every draft item with its details and their pictures', async () => {
    const query = vi.fn(async (sql: string) =>
      sql.includes('WHERE draft = 1')
        ? [{ id: DRAFT }]
        : [
            { id: DRAFT, parent_id: null, draft: 1 },
            { id: DETAIL, parent_id: DRAFT, draft: 0 },
            { id: PICTURE, parent_id: DETAIL, draft: 0 },
            { id: PUBLISHED, parent_id: null, draft: 0 },
          ]
    )
    expect([...(await loadDraftItemIds(query))].sort()).toEqual([DRAFT, DETAIL, PICTURE].sort())
  })

  it('does not read the hierarchy when no item is a draft', async () => {
    const query = vi.fn(async () => [])
    expect((await loadDraftItemIds(query)).size).toBe(0)
    expect(query).toHaveBeenCalledTimes(1)
  })
})

describe('assertNoDraftItems', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'drafts-guard-'))
    mkdirSync(join(dir, 'translations'))
    writeFileSync(join(dir, 'items.json'), JSON.stringify([{ id: PUBLISHED, related_items: [] }]))
    writeFileSync(join(dir, 'translations', 'en.json'), JSON.stringify({ [PUBLISHED]: { name: 'A' } }))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const draftsOf = (ids: string[]) =>
    vi.fn(async (sql: string) =>
      sql.includes('WHERE draft = 1')
        ? ids.map(id => ({ id }))
        : ids.map(id => ({ id, parent_id: null, draft: 1 }))
    )

  it('passes without reading a file when no item is a draft', async () => {
    const query = draftsOf([])
    await expect(assertNoDraftItems(query, join(dir, 'missing'))).resolves.toBeUndefined()
  })

  it('passes when drafts exist but no file names one', async () => {
    await expect(assertNoDraftItems(draftsOf([DRAFT]), dir)).resolves.toBeUndefined()
  })

  it('fails naming each file and the draft id it holds, wherever it is', async () => {
    writeFileSync(
      join(dir, 'items.json'),
      JSON.stringify([{ id: PUBLISHED, related_items: [{ id: DRAFT.toUpperCase() }] }])
    )
    writeFileSync(join(dir, 'translations', 'en.json'), JSON.stringify({ [DRAFT]: { name: 'Draft' } }))
    const error = await assertNoDraftItems(draftsOf([DRAFT]), dir).then(
      () => null,
      (e: unknown) => e as Error
    )
    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toContain(`${join(dir, 'items.json')}: ${DRAFT}`)
    expect(error!.message).toContain(`${join(dir, 'translations', 'en.json')}: ${DRAFT}`)
  })

  it('stops after twenty hits', async () => {
    for (let n = 0; n < 25; n++) writeFileSync(join(dir, `file-${String(n).padStart(2, '0')}.json`), DRAFT)
    const error = await assertNoDraftItems(draftsOf([DRAFT]), dir).then(
      () => null,
      (e: unknown) => e as Error
    )
    expect(error!.message.split('\n').filter(line => line.includes(DRAFT))).toHaveLength(20)
    expect(error!.message).toContain('stopped after 20')
  })
})
