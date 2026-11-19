import { describe, expect, it } from 'vitest'
import {
  descriptionKey,
  placementTranslationsSelect,
  restorePlacementTranslations,
  withPlacementTranslations,
} from '../../../shared/placement-translations.mjs'

const text = (lang: string, columns: Record<string, string | null>) => ({
  lang,
  title: null,
  description: null,
  curator_justification: null,
  partner_justification: null,
  justification: null,
  caption: null,
  item_name: null,
  item_date: null,
  item_location: null,
  item_museum: null,
  item_dynasty: null,
  item_artist: null,
  item_material: null,
  backward_compatibility: null,
  ...columns,
})

describe('withPlacementTranslations', () => {
  it("puts an mwnf3 page's texts back under their keys, in MySQL JSON key order", () => {
    const extra = withPlacementTranslations(null, {
      placement_collection_source: 'mwnf3:exhibition_pages:264',
      placement_translations: JSON.stringify([
        text('ita', { item_name: 'Fontana', description: 'Una fontana.' }),
        text('eng', { item_name: 'Fountain', item_date: '1650', item_dynasty: 'Barberini', description: 'A fountain.', title: 'The Vision Fountain' }),
      ]),
    }) as Record<string, Record<string, string>>
    expect(Object.keys(extra)).toEqual(['item_date', 'item_name', 'detail_name', 'item_dynasty', 'detail_justification'])
    expect(Object.keys(extra.item_name)).toEqual(['eng', 'ita'])
    expect(extra).toEqual({
      item_date: { eng: '1650' },
      item_name: { eng: 'Fountain', ita: 'Fontana' },
      detail_name: { eng: 'The Vision Fountain' },
      item_dynasty: { eng: 'Barberini' },
      detail_justification: { eng: 'A fountain.', ita: 'Una fontana.' },
    })
  })

  it("gives a thematic gallery theme's description back as contextual_descriptions, with its legacy keys", () => {
    expect(
      withPlacementTranslations(null, {
        placement_collection_source: 'mwnf3_thematic_gallery:theme:55:11',
        placement_translations: [
          text('eng', {
            description: 'A gold medal.',
            caption: 'Orientalist painting (detail)',
            backward_compatibility: 'mwnf3_thematic_gallery:theme_item_i18n:55:11:16:en',
          }),
        ],
      })
    ).toEqual({
      image_captions: { eng: 'Orientalist painting (detail)' },
      source_bc_by_language: { eng: 'mwnf3_thematic_gallery:theme_item_i18n:55:11:16:en' },
      contextual_descriptions: { eng: 'A gold medal.' },
    })
  })

  it('rebuilds the justifications: a pair with its nulls, or the National Context text', () => {
    expect(
      withPlacementTranslations('{"curator_status": "Y"}', {
        placement_collection_source: 'mwnf3_sharing_history:sh_exhibition_themes:1',
        placement_translations: [
          text('fra', { partner_justification: 'Moment important.' }),
          text('eng', { curator_justification: 'A dwelling.', partner_justification: '' }),
        ],
      })
    ).toEqual({
      curator_status: 'Y',
      justifications: {
        eng: { curator: 'A dwelling.', partner: '' },
        fra: { curator: null, partner: 'Moment important.' },
      },
    })
    expect(
      withPlacementTranslations(null, {
        placement_collection_source: 'mwnf3_sharing_history:sh_national_context_exhibitions:3',
        placement_translations: [text('fra', { justification: 'Moment important.' })],
      })
    ).toEqual({ justifications: { fra: 'Moment important.' } })
  })

  it('leaves extra as it came when the placement has no texts', () => {
    expect(withPlacementTranslations(null, { placement_translations: null })).toBeNull()
    expect(withPlacementTranslations('{"membership": "project"}', { placement_translations: null })).toBe(
      '{"membership": "project"}'
    )
  })
})

describe('descriptionKey', () => {
  it('is detail_justification on an mwnf3 collection only', () => {
    expect(descriptionKey('mwnf3:artintro_pages:12')).toBe('detail_justification')
    expect(descriptionKey('mwnf3_travels:trail:1')).toBe('contextual_descriptions')
    expect(descriptionKey(null)).toBe('contextual_descriptions')
  })
})

describe('restorePlacementTranslations', () => {
  it('restores each row and removes the selected columns', () => {
    const rows = restorePlacementTranslations([
      {
        extra: null,
        placement_translations: [text('eng', { item_museum: 'Museo Nacional' })],
        placement_collection_source: 'mwnf3:exhibitions:3',
      },
    ])
    expect(rows).toEqual([{ extra: { item_museum: { eng: 'Museo Nacional' } } }])
  })

  it('selects the translations of the aliased placement', () => {
    const select = placementTranslationsSelect('ci')
    expect(select).toContain('pt_t.collection_item_id = ci.id')
    expect(select).toContain('pt_c.id = ci.collection_id')
  })
})
