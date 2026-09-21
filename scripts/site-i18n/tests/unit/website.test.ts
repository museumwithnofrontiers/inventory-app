/**
 * The website layout: only a site's own legacy keys (`galleryCredits`, and for a
 * gallery `galleryAbout`), renamed into the keys the viewer-i18n dictionary
 * expects. Cases are drawn from the shape verified against carpets, amulets,
 * water-in-islam and the-use-of-colours-in-art on `origin/main`, 2026-09-21:
 * galleries carry `<ns>.credits.body` and `gallery.about.body`, exhibitions carry
 * `<ns>.credits.body` only.
 */
import { describe, expect, it } from 'vitest'

import { buildWebsiteCatalogue, NAMESPACE_PATTERN, websiteKeyMapping } from '../../src/website.js'
import { mergeTranslationGroups } from '../../src/extract.js'
import type { MessageCatalogue, TranslationRow } from '../../src/core/types.js'

const row = (wordId: string, langId: string, value: string | null): TranslationRow => ({
  wordId,
  langId,
  value,
})

describe('websiteKeyMapping', () => {
  it('maps both site-owned keys for a gallery', () => {
    expect(websiteKeyMapping('gallery', 'carpets')).toEqual({
      galleryCredits: 'carpets.credits.body',
      galleryAbout: 'gallery.about.body',
    })
  })

  it('maps only galleryCredits for an exhibition — there is no About page', () => {
    expect(websiteKeyMapping('exhibition', 'waterInIslam')).toEqual({
      galleryCredits: 'waterInIslam.credits.body',
    })
  })
})

describe('buildWebsiteCatalogue', () => {
  it('emits both keys for a gallery that has both in legacy', () => {
    const { messages } = mergeTranslationGroups(
      [],
      [
        row('galleryAbout', 'en', 'Ceramics blurb'),
        row('galleryCredits', 'en', 'Ceramics credits'),
        row('searchHowTo', 'en', 'How to search'),
      ]
    )

    const { locales, notEmitted, missing } = buildWebsiteCatalogue(messages, 'gallery', 'carpets')

    expect(locales).toEqual({
      en: {
        'carpets.credits.body': 'Ceramics credits',
        'gallery.about.body': 'Ceramics blurb',
      },
    })
    expect(missing).toEqual([])
    expect(notEmitted).toEqual(['searchHowTo'])
  })

  it('emits only credits for an exhibition, and lists galleryAbout as not emitted when legacy has it', () => {
    // No exhibition actually has galleryAbout in legacy, but the mapping must
    // still name it as withheld if a row happened to exist, rather than
    // silently treating it as covered.
    const { messages } = mergeTranslationGroups(
      [],
      [row('galleryCredits', 'en', 'Exhibition credits'), row('galleryAbout', 'en', 'Ignored for exhibitions')]
    )

    const { locales, notEmitted } = buildWebsiteCatalogue(messages, 'exhibition', 'waterInIslam')

    expect(locales).toEqual({ en: { 'waterInIslam.credits.body': 'Exhibition credits' } })
    expect(notEmitted).toEqual(['galleryAbout'])
  })

  it('produces a locale file with one key when legacy has only credits in that locale', () => {
    const { messages } = mergeTranslationGroups(
      [],
      [
        row('galleryCredits', 'en', 'Credits (en)'),
        row('galleryAbout', 'en', 'About (en)'),
        row('galleryCredits', 'fr', 'Crédits (fr)'),
      ]
    )

    const { locales } = buildWebsiteCatalogue(messages, 'gallery', 'carpets')

    expect(locales['fr']).toEqual({ 'carpets.credits.body': 'Crédits (fr)' })
    expect(Object.keys(locales['fr']!)).toHaveLength(1)
  })

  it('never pads a locale the site does not own with English — a locale missing both keys gets no file', () => {
    const { messages } = mergeTranslationGroups(
      [],
      [row('galleryCredits', 'en', 'Credits'), row('searchHowTo', 'de', 'Suchen')]
    )

    const { locales } = buildWebsiteCatalogue(messages, 'gallery', 'carpets')

    expect(Object.keys(locales)).toEqual(['en'])
  })

  it('reports a site-owned key missing in English rather than emitting a key with no value', () => {
    const { messages } = mergeTranslationGroups([], [row('galleryCredits', 'fr', 'Crédits seulement')])

    const { locales, missing } = buildWebsiteCatalogue(messages, 'gallery', 'carpets')

    expect(missing).toEqual(['galleryAbout', 'galleryCredits'])
    expect(locales['en']).toBeUndefined()
    // fr is still written — the missing check is English-only, per site.
    expect(locales['fr']).toEqual({ 'carpets.credits.body': 'Crédits seulement' })
  })

  it('converts a legacy HTML fragment to Markdown once, upstream in mergeTranslationGroups', () => {
    const { messages } = mergeTranslationGroups(
      [],
      [
        row(
          'galleryCredits',
          'en',
          'Line one<br>Line two, <b>bold</b> and <a href="https://example.org/">a link</a>.'
        ),
      ]
    )

    const { locales } = buildWebsiteCatalogue(messages, 'gallery', 'carpets')

    expect(locales['en']?.['carpets.credits.body']).toBe(
      'Line one  \nLine two, **bold** and [a link](https://example.org/).'
    )
  })

  it('sorts locales and keys so a re-run is byte-identical', () => {
    const { messages } = mergeTranslationGroups(
      [],
      [
        row('galleryCredits', 'fr', 'Crédits'),
        row('galleryCredits', 'en', 'Credits'),
        row('galleryAbout', 'en', 'About'),
      ]
    )

    const { locales } = buildWebsiteCatalogue(messages, 'gallery', 'carpets')

    expect(Object.keys(locales)).toEqual(['en', 'fr'])
    expect(Object.keys(locales['en']!)).toEqual(['carpets.credits.body', 'gallery.about.body'])
  })

  it('does not mutate the merged catalogue — the flat layout stays unaffected by this code path', () => {
    const { messages } = mergeTranslationGroups(
      [row('download', 'en', 'Download'), row('download', 'fr', 'Télécharger')],
      [
        row('galleryAbout', 'en', 'Ceramics blurb'),
        row('galleryCredits', 'en', 'Ceramics credits'),
        row('goToFullSearch', 'ar', 'الانتقال إلى البحث الكامل'),
      ]
    )
    const before: MessageCatalogue = JSON.parse(JSON.stringify(messages))

    buildWebsiteCatalogue(messages, 'gallery', 'carpets')

    expect(messages).toEqual(before)
  })
})

describe('NAMESPACE_PATTERN', () => {
  it('accepts the real namespaces in use', () => {
    for (const ns of ['carpets', 'amulets', 'waterInIslam', 'colours']) {
      expect(NAMESPACE_PATTERN.test(ns)).toBe(true)
    }
  })

  it('rejects hyphens, digits leading, uppercase leading and empty strings', () => {
    for (const ns of ['water-in-islam', '9carpets', 'Carpets', '', 'carpets ']) {
      expect(NAMESPACE_PATTERN.test(ns)).toBe(false)
    }
  })
})
