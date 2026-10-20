/**
 * The standalone sites' texts. Cases are drawn from the legacy rows and pages
 * as they stood on 2026-10-20: a word kept in several groups (`index_today` in
 * 1 and 3, `db_alsoknowas` in 3 and 4), a page kept as one word
 * (`mission_statement_text`), a footer label ending in spaces (`footer5`), a
 * label with a trailing `<br/>` (`museum_home_pm_partners`), and
 * recommendedlinks.php's headings and links.
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import {
  buildStandaloneCatalogue,
  phpRegionHtml,
  siteGroups,
  siteWords,
  STANDALONE_SITES,
  type StandaloneSite,
  type StandaloneWordRow,
} from '../../src/standalone.js'

const row = (wordId: string, groupId: number, langId: string, value: string | null): StandaloneWordRow => ({
  wordId,
  groupId,
  langId,
  value,
})

const site = (words: StandaloneSite['words'], regions?: StandaloneSite['regions']): StandaloneSite => ({
  root: 'x',
  languages: ['ar', 'en', 'es', 'fr'],
  words,
  regions,
})

describe('buildStandaloneCatalogue', () => {
  it('keeps the highest group the page reads, as getTerm() does', () => {
    const { locales } = buildStandaloneCatalogue(
      site({ 'home.alsoKnownAs': 'db_alsoknowas' }),
      [row('db_alsoknowas', 3, 'en', 'Also known as'), row('db_alsoknowas', 4, 'en', 'Also known as:')],
      'islamicart'
    )
    expect(locales.en).toEqual({ 'islamicart.home.alsoKnownAs': 'Also known as:' })
  })

  it('reads only the groups a word names', () => {
    const { locales } = buildStandaloneCatalogue(
      site({ 'missionStatement.body': { word: 'mission_statement_text', groups: [3] } }),
      [
        row('mission_statement_text', 3, 'en', 'The <i>Discover Islamic Art</i> Virtual Museum'),
        row('mission_statement_text', 8, 'en', 'Another site'),
      ],
      'islamicart'
    )
    expect(locales.en).toEqual({
      'islamicart.missionStatement.body': 'The *Discover Islamic Art* Virtual Museum',
    })
  })

  it('writes a language only when legacy offers it, never padded', () => {
    const { locales } = buildStandaloneCatalogue(
      site({ 'footer.contact': 'footer2' }),
      [row('footer2', 3, 'en', 'Contact'), row('footer2', 3, 'fr', 'Contact'), row('footer2', 3, 'de', 'Kontakt')],
      'islamicart'
    )
    expect(Object.keys(locales)).toEqual(['en', 'fr'])
  })

  it('trims labels and drops layout breaks', () => {
    const { locales } = buildStandaloneCatalogue(
      site({ 'footer.copyright': 'footer5', 'section.partners': 'museum_home_pm_partners' }),
      [
        row('footer5', 3, 'en', '© Museum With No Frontiers (MWNF) 2004 –  '),
        row('museum_home_pm_partners', 2, 'en', 'Partners<br/>\n'),
      ],
      'islamicart'
    )
    expect(locales.en).toEqual({
      'islamicart.footer.copyright': '© Museum With No Frontiers (MWNF) 2004 –',
      'islamicart.section.partners': 'Partners',
    })
  })

  it('decodes entities in a label that carries no tag', () => {
    const { locales } = buildStandaloneCatalogue(
      site({ 'home.highlight': 'index_today' }),
      [row('index_today', 3, 'fr', 'L&rsquo;objet du jour')],
      'islamicart'
    )
    expect(locales.fr).toEqual({ 'islamicart.home.highlight': 'L’objet du jour' })
  })

  it('names the entries legacy has no English text for, and writes no blank', () => {
    const { locales, missingEnglish } = buildStandaloneCatalogue(
      site({ 'nav.portal': 'portal_link', 'nav.home': 'back_to_section' }),
      [row('portal_link', 3, 'en', 'MWNF Portal'), row('back_to_section', 3, 'en', '  ')],
      'islamicart'
    )
    expect(locales.en).toEqual({ 'islamicart.nav.portal': 'MWNF Portal' })
    expect(missingEnglish).toEqual(['nav.home'])
  })

  it('writes a PHP region in its own language, as Markdown', () => {
    const { locales } = buildStandaloneCatalogue(
      site({}, { 'links.body': { file: 'x.php', start: '<a', end: '</p>', language: 'en' } }),
      [],
      'islamicart',
      { 'links.body': '<h3>Media Partnerships</h3><h4>ISLAM.DE</h4><p><a href="http://islam.de/">http://islam.de/</a></p>' }
    )
    expect(locales.en).toEqual({
      'islamicart.links.body': '### Media Partnerships\n\n#### ISLAM.DE\n\n[http://islam.de/](http://islam.de/)',
    })
  })

  it('refuses a text with braces', () => {
    expect(() =>
      buildStandaloneCatalogue(site({ 'nav.portal': 'portal_link' }), [row('portal_link', 3, 'en', '{x}')], 'islamicart')
    ).toThrow(/braces/)
  })
})

describe('phpRegionHtml', () => {
  const region = { file: 'p.php', start: '<div class="h">', end: '</section>', language: 'en' }

  it('cuts from the first start marker to the end marker', () => {
    const source = '<?php x ?><section><div class="h"><h3><br/>One</h3></div><div class="h">Two</div></section><?php y ?>'
    expect(phpRegionHtml(source, region)).toBe('<div class="h"><h3>One</h3></div><div class="h">Two</div>')
  })

  it('replaces the named constants and refuses any other PHP', () => {
    const constants = { EXPLORE_WEBSITE_URL: 'https://explore.museumwnf.org' }
    const source = '<div class="h"><a href="<?= EXPLORE_WEBSITE_URL ?>/a.php"><?= EXPLORE_WEBSITE_URL ?>/a.php</a></div></section>'
    expect(phpRegionHtml(source, { ...region, constants })).toBe(
      '<div class="h"><a href="https://explore.museumwnf.org/a.php">https://explore.museumwnf.org/a.php</a></div>'
    )
    expect(() => phpRegionHtml('<div class="h"><?= getTerm("x") ?></section>', region)).toThrow(/PHP/)
  })

  it('drops a line break inside a link text', () => {
    const source = '<div class="h"><a href="u">http://europa.eu/a/<br/>b.htm</a></section>'
    expect(phpRegionHtml(source, region)).toBe('<div class="h"><a href="u">http://europa.eu/a/b.htm</a>')
  })

  it('ends at the first end marker after the start, and fails without one', () => {
    expect(phpRegionHtml('</section><div class="h">A</section>B</section>', region)).toBe('<div class="h">A')
    expect(() => phpRegionHtml('<div class="h"></div>', region)).toThrow(/no "<\/section>"/)
    expect(() => phpRegionHtml('</section>', region)).toThrow(/not found/)
  })
})

describe('STANDALONE_SITES', () => {
  it('reads Islamic Art from the groups its pages load', () => {
    expect(siteGroups(STANDALONE_SITES.islamicart!)).toEqual([2, 3, 4])
    expect(siteWords(STANDALONE_SITES.islamicart!)['missionStatement.body']).toEqual({
      word: 'mission_statement_text',
      groups: [3],
    })
  })

  // The legacy checkout is git-ignored; the test reads it when it is there
  // (LEGACY_CODE_PATH in a container, the repository's .legacy-code otherwise).
  const root = process.env['LEGACY_CODE_PATH'] ?? join(process.cwd(), '../../.legacy-code')
  const legacy = join(root, STANDALONE_SITES.islamicart!.root, 'recommendedlinks.php')
  it.runIf(existsSync(legacy))('reads every Recommended Link from the PHP', () => {
    const html = phpRegionHtml(readFileSync(legacy, 'utf8'), STANDALONE_SITES.islamicart!.regions!['recommendedLinks.body']!)
    expect(html.match(/class="media_partnerships"/g)).toHaveLength(27)
    expect(html.match(/class="short_heading"/g)).toHaveLength(8)
  })
})

