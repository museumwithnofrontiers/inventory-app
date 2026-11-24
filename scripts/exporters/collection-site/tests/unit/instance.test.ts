import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateInstance } from '../../src/core/instance.js'

const valid = {
  kind: 'collection',
  slug: 'the-hijaz-railway-collection',
  name: 'The Hijaz Railway',
  collection_id: '9884c4d0-416a-5d95-8365-a92d158c2065',
  package_name: '@museumwnf/the-hijaz-railway-collection-data',
}

describe('validateInstance', () => {
  it('accepts the five fields of a collection site', () => {
    expect(validateInstance(valid)).toEqual(valid)
  })

  it('the example instance file is valid', () => {
    const example: unknown = JSON.parse(readFileSync(new URL('../../examples/the-hijaz-railway.json', import.meta.url), 'utf8'))
    expect(validateInstance(example).collection_id).toBe(valid.collection_id)
  })

  it('refuses another kind, naming why', () => {
    expect(() => validateInstance({ ...valid, kind: 'exhibition' })).toThrow(/kind must be "collection"/)
  })

  it('refuses site settings in the instance file: they belong to the site', () => {
    expect(() => validateInstance({ ...valid, languages_enabled: ['en'] })).toThrow(/unknown field "languages_enabled"/)
    expect(() => validateInstance({ ...valid, collections: {} })).toThrow(/unknown field "collections"/)
  })

  it('names every problem at once', () => {
    let message = ''
    try {
      validateInstance({ kind: 'collection', slug: 'Bad Slug', name: '', collection_id: 'x', package_name: 'nope' })
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toMatch(/slug/)
    expect(message).toMatch(/name/)
    expect(message).toMatch(/collection_id/)
    expect(message).toMatch(/package_name/)
  })
})
