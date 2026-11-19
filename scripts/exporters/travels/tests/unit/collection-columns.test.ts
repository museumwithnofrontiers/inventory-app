import { describe, expect, it } from 'vitest'
import {
  COLLECTION_TRANSLATION_COLUMNS,
  collectionColumnsSelect,
  restoreCollectionColumns,
  withCollectionTranslationColumns,
} from '../../../shared/collection-columns.mjs'

describe('withCollectionTranslationColumns', () => {
  it('puts each column back under its legacy key, in MySQL JSON key order', () => {
    const extra = withCollectionTranslationColumns(
      { introd_type: 'L', et_title: 'Trail' },
      { subtitle: 'Along the Nile', duration: 'One day', introduction: null }
    ) as Record<string, unknown>
    expect(Object.keys(extra)).toEqual(['duration', 'et_title', 'subtitle', 'introd_type'])
    expect(extra).toMatchObject({ subtitle: 'Along the Nile', duration: 'One day' })
  })

  it('gives a mwnf3 text its introduction back as intro_text', () => {
    expect(
      withCollectionTranslationColumns(null, {
        introduction: 'The **Umayyads**.',
        collection_columns_source: 'mwnf3:exhibition_fields:20:eng',
      })
    ).toEqual({ intro_text: 'The **Umayyads**.' })
  })

  it('gives any other text its introduction back as introduction', () => {
    expect(
      withCollectionTranslationColumns('{"author": "x"}', {
        introduction: 'The trail.',
        collection_columns_source: 'mwnf3_travels:itinerary:GPA:pt:1',
      })
    ).toEqual({ author: 'x', introduction: 'The trail.' })
    expect(withCollectionTranslationColumns(null, { introduction: 'New.' })).toEqual({ introduction: 'New.' })
  })

  it('leaves extra as it came when no column holds a text', () => {
    expect(withCollectionTranslationColumns(null, { subtitle: null })).toBeNull()
    const extra = '{"b": 1}'
    expect(withCollectionTranslationColumns(extra, {})).toBe(extra)
  })
})

describe('restoreCollectionColumns', () => {
  it('moves the columns into extra and takes them off the row', () => {
    const rows = restoreCollectionColumns([
      {
        collection_id: 'c1',
        extra: null,
        subtitle: 'S',
        introduction: null,
        duration: null,
        collection_columns_source: null,
      },
    ])
    expect(rows).toEqual([{ collection_id: 'c1', extra: { subtitle: 'S' } }])
  })
})

describe('the column list', () => {
  it('names the E1 columns, as the importer moves them', () => {
    expect(COLLECTION_TRANSLATION_COLUMNS.map(c => `${c.key}→${c.column}`)).toEqual([
      'subtitle→subtitle',
      'intro_text→introduction',
      'introduction→introduction',
      'duration→duration',
    ])
    expect(collectionColumnsSelect('ct')).toBe(
      'ct.subtitle, ct.introduction, ct.duration, ct.backward_compatibility AS collection_columns_source'
    )
  })
})
