import { describe, expect, it } from 'vitest'

import { dropProjectRoots, projectRootIds } from '../../../shared/project-roots.mjs'

/**
 * M16 J5: the project's own root collection (ISL, EPM) is not a page of the
 * site, so the package leaves it out and the markers below it hang from
 * nothing.
 */
describe('project roots', () => {
  const collections = [
    { id: 'isl', parent_id: null, type: 'collection' },
    { id: 'exhibitions', parent_id: 'isl', type: 'collection' },
    { id: 'exh-1', parent_id: 'exhibitions', type: 'exhibition' },
    { id: 'epm', parent_id: null, type: 'collection' },
    { id: 'other-root', parent_id: null, type: 'collection' },
  ]

  it('leaves the roots out and gives the collections directly under them no parent', () => {
    expect(dropProjectRoots(collections, new Set(['isl', 'epm']))).toEqual([
      { id: 'exhibitions', parent_id: null, type: 'collection' },
      { id: 'exh-1', parent_id: 'exhibitions', type: 'exhibition' },
      { id: 'other-root', parent_id: null, type: 'collection' },
    ])
  })

  it('changes nothing without roots (a mini-site package)', () => {
    expect(dropProjectRoots(collections, new Set())).toBe(collections)
  })

  it("finds the roots as the parentless collections keyed like an exported project, in its context", async () => {
    const calls: { sql: string; params?: unknown[] }[] = []
    const ids = await projectRootIds(async (sql, params) => {
      calls.push({ sql, params })
      return [{ id: 'isl' }, { id: 'epm' }]
    }, ['project-isl', 'project-epm'])

    expect([...ids]).toEqual(['isl', 'epm'])
    expect(calls[0]?.sql).toContain('p.context_id = c.context_id AND p.backward_compatibility = c.backward_compatibility')
    expect(calls[0]?.sql).toContain('c.parent_id IS NULL')
    expect(calls[0]?.params).toEqual(['project-isl', 'project-epm'])
  })

  it('asks nothing for no project', async () => {
    let asked = false
    const ids = await projectRootIds(async () => {
      asked = true
      return []
    }, [])
    expect(ids.size).toBe(0)
    expect(asked).toBe(false)
  })
})
