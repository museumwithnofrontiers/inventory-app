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

describe('the keyword and artist lines (B2, B3)', () => {
  it('go back under their legacy keys, as written', () => {
    const extra = withItemTranslationColumns(null, {
      keywords: 'Basin; ablution',
      artist_period_of_activity: 'About 1300',
      scribe: 'Ibn al-Bawwab',
      artist_birth_place: 'Cairo (?)',
    }) as Record<string, unknown>
    expect(extra).toEqual({
      scriber: 'Ibn al-Bawwab',
      keywords: 'Basin; ablution',
      period_activity: 'About 1300',
      artist_birthplace: 'Cairo (?)',
    })
    expect(Object.keys(extra)).toEqual(['scriber', 'keywords', 'period_activity', 'artist_birthplace'])
  })
})

describe('the status (B6)', () => {
  it('goes back as legacy_display_status N when hidden', () => {
    expect(withItemTranslationColumns({ copyright: 'MWNF' }, { status: 'hidden' })).toEqual({
      copyright: 'MWNF',
      legacy_display_status: 'N',
    })
  })

  it('adds nothing for a published or unedited translation', () => {
    expect(withItemTranslationColumns(null, { status: 'published' })).toBeNull()
    expect(withItemTranslationColumns(null, { status: 'unedited' })).toBeNull()
  })
})

describe('the column list', () => {
  it('names the B1 to B6 columns, as the importer moves them', () => {
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
      'keywords→keywords',
      'artist→artist',
      'period_activity→artist_period_of_activity',
      'artist_birthdate→artist_birth_date',
      'artist_birthplace→artist_birth_place',
      'artist_deathdate→artist_death_date',
      'artist_deathplace→artist_death_place',
      'workshop→workshop',
      'scriber→scribe',
      'patrons→patrons',
      'architects→architects',
      'linkcatalogs→catalogue_references',
      'notice→notice',
      'notice_c→external_notice',
      'legacy_display_status→status',
      'third_name→original_name',
      'archival→archival_reference',
      'holding_institution_org→holder_original_name',
      'external_sources→external_sources',
      'second_name→alternate_name',
    ])
    expect(
      itemColumnsSelect('it').startsWith(
        'it.materials, it.short_description, it.dynasty, it.region, it.history, it.author_credit, it.copy_editor_credit, ' +
          'it.translator_credit, it.translation_copy_editor_credit, it.keywords, it.artist, it.artist_period_of_activity, ' +
          'it.artist_birth_date, it.artist_birth_place, it.artist_death_date, it.artist_death_place, it.workshop, it.scribe, ' +
          'it.patrons, it.architects, it.catalogue_references, it.notice, it.external_notice, it.status, it.original_name, it.archival_reference, ' +
          'it.holder_original_name, it.external_sources, ' +
          'it.backward_compatibility AS item_columns_source, it.alternate_name AS item_columns_scoped_alternate_name, '
      )
    ).toBe(true)
    // F1: the picture image's fields, read through the translation's item.
    expect(itemColumnsSelect('it')).toContain('WHERE ic_ii.item_id = it.item_id')
    expect(itemColumnsSelect('it')).toContain("JSON_CONTAINS_PATH(ic_t.extra, 'one', '$.photographer')) AS item_columns_picture_photographer_kept")
  })
})

describe("a picture's photographer and credit (F1)", () => {
  const picture = (fields: Record<string, unknown>) => ({
    item_id: 'pic-1',
    extra: '{"legacy_type": "d"}',
    item_columns_picture_photographer: null,
    item_columns_picture_credit: null,
    item_columns_picture_copyright: null,
    item_columns_picture_photographer_kept: 0,
    item_columns_picture_copyright_kept: 0,
    ...fields,
  })

  it("go back from the image, the copyright without the importer's mark, in MySQL JSON order", () => {
    const [row] = restoreItemColumns([
      picture({ item_columns_picture_photographer: 'Ana', item_columns_picture_copyright: '© Museo X' }),
    ])
    expect(row).toEqual({ item_id: 'pic-1', extra: { copyright: 'Museo X', legacy_type: 'd', photographer: 'Ana' } })
    expect(Object.keys(row!.extra as unknown as Record<string, unknown>)).toEqual(['copyright', 'legacy_type', 'photographer'])
  })

  it('prints credit before copyright', () => {
    const [row] = restoreItemColumns([
      picture({ item_columns_picture_credit: 'Wikimedia Commons', item_columns_picture_copyright: null }),
    ])
    expect(row!.extra).toEqual({ copyright: 'Wikimedia Commons', legacy_type: 'd' })
  })

  it('leaves the rows of a picture that keeps its own texts as they are', () => {
    const [row] = restoreItemColumns([
      picture({
        extra: '{"photographer": "Anna"}',
        item_columns_picture_photographer: 'Ana',
        item_columns_picture_copyright: '© Museo X',
        item_columns_picture_photographer_kept: 1,
        item_columns_picture_copyright_kept: 1,
      }),
    ])
    expect(row).toEqual({ item_id: 'pic-1', extra: '{"photographer": "Anna"}' })
  })

  it("adds nothing to a row that isn't a picture's", () => {
    const extra = '{"copyright": "Copyright image: Museo X"}'
    const [row] = restoreItemColumns([picture({ extra })])
    expect(row).toEqual({ item_id: 'pic-1', extra })
  })
})

