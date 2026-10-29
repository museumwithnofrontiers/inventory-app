import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import { minisiteDepths } from '../../src/exporters/collection-exporter.js'
import { loadMinisiteInstances } from '../../src/minisite/instance.js'

/**
 * An exhibition that is a mini-site of its own keeps, in this site's package,
 * only what this site shows of it; the exporter finds those exhibitions in
 * the mini-site instances that name this site as their parent, and treats
 * each by its depth below the exhibition.
 */
describe('mini-site exhibitions in the parent package', () => {
  it('measures every collection below an exhibition: 0 the exhibition, 1 a theme, 2 a page', () => {
    const collections = [
      { id: 'root', parent_id: null },
      { id: 'exh', parent_id: 'root' },
      { id: 'theme', parent_id: 'exh' },
      { id: 'page', parent_id: 'theme' },
      { id: 'other', parent_id: 'root' },
    ]
    expect([...minisiteDepths(collections, ['exh', 'absent'])]).toEqual([
      ['exh', 0],
      ['theme', 1],
      ['page', 2],
    ])
  })

  it('lists the mini-sites of one parent site only', () => {
    const dir = mkdtempSync(join(tmpdir(), 'instances-'))
    const instance = (slug: string, parent: string, id: string) =>
      writeFileSync(
        join(dir, `${slug}.json`),
        JSON.stringify({
          kind: 'minisite',
          slug,
          name: slug,
          exporter: 'baroqueart',
          parent,
          collection_id: id,
          package_name: `@museumwnf/${slug}-data`,
        })
      )
    instance('baroqueart-absolutism', 'baroqueart', '00000000-0000-4000-8000-000000000001')
    instance('islamicart-water', 'islamicart', '00000000-0000-4000-8000-000000000002')
    writeFileSync(join(dir, 'carpets.json'), JSON.stringify({ kind: 'gallery', slug: 'carpets' }))

    expect(loadMinisiteInstances('baroqueart', dir).map(i => i.slug)).toEqual(['baroqueart-absolutism'])
  })
})
