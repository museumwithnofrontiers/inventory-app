import { describe, expect, it } from 'vitest'
import { checkReadiness } from '../../src/core/readiness.js'
import type { PackageData } from '../../src/core/readiness.js'

/** A small, complete site: a root, one theme with one picture of one object. */
function site(): PackageData {
  return {
    manifest: { format: 'collection-site', root_collection_id: 'root', context_id: 'site-ctx', default_context_id: 'default-ctx' },
    collections: [
      { id: 'root', parent_id: null, cover_item_id: 'obj' },
      { id: 'theme', parent_id: 'root', display_order: 1, cover_item_id: 'pic' },
    ],
    placements: [{ id: 'pl', collection_id: 'theme', item_id: 'pic', member_id: 'obj', display_order: 1 }],
    items: [
      { id: 'obj', type: 'object', member: true, partner_id: 'museum', project_id: 'project', country_id: 'jor', start_date: 1900, images: [] },
      { id: 'pic', type: 'picture', parent_id: 'obj', images: [{ id: 'img', url: 'https://example.org/pub/img.jpg' }] },
    ],
    partners: [{ id: 'museum', country_id: 'jor' }],
    timelines: [],
    timeline_events: [],
    texts: {
      collections: { eng: { root: { title: 'Site', description: 'About it' }, theme: { title: 'Theme', description: 'Text' } } },
      items: { eng: { obj: { context_id: 'site-ctx', name: 'Object', description: 'Sheet' } } },
      partners: { eng: { museum: { name: 'Museum' } } },
    },
  }
}

const codes = (pkg: PackageData) => checkReadiness(pkg).findings.map(f => f.code)

describe('checkReadiness', () => {
  it('finds nothing to report on a complete site', () => {
    const result = checkReadiness(site())
    expect(result.languages).toEqual(['eng'])
    expect(result.findings).toEqual([])
    expect(result.textContexts).toEqual({ site: 1 })
  })

  it('a member with no text in a site language is an error', () => {
    const pkg = site()
    pkg.texts['items'] = {}
    expect(codes(pkg)).toContain('ITEM_TEXT')
  })

  it('a member counts its pictures as its images', () => {
    const pkg = site()
    pkg.items = pkg.items.map(i => ({ ...i, images: [] }))
    expect(codes(pkg)).toEqual(expect.arrayContaining(['ITEM_IMAGE', 'PLACEMENT_IMAGE']))
  })

  it('siblings without an order, or with the same one, cannot be ordered', () => {
    const pkg = site()
    pkg.collections.push({ id: 'theme-2', parent_id: 'root', display_order: 1 })
    pkg.texts['collections']!['eng']!['theme-2'] = { title: 'Second', description: 'x' }
    const order = checkReadiness(pkg).findings.find(f => f.code === 'COLLECTION_ORDER')
    expect(order?.ids).toEqual(['theme', 'theme-2'])
  })

  it('the site languages are those the root has a title in', () => {
    const pkg = site()
    pkg.texts['collections']!['fra'] = { root: { title: 'Site' } }
    const result = checkReadiness(pkg)
    expect(result.languages).toEqual(['eng', 'fra'])
    expect(result.findings.map(f => f.code)).toEqual(
      expect.arrayContaining(['ROOT_TEXT', 'COLLECTION_TITLE', 'ITEM_TEXT', 'PARTNER_NAME'])
    )
  })

  it("the site's own language builds replace the root's titles", () => {
    const pkg = site()
    pkg.texts['collections']!['deu'] = { root: { title: 'Seite' } }
    const result = checkReadiness(pkg, ['eng'])
    expect(result.languages).toEqual(['eng'])
    expect(result.findings).toEqual([])
    expect(checkReadiness(site(), ['eng', 'fra']).findings.map(f => f.code)).toContain('ROOT_TITLE')
  })

  it('a missing root title is an error', () => {
    const pkg = site()
    pkg.texts['collections']!['eng']!['root'] = { description: 'no title' }
    expect(codes(pkg)).toContain('ROOT_TITLE')
  })
})
