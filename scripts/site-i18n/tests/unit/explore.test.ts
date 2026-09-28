/**
 * Explore's texts: the five home words of `mwnf3_explore.translation` and the
 * pages of `explore_pages_langs`, as the Explore site's own entries. Cases are
 * drawn from the legacy rows as they stood on 2026-09-28: English only, one
 * page with no text (the home page's row), HTML with `<b>`, `<i>`, `<br/>` and
 * links.
 */
import { describe, expect, it } from 'vitest'

import { buildExploreCatalogue, type ExplorePageRow } from '../../src/explore.js'
import type { TranslationRow } from '../../src/core/types.js'

const word = (wordId: string, langId: string, value: string | null): TranslationRow => ({
  wordId,
  langId,
  value,
})

const page = (
  pagename: string,
  langId: string,
  title: string | null,
  description: string | null
): ExplorePageRow => ({ pagename, langId, title, description })

describe('buildExploreCatalogue', () => {
  it('writes each page as a title and a body, in Markdown', () => {
    const { locales } = buildExploreCatalogue(
      [
        page('Credits', 'en', 'Credits', '<b>Credits for the material</b><br/>\n<br/>\nImage credits'),
        page('Get Involved', 'en', 'Get Involved', 'Join <i>Explore with MWNF</i>.'),
      ],
      [],
      'explore'
    )

    expect(locales).toEqual({
      en: {
        'explore.credits.body': '**Credits for the material**  \n  \nImage credits',
        'explore.credits.title': 'Credits',
        'explore.getInvolved.body': 'Join *Explore with MWNF*.',
        'explore.getInvolved.title': 'Get Involved',
      },
    })
  })

  it('writes the home words under home', () => {
    const { locales } = buildExploreCatalogue(
      [],
      [
        word('Home-Leitmotif', 'en', 'Virtual tours unveil the magnificence of little-known monuments.'),
        word(
          'Home-Description',
          'en',
          'Click <a href="https://explore.museumwnf.org/about">About</a> to know more.'
        ),
      ],
      'explore'
    )

    expect(locales['en']).toEqual({
      'explore.home.description': 'Click [About](https://explore.museumwnf.org/about) to know more.',
      'explore.home.leitmotif': 'Virtual tours unveil the magnificence of little-known monuments.',
    })
  })

  it('keeps a language to what legacy has in it, and English always', () => {
    const { locales } = buildExploreCatalogue(
      [page('About', 'es', 'Acerca de', 'Texto')],
      [word('Home-Leitmotif', 'es', '')],
      'explore'
    )

    expect(locales).toEqual({
      en: {},
      es: { 'explore.about.body': 'Texto', 'explore.about.title': 'Acerca de' },
    })
  })

  it('keeps the first value of a word stored in more than one group', () => {
    const { locales } = buildExploreCatalogue(
      [],
      [word('Home-Leitmotif', 'en', 'First'), word('Home-Leitmotif', 'en', 'Second')],
      'explore'
    )

    expect(locales['en']).toEqual({ 'explore.home.leitmotif': 'First' })
  })

  it("lists a page with a text but no section, and ignores the home page's empty row", () => {
    const { locales, notEmitted } = buildExploreCatalogue(
      [page('', 'en', '', null), page('Press', 'en', 'Press', 'Contacts')],
      [],
      'explore'
    )

    expect(notEmitted).toEqual(['Press'])
    expect(locales).toEqual({ en: {} })
  })

  it("unwraps legacy's vue-i18n literals", () => {
    const { locales } = buildExploreCatalogue(
      [page('Important Information', 'en', 'Important Information', "Write to info{'@'}museumwnf.org")],
      [],
      'explore'
    )

    expect(locales['en']!['explore.importantInformation.body']).toBe('Write to info@museumwnf.org')
  })
})
