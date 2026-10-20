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
  rewriteLinks,
  siteGroups,
  siteWords,
  STANDALONE_SITES,
  type StandaloneSite,
  type StandaloneWordRow,
} from '../../src/standalone.js'
import {
  composeBaroqueSponsors,
  countryKey,
  localTeamLine,
  STANDALONE_TABLES,
  teamLine,
  type TeamRow,
} from '../../src/standalone-tables.js'

const row = (wordId: string, groupId: number, langId: string, value: string | null): StandaloneWordRow => ({
  wordId,
  groupId,
  langId,
  value,
})

const site = (words: StandaloneSite['words'], regions?: StandaloneSite['regions']): StandaloneSite => ({
  root: 'x',
  host: 'https://legacy.example.org',
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
    expect(missingEnglish).toEqual(['islamicart.nav.home'])
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

  it('writes an override under the shared entry it overrides', () => {
    const withOverride = { ...site({}), overrides: { 'record.action.viewShortDescription': 'pc_view_sdesc' } }
    const { locales } = buildStandaloneCatalogue(
      withOverride,
      [row('pc_view_sdesc', 4, 'en', 'View Short Description')],
      'islamicart'
    )
    expect(locales.en).toEqual({ 'record.action.viewShortDescription': 'View Short Description' })
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

  it('drops every comment, a nested one included', () => {
    const source = '<div class="h">A<!--x-->B<!-<!---->-C--></section>'
    expect(phpRegionHtml(source, region)).toBe('<div class="h">AB')
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
  it('reads each site from the groups its pages load', () => {
    expect(siteGroups(STANDALONE_SITES.islamicart!)).toEqual([2, 3, 4, 61])
    expect(siteGroups(STANDALONE_SITES.baroqueart!)).toEqual([2, 3, 4])
    expect(siteGroups(STANDALONE_SITES.sharinghistory!)).toEqual([2, 3, 13])
    expect(siteWords(STANDALONE_SITES.islamicart!, 'islamicart')['islamicart.missionStatement.body']).toEqual({
      words: ['mission_statement_text'],
      groups: [3],
    })
  })

  it('names a builder for every table a site reads', () => {
    for (const site of Object.values(STANDALONE_SITES)) {
      for (const name of site.tables ?? []) expect(STANDALONE_TABLES[name], name).toBeTypeOf('function')
    }
  })

  // The legacy checkouts are git-ignored; the tests read them when they are
  // there (LEGACY_CODE_PATH in a container, the repository's .legacy-code otherwise).
  const root = process.env['LEGACY_CODE_PATH'] ?? join(process.cwd(), '../../.legacy-code')
  const legacy = join(root, STANDALONE_SITES.islamicart!.root, 'recommendedlinks.php')
  it.runIf(existsSync(legacy))('reads every Recommended Link from the PHP', () => {
    const html = phpRegionHtml(readFileSync(legacy, 'utf8'), STANDALONE_SITES.islamicart!.regions!['recommendedLinks.body']!)
    expect(html.match(/class="media_partnerships"/g)).toHaveLength(27)
    expect(html.match(/class="short_heading"/g)).toHaveLength(8)
  })

  const credits = join(root, STANDALONE_SITES.baroqueart!.root, 'mwnf_credit.php')
  it.runIf(existsSync(credits))("reads Baroque Art's credits once, without the back link or the commented-out blocks", () => {
    const html = phpRegionHtml(readFileSync(credits, 'utf8'), STANDALONE_SITES.baroqueart!.regions!['credits.body']!)
    expect(html).toContain('DISCOVER BAROQUE ART CREDITS')
    expect(html).not.toContain('GENERAL CREDITS')
    expect(html).not.toContain('history.go(-1)')
    expect(html).not.toContain('hidden_large')
  })
})

describe('legacy links in a text', () => {
  const linked = { ...site({}), links: { 'partners.php': '#/partners', 'pm_partner_list.php?type=museum': '#/partners?type=museum' } }

  it('points a rebuilt page at its route, query or not', () => {
    expect(rewriteLinks('<a href="partners.php">Austria</a>', linked)).toBe('<a href="#/partners">Austria</a>')
    expect(rewriteLinks('<a href="partners.php?lng=en">Austria</a>', linked)).toBe('<a href="#/partners">Austria</a>')
    expect(rewriteLinks('<a href="https://legacy.example.org/pm_partner_list.php?type=museum">x</a>', linked)).toBe(
      '<a href="#/partners?type=museum">x</a>'
    )
  })

  it('makes any other legacy page absolute, and leaves other addresses alone', () => {
    expect(rewriteLinks("<a href='hcr_home.php'>x</a>", linked)).toBe("<a href='https://legacy.example.org/hcr_home.php'>x</a>")
    expect(rewriteLinks('<a href="https://www.museumwnf.org/">x</a>', linked)).toBe('<a href="https://www.museumwnf.org/">x</a>')
    expect(rewriteLinks('<a href="mailto:a@b.org">x</a>', linked)).toBe('<a href="mailto:a@b.org">x</a>')
  })

  it('joins words the page prints one after the other, links rewritten', () => {
    const cooperation = {
      ...linked,
      words: { 'home.cooperation': { word: 'head', words: ['head', 'text'] } },
    }
    const { locales } = buildStandaloneCatalogue(
      cooperation,
      [
        row('head', 3, 'en', '<i>Discover Baroque Art</i> has been created in cooperation with partners from<br/>'),
        row('text', 3, 'en', '<a href="partners.php">Austria</a>, <a href="partners.php">Croatia</a>'),
        row('head', 3, 'fr', 'Découvrir'),
      ],
      'baroqueart'
    )
    expect(locales).toEqual({
      en: {
        'baroqueart.home.cooperation':
          '*Discover Baroque Art* has been created in cooperation with partners from  \n[Austria](#/partners), [Croatia](#/partners)',
      },
    })
  })
})

describe('the tables', () => {
  const sponsor = (spname: string, regionname: string | null = null) => ({
    sponsors_id: 1, remarks: '<b>Main</b> sponsor', spname, web: 'www.example.org ', path: 'sponsors/34.jpg', cname: '', regionname,
  })

  it("lists Baroque Art's sponsors as the page prints them: a heading on each group's first row", () => {
    const rows = composeBaroqueSponsors([
      { code: 'at', name: 'Austria', rows: [sponsor('Land Tirol', 'Tyrol'), sponsor('Stadt Innsbruck')] },
      { code: 'it', name: 'Italy', rows: [sponsor('A', 'Rome'), sponsor('B', 'Lecce'), sponsor('C', 'Rome')] },
    ])
    expect(rows.map((r) => [r.label, r.region, r.name])).toEqual([
      ['AUSTRIA', 'Tyrol', 'Land Tirol'],
      ['', '', 'Stadt Innsbruck'],
      ['ITALY/  \nROME', '', 'A'],
      ['', '', 'C'],
      ['ITALY/  \nLECCE', '', 'B'],
    ])
    expect(rows[0]).toMatchObject({ web: 'www.example.org', remarks: '**Main** sponsor', logo: 'sponsors/34.jpg' })
  })

  const person = (fields: Partial<TeamRow>): TeamRow => ({
    country: 'dz', given_name: 'Mourad', family_name: 'Bouteflika', position: '', Institution: 'Ministry of Culture', city: 'Algiers', ...fields,
  })
  const countries = { dz: 'Algeria', tr: 'Türkiye' }

  it("writes a team member's line by about_team.php's rules", () => {
    expect(teamLine('International Curatorial Committee', person({}), countries)).toBe(
      '<b>Algeria</b> |  Mourad Bouteflika, Ministry of Culture, Algiers'
    )
    expect(teamLine('Translations and Editing', person({ position: '(Arabic)' }), countries)).toBe(
      ' Mourad Bouteflika, Algiers (Arabic), Ministry of Culture'
    )
    expect(teamLine('MWNF Web Team', person({ Institution: 'Preigo Fover Technologies', position: '(design)' }), countries)).toBe(
      ' Mourad Bouteflika Preigo Fover Technologies, Algiers, Algeria (design)'
    )
    expect(localTeamLine(person({ position: 'coordinator' }))).toBe(' Mourad Bouteflika, Ministry of Culture, Algiers coordinator')
  })

  it("names a local team's entry after its country", () => {
    expect(countryKey('United Kingdom')).toBe('unitedKingdom')
    expect(countryKey('Türkiye')).toBe('turkiye')
    expect(countryKey('Germany')).toBe('germany')
  })
})

