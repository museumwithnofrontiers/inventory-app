import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadSiteCollectionIds } from '../../src/core/instance.js'

describe('loadSiteCollectionIds', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'instances-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('collects the collection of every gallery and exhibition site, and none for a standalone one', () => {
    writeFileSync(join(dir, 'glass.json'), JSON.stringify({ kind: 'gallery', collection_id: 'glass-uuid' }))
    writeFileSync(join(dir, 'water.json'), JSON.stringify({ kind: 'exhibition', collection_id: 'water-uuid' }))
    writeFileSync(join(dir, 'galleries.json'), JSON.stringify({ kind: 'standalone', exporter: 'galleries' }))
    writeFileSync(join(dir, 'README.md'), '# not an instance')

    expect([...loadSiteCollectionIds(dir)].sort()).toEqual(['glass-uuid', 'water-uuid'])
  })

  it('refuses a directory where no instance names a collection', () => {
    writeFileSync(join(dir, 'galleries.json'), JSON.stringify({ kind: 'standalone', exporter: 'galleries' }))
    expect(() => loadSiteCollectionIds(dir)).toThrow(/names a collection_id/)
  })

  it("reads the repository's instance files", () => {
    const instances = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'instances')
    const ids = loadSiteCollectionIds(instances)
    const carpets = JSON.parse(readFileSync(join(instances, 'carpets.json'), 'utf-8')) as {
      collection_id: string
    }
    expect(ids.has(carpets.collection_id)).toBe(true)
  })
})
