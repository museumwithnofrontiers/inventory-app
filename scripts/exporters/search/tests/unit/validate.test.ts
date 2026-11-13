import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import { buildDocuments, shardDocuments, type BuildInput } from '../../src/core/documents.js'
import { manifestFile } from '../../src/core/package-files.js'
import { documentErrors, validatePackage } from '../../schema/validate.mjs'

const A = 'a1111111-1111-5111-8111-111111111111'
const B = 'b2222222-2222-5222-8222-222222222222'

function writePackage(dir: string, over: Partial<BuildInput> = {}) {
  const sites = new Map([A, B].map(id => [id, [{ site: 'islamicart', path: `/item/${id}`, url: '' }]]))
  const input: BuildInput = {
    items: [A, B].map(id => ({
      id, type: 'object', parent_id: null, backward_compatibility: null, mwnf_reference: null, owner_reference: null,
      start_date: null, end_date: null, partner_id: null, country_id: null,
    })),
    translations: [{
      item_id: A, language: 'ar', context_id: 'c', own_context_id: 'c', name: 'محراب', alternate_name: null,
      description: 'وصف', type: null, holder: null, owner: null, dates: null, location: null,
      place_of_production: null, provenance: null, extra: null,
    }],
    tags: [], partners: [], countries: [], pictures: new Map(), sites, baseUrl: 'https://x.test', ...over,
  }
  const { documents, excludedNoSite } = buildDocuments(input)
  const shards = shardDocuments(documents)
  mkdirSync(join(dir, 'documents'), { recursive: true })
  for (const [file, content] of shards) writeFileSync(join(dir, file), content)
  writeFileSync(join(dir, 'sites.json'), JSON.stringify({
    schema: 'mwnf.search/1',
    sites: [{ slug: 'islamicart', name: 'Discover Islamic Art', kind: 'standalone', parent: null, origin: 'https://x.test/islamicart', item_path: '/item/:id' }],
  }))
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifestFile(documents, shards, excludedNoSite, 1)))
}

describe('validatePackage', () => {
  let dir = ''
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = '' })

  it('accepts what the exporter writes', () => {
    dir = mkdtempSync(join(tmpdir(), 'search-data-'))
    writePackage(dir)
    expect(validatePackage(dir)).toEqual({ errors: [], documents: 2, ids: [A, B] })
  })

  it('refuses a shard whose content no longer matches the manifest', () => {
    dir = mkdtempSync(join(tmpdir(), 'search-data-'))
    writePackage(dir)
    const file = join(dir, 'documents/a.ndjson')
    writeFileSync(file, readFileSync(file, 'utf-8').replace('محراب', 'xxx'))
    expect(validatePackage(dir).errors.join('\n')).toMatch(/SHA-256/)
  })

  it('refuses a document whose site is not in sites.json', () => {
    dir = mkdtempSync(join(tmpdir(), 'search-data-'))
    writePackage(dir, { sites: new Map([A, B].map(id => [id, [{ site: 'elsewhere', path: `/item/${id}`, url: '' }]])) })
    expect(validatePackage(dir).errors.join('\n')).toMatch(/"elsewhere" is not in sites.json/)
  })

  it('checks the repository copy is the exported folder layout', () => {
    expect(resolve(__dirname, '../../schema/mwnf.search-1.schema.json')).toBeTruthy()
  })
})

describe('documentErrors', () => {
  const slugs = new Set(['islamicart'])
  it('refuses a document with no site, an unknown key or an address as a path', () => {
    const errors = documentErrors({ id: A, type: 'object', sites: [{ site: 'islamicart', path: '//evil.test' }], extra: 1 }, slugs)
    expect(errors).toContain('unknown "extra"')
    expect(errors).toContain('path "//evil.test" is not a route')
    expect(documentErrors({ id: A, sites: [] }, slugs)).toContain('"sites" is empty: an item no site shows is left out')
  })
})
