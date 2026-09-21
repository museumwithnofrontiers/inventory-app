import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadInstance } from '../../src/core/instance.js'

/**
 * An instance file is hand-authored, so every validation failure is checked
 * individually here — the error message is the whole debugging experience for
 * whoever is wiring up the next gallery.
 */
describe('loadInstance', () => {
  let dir: string
  let originalCwd: string

  const validInstance = {
    kind: 'gallery',
    slug: 'carpets',
    name: 'Carpets',
    collection_id: '743fd119-f663-54ae-b92a-933fc1fdbfd8',
    package_name: '@museumwnf/carpets-data',
  }

  const write = (name: string, data: unknown): string => {
    const path = join(dir, name)
    writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data), 'utf-8')
    return path
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dxa-gallery-instance-'))
    originalCwd = process.cwd()
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(dir, { recursive: true, force: true })
  })

  it('loads a valid instance file by path', () => {
    const path = write('carpets.json', validInstance)

    const instance = loadInstance(path)

    expect(instance).toEqual({
      kind: 'gallery',
      slug: 'carpets',
      name: 'Carpets',
      collectionId: '743fd119-f663-54ae-b92a-933fc1fdbfd8',
      packageName: '@museumwnf/carpets-data',
    })
  })

  it('resolves a bare name against ../instances/<name>.json relative to cwd', () => {
    // cwd = <root>/exporter, instance file = <root>/instances/carpets.json —
    // mirrors both the host (`npm run export`, cwd = the exporter directory)
    // and the container (docker-entrypoint.sh cds into it first).
    const root = mkdtempSync(join(tmpdir(), 'dxa-gallery-root-'))
    try {
      const instancesDir = join(root, 'instances')
      const exporterDir = join(root, 'exporter')
      mkdirSync(instancesDir, { recursive: true })
      mkdirSync(exporterDir, { recursive: true })
      writeFileSync(join(instancesDir, 'carpets.json'), JSON.stringify(validInstance), 'utf-8')

      process.chdir(exporterDir)
      const instance = loadInstance('carpets')

      expect(instance.slug).toBe('carpets')
    } finally {
      process.chdir(originalCwd)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('treats a ref containing a path separator as a path, not a bare name', () => {
    write('nested.json', validInstance)
    process.chdir(dir)

    const instance = loadInstance('./nested.json')

    expect(instance.slug).toBe('carpets')
  })

  it('throws naming the path it looked for when the file is missing', () => {
    const missing = join(dir, 'missing.json')

    expect(() => loadInstance(missing)).toThrow(/Instance file not found/)
    expect(() => loadInstance(missing)).toThrow(missing)
  })

  it('throws on invalid JSON', () => {
    const path = write('bad.json', '{ not json')

    expect(() => loadInstance(path)).toThrow(/Invalid JSON/)
  })

  it('rejects a non-object JSON document', () => {
    const path = write('array.json', [1, 2, 3])

    expect(() => loadInstance(path)).toThrow(/must contain a JSON object/)
  })

  it('rejects an unknown field, so a typo cannot pass silently', () => {
    const path = write('typo.json', { ...validInstance, sulg: 'carpets' })

    expect(() => loadInstance(path)).toThrow(/unknown field\(s\): sulg/)
  })

  it('rejects a missing/wrong "kind"', () => {
    const path = write('no-kind.json', { ...validInstance, kind: undefined })

    expect(() => loadInstance(path)).toThrow(/must have "kind": "gallery"/)
  })

  it('points an exhibition instance at dxa-exhibition instead of failing generically', () => {
    const path = write('exhibition.json', { ...validInstance, kind: 'exhibition' })

    expect(() => loadInstance(path)).toThrow(/dxa-exhibition/)
  })

  it('rejects a slug that is not lowercase hyphen-separated', () => {
    const path = write('bad-slug.json', { ...validInstance, slug: 'Carpets_Gallery' })

    expect(() => loadInstance(path)).toThrow(/"slug"/)
  })

  it('rejects an empty name', () => {
    const path = write('bad-name.json', { ...validInstance, name: '   ' })

    expect(() => loadInstance(path)).toThrow(/"name" must be a non-empty string/)
  })

  it('rejects a collection_id that is not a lowercase UUID', () => {
    const path = write('bad-uuid.json', { ...validInstance, collection_id: 'not-a-uuid' })

    expect(() => loadInstance(path)).toThrow(/"collection_id" must be a lowercase UUID/)
  })

  it('rejects a package_name that does not match the @museumwnf/<slug>-data shape', () => {
    const path = write('bad-package.json', { ...validInstance, package_name: '@other/carpets-data' })

    expect(() => loadInstance(path)).toThrow(/"package_name" must match/)
  })
})