describe("an object's rights line (F1)", () => {
  it('goes back as copyright from image_rights', () => {
    const [row] = restoreItemColumns([{ item_id: 'o1', extra: null, image_rights: 'Copyright image: Museo X.' }])
    expect(row).toEqual({ item_id: 'o1', extra: { copyright: 'Copyright image: Museo X.' } })
    expect(itemColumnsSelect('it')).toContain('it.image_rights')
  })
})

describe("an object's catalogue page (F3)", () => {
  it('goes back as catalogue_holding_link from the item link in the row language', () => {
    const [row] = restoreItemColumns([
      { item_id: 'i1', extra: '{"binding_desc": "x"}', item_columns_catalogue_link: 'https://museum.example.org/1' },
    ])
    expect(row).toEqual({
      item_id: 'i1',
      extra: { binding_desc: 'x', catalogue_holding_link: 'https://museum.example.org/1' },
    })
    expect(itemColumnsSelect('it')).toContain("ic_l.type = 'catalogue' AND ic_l.language_id = it.language_id")
  })
})

describe("Sharing History's second name and Also known as (B7)", () => {
  const sh = 'mwnf3_sharing_history:sh_objects:awe:es:31:eng'

  it('gives a Sharing History alternate_name back as second_name and name2 back as alternate_name', () => {
    const [row] = restoreItemColumns([
      { item_id: 'i1', alternate_name: 'Russian kettle', extra: '{"name2": "Kettle", "keywords": "tea"}', item_columns_source: sh, item_columns_scoped_alternate_name: 'Russian kettle' },
    ])
    expect(row).toEqual({ item_id: 'i1', alternate_name: 'Kettle', extra: { keywords: 'tea', second_name: 'Russian kettle' } })
    expect(Object.keys(row!.extra as unknown as Record<string, unknown>)).toEqual(['keywords', 'second_name'])
  })

  it('leaves a Sharing History text without a name2 with no alternate_name', () => {
    const [row] = restoreItemColumns([
      { item_id: 'i1', alternate_name: 'Imaret of Mohammed Ali', extra: null, item_columns_source: sh, item_columns_scoped_alternate_name: 'Imaret of Mohammed Ali' },
    ])
    expect(row).toEqual({ item_id: 'i1', alternate_name: null, extra: { second_name: 'Imaret of Mohammed Ali' } })
  })

  it("takes the one name2 off extra, leaving null when it was the only key", () => {
    const [row] = restoreItemColumns([
      { item_id: 'i1', alternate_name: null, extra: { name2: 'Moorish Sketches' }, item_columns_source: sh, item_columns_scoped_alternate_name: null },
    ])
    expect(row).toEqual({ item_id: 'i1', alternate_name: 'Moorish Sketches', extra: null })
  })

  it("leaves any other text's alternate_name and extra as they are", () => {
    const extra = '{"name2": "x"}'
    const [row] = restoreItemColumns([
      { item_id: 'i1', alternate_name: 'Kurşunlu Mosque', extra, item_columns_source: 'mwnf3:monuments:ISL;al;1;1:eng', item_columns_scoped_alternate_name: 'Kurşunlu Mosque' },
    ])
    expect(row).toEqual({ item_id: 'i1', alternate_name: 'Kurşunlu Mosque', extra })
  })
})

describe("a picture's per-language credits (B7)", () => {
  const picture = (fields: Record<string, unknown>) => ({
    item_id: 'pic-1',
    extra: null,
    item_columns_picture_photographer: 'Ana',
    item_columns_picture_credit: null,
    item_columns_picture_copyright: '© Benaki Museum',
    item_columns_picture_photographer_kept: 0,
    item_columns_picture_copyright_kept: 0,
    item_columns_picture_photographer_own: null,
    item_columns_picture_copyright_own: null,
    item_columns_picture_photographer_per_language: 0,
    item_columns_picture_copyright_per_language: 0,
    ...fields,
  })

  it("give each language only its own text, as written, not the image's", () => {
    const [greek] = restoreItemColumns([
      picture({ item_columns_picture_copyright_per_language: 1, item_columns_picture_copyright_own: 'Μουσείο Μπενάκη' }),
    ])
    expect(greek!.extra).toEqual({ copyright: 'Μουσείο Μπενάκη', photographer: 'Ana' })
  })

  it('leave a language legacy left empty without a credit', () => {
    const [arabic] = restoreItemColumns([picture({ item_columns_picture_copyright_per_language: 1 })])
    expect(arabic!.extra).toEqual({ photographer: 'Ana' })
  })

  it("keep F1's rule for a picture without per-language texts", () => {
    const [row] = restoreItemColumns([picture({})])
    expect(row!.extra).toEqual({ copyright: 'Benaki Museum', photographer: 'Ana' })
  })
})
