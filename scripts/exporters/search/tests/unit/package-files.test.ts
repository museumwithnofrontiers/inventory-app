import { execFileSync, spawnSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import { loadSites, SLUG, type Site } from '../../../shared/sites.mjs'
import { manifestFile, sitesFile } from '../../src/core/package-files.js'

const PLAN = resolve(__dirname, '../../../instances/plan.mjs')

const site = (over: Partial<Site>): Site => ({
  slug: 'islamicart',
  kind: 'standalone',
  name: 'Discover Islamic Art',
  parent: null,
  origin: 'https://museumwithnofrontiers.github.io/islamicart',
  itemPath: '/item/:id',
  rule: null,
  ...over,
})

describe('sitesFile, the slug whitelist', () => {
  it('lists every instance file, the search site included, sorted by slug', () => {
    const sites = loadSites()
    const file = sitesFile(sites)
    expect(file.sites).toHaveLength(sites.length)
    expect(file.sites.map(s => s.slug)).toEqual([...file.sites.map(s => s.slug)].sort())
    const search = file.sites.find(s => s.slug === 'search')
    expect(search).toMatchObject({ kind: 'search', origin: 'https://museumwithnofrontiers.github.io/search' })
    for (const entry of file.sites) {
      expect(entry.slug).toMatch(SLUG)
      expect(entry.origin.startsWith('https://')).toBe(true)
    }
  })

  it('keeps a mini-site parent and its name', () => {
    const file = sitesFile(loadSites())
    const mini = file.sites.find(s => s.kind === 'minisite')
    expect(mini?.parent).toBeTruthy()
    expect(mini?.name).toBeTruthy()
  })

  it.each(['../x', 'Islamic', 'a--b', '-a', 'a/b', 'https://evil.test', ''])('refuses the slug %j', slug => {
    expect(() => sitesFile([site({ slug })])).toThrow()
  })

  it.each([
    'http://plain.test/site',
    'javascript:alert(1)',
    'https://user:pw@host.test/site',
    'https://host.test/site?x=1',
    'https://host.test/site#frag',
  ])('refuses the origin %j', origin => {
    expect(() => sitesFile([site({ origin })])).toThrow()
  })
})

describe('the instance files', () => {
  let dir = ''
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = ''
  })

  it('refuse a malformed slug when the sites are loaded', () => {
    dir = mkdtempSync(join(tmpdir(), 'instances-'))
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ kind: 'standalone', slug: 'Bad Slug', package_name: 'x' }))
    expect(() => loadSites(dir)).toThrow(/slug/)
  })

  it('plan the search instance in the batch', () => {
    const out = execFileSync('node', [PLAN, resolve(__dirname, '../../../instances'), 'search'], { encoding: 'utf-8' })
    expect(out.trim().split('\t')).toEqual(['search', 'search', '-', '@museumwnf/search-data', 'search'])
  })

  it('refuse a search instance without an exporter', () => {
    dir = mkdtempSync(join(tmpdir(), 'instances-'))
    writeFileSync(join(dir, 'search.json'), JSON.stringify({ kind: 'search', slug: 'search', package_name: 'x' }))
    const result = spawnSync('node', [PLAN, dir], { encoding: 'utf-8' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('kind "search" requires')
  })
})

describe('manifestFile', () => {
  it('counts documents per type and language and hashes each shard', () => {
    const shards = new Map([
      ['documents/0.ndjson', ''],
      ['documents/a.ndjson', '{"id":"a"}\n{"id":"a2"}\n'],
    ])
    const docs = [
      { type: 'object', languages: ['ar', 'en'] },
      { type: 'monument', languages: ['en'] },
    ] as never
    const m = manifestFile(docs, shards, 3, 90)
    expect(m.schema).toBe('mwnf.search/1')
    expect(m.counts).toEqual({
      documents: 2,
      excluded_no_site: 3,
      by_type: { monument: 1, object: 1 },
      by_language: { ar: 1, en: 2 },
      sites: 90,
    })
    expect(m.languages).toEqual(['ar', 'en'])
    expect(m.shards[0]).toMatchObject({ file: 'documents/0.ndjson', documents: 0 })
    expect(m.shards[1]).toMatchObject({ file: 'documents/a.ndjson', documents: 2 })
    expect(m.shards[1].sha256).toMatch(/^[0-9a-f]{64}$/)
  })
})
