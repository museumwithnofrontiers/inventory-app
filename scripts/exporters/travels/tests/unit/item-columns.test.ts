import { describe, expect, it } from 'vitest'
import {
  ITEM_TRANSLATION_COLUMNS,
  itemColumnsSelect,
  restoreItemColumns,
  withItemTranslationColumns,
} from '../../../shared/item-columns.mjs'

describe('withItemTranslationColumns', () => {
  it('puts each column back under its legacy key, in MySQL JSON key order', () => {
    const extra = withItemTranslationColumns(
      { copyright: 'MWNF', photographer: 'Ana' },
      { materials: 'Brass', region: 'Damascus', short_description: 'A basin.', dynasty: null }
    ) as Record<string, unknown>
    expect(Object.keys(extra)).toEqual(['province', 'copyright', 'materials', 'description2', 'photographer'])
    expect(extra).toMatchObject({ materials: 'Brass', province: 'Damascus', description2: 'A basin.' })
    expect(extra).not.toHaveProperty('dynasty')
  })

  it('reads an extra given as a JSON string', () => {
    expect(withItemTranslationColumns('{"keywords": "basin"}', { history: 'Built in 1277.' })).toEqual({
      history: 'Built in 1277.',
      keywords: 'basin',
    })
  })

  it('makes an extra when the translation has only columns', () => {
    expect(withItemTranslationColumns(null, { dynasty: 'Mamluk' })).toEqual({ dynasty: 'Mamluk' })
  })

  it('leaves extra as it came when no column holds a text', () => {
    expect(withItemTranslationColumns(null, { materials: null })).toBeNull()
    const extra = '{"b": 1}'
    expect(withItemTranslationColumns(extra, {})).toBe(extra)
  })

  it('keeps an empty text, which is a value', () => {
    expect(withItemTranslationColumns(null, { history: '' })).toEqual({ history: '' })
  })
})

describe('restoreItemColumns', () => {
  it('moves the columns into extra and takes them off the row', () => {
    const rows = restoreItemColumns([
      { item_id: 'i1', extra: null, materials: 'Glass', short_description: null, dynasty: null, region: null, history: null },
    ])
    expect(rows).toEqual([{ item_id: 'i1', extra: { materials: 'Glass' } }])
  })
})

describe('the column list', () => {
  it('names the five B1 columns, as the importer moves them', () => {
    expect(ITEM_TRANSLATION_COLUMNS.map(c => `${c.key}→${c.column}`)).toEqual([
      'materials→materials',
      'description2→short_description',
      'dynasty→dynasty',
      'province→region',
      'history→history',
    ])
    expect(itemColumnsSelect('it')).toBe('it.materials, it.short_description, it.dynasty, it.region, it.history')
  })
})
