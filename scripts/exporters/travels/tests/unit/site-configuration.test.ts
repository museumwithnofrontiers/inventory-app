import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  loadSiteConfiguration,
  withSiteCollectionExtra,
  withSiteTranslationExtra,
  type SiteRecord,
} from '../../../shared/site-configuration.mjs'

const directory = (files: Record<string, unknown>): string => {
  const path = mkdtempSync(join(tmpdir(), 'instances-'))
  for (const [name, data] of Object.entries(files)) writeFileSync(join(path, name), JSON.stringify(data))
  return path
}

describe('loadSiteConfiguration', () => {
  it('reads each instance file\'s collections by uuid', () => {
    const records = loadSiteConfiguration(
      directory({ 'a.json': { slug: 'a', collections: { c1: { extra: { logos: [] } } } }, 'b.json': { slug: 'b' } })
    )
    expect([...records.keys()]).toEqual(['c1'])
  })

  it('fails on a collection two files hold, naming both', () => {
    const path = directory({
      'a.json': { collections: { c1: { extra: {} } } },
      'b.json': { collections: { c1: { extra: {} } } },
    })
    expect(() => loadSiteConfiguration(path)).toThrow('Collection c1 is in two instance files: a.json and b.json')
  })
})

describe('withSiteCollectionExtra / withSiteTranslationExtra', () => {
  const records = new Map<string, SiteRecord>([
    [
      'c1',
      {
        extra: { thg_gallery: { slug: 's' } },
        translation_extra: { legacy_exhibition: { project_id: 'ISL' } },
        translations: { fra: { exhibition_i18n: { heading: 'h' } } },
      },
    ],
  ])

  it('gives a collection its keys back, in MySQL JSON key order', () => {
    expect(JSON.stringify(withSiteCollectionExtra('{"further_readings":[]}', 'c1', records))).toBe(
      '{"thg_gallery":{"slug":"s"},"further_readings":[]}'
    )
    expect(withSiteCollectionExtra(null, 'c2', records)).toBeNull()
  })

  it('gives a text the shared keys and its own language\'s', () => {
    expect(withSiteTranslationExtra(null, 'c1', 'fra', records)).toEqual({
      exhibition_i18n: { heading: 'h' },
      legacy_exhibition: { project_id: 'ISL' },
    })
    expect(withSiteTranslationExtra(null, 'c1', 'eng', records)).toEqual({ legacy_exhibition: { project_id: 'ISL' } })
  })
})
