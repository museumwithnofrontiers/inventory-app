import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

import { loadInstance, resolveInstancePath } from '../../src/core/instance.js'

const VALID = {
  kind: 'exhibition',
  slug: 'the-use-of-colours-in-art',
  name: 'The Use of Colours in Art',
  collection_id: '3854e510-66bb-5f9a-a6b8-dd1193551c88',
  package_name: '@museumwnf/the-use-of-colours-in-art-data',
}

describe('resolveInstancePath', () => {
  it('resolves a bare name to ../instances/<name>.json relative to cwd', () => {
    const path = resolveInstancePath('water-in-islam')
    expect(path).toBe(resolve(process.cwd(), '..', 'instances', 'water-in-islam.json'))
  })

  it('treats a value containing a slash as a path relative to cwd', () => {
    const path = resolveInstancePath('fixtures/water-in-islam.json')
    expect(path).toBe(resolve(process.cwd(), 'fixtures/water-in-islam.json'))
  })

  it('treats a value containing a backslash as a path relative to cwd', () => {
    const path = resolveInstancePath('fixtures\\water-in-islam.json')
    expect(path).toBe(resolve(process.cwd(), 'fixtures\\water-in-islam.json'))
  })

  it('treats a bare value ending in .json as a path relative to cwd', () => {
    const path = resolveInstancePath('water-in-islam.json')
    expect(path).toBe(resolve(process.cwd(), 'water-in-islam.json'))
  })
})

describe('loadInstance', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dxa-instance-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const write = (data: unknown, filename = 'instance.json'): string => {
    const path = join(dir, filename)
    writeFileSync(path, JSON.stringify(data), 'utf-8')
    return path
  }

  it('loads a valid instance file by path', () => {
    const path = write(VALID)
    const instance = loadInstance(path)
    expect(instance).toEqual({
      kind: 'exhibition',
      slug: 'the-use-of-colours-in-art',
      name: 'The Use of Colours in Art',
      collectionId: '3854e510-66bb-5f9a-a6b8-dd1193551c88',
      packageName: '@museumwnf/the-use-of-colours-in-art-data',
    })
  })

  it('resolves a bare name against ../instances/ next to the exporter directory', () => {
    const exporterDir = join(dir, 'dxa-exhibition')
    const instancesDir = join(dir, 'instances')
    mkdirSync(exporterDir, { recursive: true })
    mkdirSync(instancesDir, { recursive: true })
    writeFileSync(join(instancesDir, 'the-use-of-colours-in-art.json'), JSON.stringify(VALID), 'utf-8')

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(exporterDir)
    try {
      const instance = loadInstance('the-use-of-colours-in-art')
      expect(instance.slug).toBe('the-use-of-colours-in-art')
    } finally {
      cwdSpy.mockRestore()
    }
  })

  it('says where it looked when the file is missing', () => {
    const missing = join(dir, 'nope.json')
    expect(() => loadInstance(missing)).toThrow(missing)
    expect(() => loadInstance(missing)).toThrow('not found')
  })

  it('rejects malformed JSON', () => {
    const path = join(dir, 'broken.json')
    writeFileSync(path, '{ not json', 'utf-8')
    expect(() => loadInstance(path)).toThrow('not valid JSON')
  })

  it('rejects an unknown field', () => {
    const path = write({ ...VALID, extra_field: 'nope' })
    expect(() => loadInstance(path)).toThrow('unknown field')
  })

  it('refuses a gallery instance with a pointer to dxa-gallery', () => {
    const path = write({ ...VALID, kind: 'gallery' })
    expect(() => loadInstance(path)).toThrow('dxa-gallery')
  })

  it('rejects a kind that is neither exhibition nor gallery', () => {
    const path = write({ ...VALID, kind: 'theme' })
    expect(() => loadInstance(path)).toThrow("kind: 'exhibition'")
  })

  it.each([
    ['uppercase', 'The-Use-Of-Colours'],
    ['underscores', 'the_use_of_colours'],
    ['leading dash', '-the-use'],
    ['double dash', 'the--use'],
    ['empty', ''],
  ])('rejects a slug that is not lowercase kebab-case (%s)', (_label, slug) => {
    const path = write({ ...VALID, slug })
    expect(() => loadInstance(path)).toThrow("'slug'")
  })

  it('rejects an empty name', () => {
    const path = write({ ...VALID, name: '   ' })
    expect(() => loadInstance(path)).toThrow("'name'")
  })

  it('rejects a collection_id that is not a lowercase UUID', () => {
    const path = write({ ...VALID, collection_id: 'not-a-uuid' })
    expect(() => loadInstance(path)).toThrow("'collection_id'")
  })

  it('rejects an uppercase UUID for collection_id', () => {
    const path = write({ ...VALID, collection_id: VALID.collection_id.toUpperCase() })
    expect(() => loadInstance(path)).toThrow("'collection_id'")
  })

  it('rejects a package_name that does not match @museumwnf/<slug>-data', () => {
    const path = write({ ...VALID, package_name: '@other/the-use-of-colours-in-art-data' })
    expect(() => loadInstance(path)).toThrow("'package_name'")
  })
})
