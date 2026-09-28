import { describe, expect, it, vi } from 'vitest'

import { Database } from '../../src/core/database.js'

/**
 * resolveProjectIds / resolveContextIds must return ids in ARGUMENT order:
 * callers pair projectIds[i] with projectKeys[i] (partner-exporter.ts), while
 * the underlying `IN (...)` query gives no ordering guarantee — the DB is free
 * to return rows in any order.
 *
 * This fork resolves through the Sharing History keyspace:
 * `mwnf3_sharing_history:sh_projects:{key}` with LOWERCASE keys (the
 * importer's formatShBackwardCompatibility convention) — uppercase input like
 * "AWE" must be lowered before lookup.
 */
describe('Database.resolveProjectIds', () => {
  it('builds lowercase SH keyspace lookups and returns ids in argument order', async () => {
    const db = new Database()
    const querySpy = vi.spyOn(db, 'query').mockResolvedValue([
      // DB order deliberately reversed vs the argument order below
      { id: 'rus-uuid', backward_compatibility: 'mwnf3_sharing_history:sh_projects:rus' },
      { id: 'awe-uuid', backward_compatibility: 'mwnf3_sharing_history:sh_projects:awe' },
    ])

    const ids = await db.resolveProjectIds(['AWE', 'rus'])

    expect(ids).toEqual(['awe-uuid', 'rus-uuid'])
    expect(querySpy).toHaveBeenCalledWith(expect.any(String), [
      'mwnf3_sharing_history:sh_projects:awe',
      'mwnf3_sharing_history:sh_projects:rus',
    ])
  })

  it('throws when a requested project is missing', async () => {
    const db = new Database()
    vi.spyOn(db, 'query').mockResolvedValue([
      { id: 'awe-uuid', backward_compatibility: 'mwnf3_sharing_history:sh_projects:awe' },
    ])

    await expect(db.resolveProjectIds(['awe', 'rus'])).rejects.toThrow(
      'Projects not found for: mwnf3_sharing_history:sh_projects:rus'
    )
  })
})

describe('Database.resolveContextIds', () => {
  it('returns ids in argument order even when the DB returns rows in another order', async () => {
    const db = new Database()
    vi.spyOn(db, 'query').mockResolvedValue([
      { id: 'rus-ctx-uuid', backward_compatibility: 'mwnf3_sharing_history:sh_projects:rus' },
      { id: 'awe-ctx-uuid', backward_compatibility: 'mwnf3_sharing_history:sh_projects:awe' },
    ])

    const ids = await db.resolveContextIds(['awe', 'rus'])

    expect(ids).toEqual(['awe-ctx-uuid', 'rus-ctx-uuid'])
  })
})
