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

describe('the credits as written (B4)', () => {
  const credits = {
    author_credit: 'Ghazi Bisheh.',
    copy_editor_credit: 'Mandi Gomez.',
    translator_credit: null,
    translation_copy_editor_credit: 'Margot Cortez.',
  }

  it('go back inside credits_as_written, each key in MySQL JSON order', () => {
    const extra = withItemTranslationColumns(
      { copyright: 'MWNF' },
      { ...credits, item_columns_source: 'mwnf3:objects:ISL;jo;1;1:eng' }
    ) as Record<string, Record<string, unknown>>
    expect(Object.keys(extra)).toEqual(['copyright', 'credits_as_written'])
    expect(Object.keys(extra.credits_as_written!)).toEqual(['author', 'copy_editor', 'translation_copy_editor'])
    expect(extra.credits_as_written).toEqual({
      author: 'Ghazi Bisheh.',
      copy_editor: 'Mandi Gomez.',
      translation_copy_editor: 'Margot Cortez.',
    })
  })

  it('go back as prepared_by on an Explore or a Travels text', () => {
    for (const source of ['mwnf3_travels:monuments:x:eng', 'mwnf3_explore:exploremonumentext:7:fra']) {
      expect(
        withItemTranslationColumns({ how_to_reach: 'By bus.' }, { author_credit: 'Author: Comité', item_columns_source: source })
      ).toEqual({ prepared_by: 'Author: Comité', how_to_reach: 'By bus.' })
    }
  })

  it('takes the legacy key off the row with the columns', () => {
    const [row] = restoreItemColumns([{ extra: null, author_credit: 'Ana', item_columns_source: 'mwnf3:objects:1:eng' }])
    expect(row).toEqual({ extra: { credits_as_written: { author: 'Ana' } } })
  })
})

describe('the column list', () => {
  it('names the B1 and B4 columns, as the importer moves them', () => {
    expect(ITEM_TRANSLATION_COLUMNS.map(c => `${c.key}→${c.column}`)).toEqual([
      'materials→materials',
      'description2→short_description',
      'dynasty→dynasty',
      'province→region',
      'history→history',
      'credits_as_written.author→author_credit',
      'credits_as_written.copy_editor→copy_editor_credit',
      'credits_as_written.translator→translator_credit',
      'credits_as_written.translation_copy_editor→translation_copy_editor_credit',
      'prepared_by→author_credit',
    ])
    expect(itemColumnsSelect('it')).toBe(
      'it.materials, it.short_description, it.dynasty, it.region, it.history, it.author_credit, it.copy_editor_credit, ' +
        'it.translator_credit, it.translation_copy_editor_credit, it.backward_compatibility AS item_columns_source'
    )
  })
})
