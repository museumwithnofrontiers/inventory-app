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
  columnValue,
  phpRegionHtml,
  phpRegionRows,
  rewriteLinks,
  siteGroups,
  siteRegions,
  siteWords,
  STANDALONE_SITES,
  type StandaloneSite,
  type StandaloneWordRow,
} from '../../src/standalone.js'
import {
  composeBaroqueSponsors,
  composeInternationalSponsors,
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

  it('refuses an entry name of other than three parts, as viewer-i18n does', () => {
    expect(() =>
      buildStandaloneCatalogue(site({ 'team.idea.body': 'x' }), [row('x', 3, 'en', 'Idea')], 'sharinghistory')
    ).toThrow(/three parts/)
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

describe('phpRegionRows', () => {
  it("groups a .row's columns, with their widths", () => {
    const html =
      '<div class="row"><div class="col-md-6 col-sm-2 col-xs-12"><p>Role</p></div>' +
      '<div class="col-md-6 col-sm-12 col-xs-12"><p>Person</p></div></div>' +
      '<div class="row"><div class="col-md-12"><p>Team</p></div></div>'
    expect(phpRegionRows(html)).toEqual([
      [
        { md: 6, sm: 2, html: '<p>Role</p>' },
        { md: 6, sm: 12, html: '<p>Person</p>' },
      ],
      [{ md: 12, sm: 12, html: '<p>Team</p>' }],
    ])
  })

  it('keeps a div inside a column, and text outside any column as a row of its own', () => {
    const html =
      '<div class="h"><h3>Heading</h3></div></div></div>' +
      '<div class="row"><div class="col-md-6"><div class="x">A</div></div></div>'
    expect(phpRegionRows(html)).toEqual([
      [{ md: 12, sm: 12, html: '<h3>Heading</h3>' }],
      [{ md: 6, sm: 12, html: '<div class="x">A</div>' }],
    ])
  })
})

describe('siteRegions', () => {
  const columns = { file: 'c.php', start: '<div class="row">', end: '</section>', language: 'en', rows: 'data/c.json' }
  const source = '<div class="row"><div class="col-md-6"><p>Role</p></div><div class="col-md-6"> </div></div></section>'

  it('writes each column as an entry and the rows file naming them; an empty column has none', () => {
    const { regions, files } = siteRegions(site({}, { 'credits.body': columns }), 'baroqueart', () => source)
    expect(regions).toEqual({ 'credits.body01': '<p>Role</p>' })
    expect(files).toEqual({
      'data/c.json': [[{ entry: 'baroqueart.credits.body01', md: 6, sm: 12 }, { md: 6, sm: 12 }]],
    })
  })

  it('counts the line breaks over a column’s first paragraph apart from its text', () => {
    const team = '<div class="row"><div class="col-md-12"><br/>\n<p><strong>Team</strong></p></div></div></section>'
    const { regions, files } = siteRegions(site({}, { 'credits.body': columns }), 'baroqueart', () => team)
    expect(regions).toEqual({ 'credits.body01': '<p><strong>Team</strong></p>' })
    expect(files['data/c.json']).toEqual([[{ entry: 'baroqueart.credits.body01', md: 12, sm: 12, lead: 1 }]])
  })

  it('keeps every line break of a column, those that open it included', () => {
    expect(columnValue('<p><br />Ágota Dobó<br/> Terézia Bardi</p>')).toBe('\\\nÁgota Dobó\\\nTerézia Bardi')
    expect(columnValue('<br/>\n<p><strong>MWNF Project Team</strong></p>')).toBe('\\\n**MWNF Project Team**')
    expect(columnValue('<p><strong>Hungary</strong><br />Head of Project<br /><br />Curators</p>')).toBe(
      '**Hungary**\\\nHead of Project\\\n\\\nCurators'
    )
    expect(columnValue('<p><br /></p>')).toBe('')
    expect(columnValue('<h3>MWNF<br />VIRTUAL MUSEUM</h3>')).toBe('### MWNF  \nVIRTUAL MUSEUM')
  })

  it("writes the columns in the region's language", () => {
    const fr = site({}, { 'credits.body': { ...columns, language: 'fr' } })
    const { regions } = siteRegions(fr, 'baroqueart', () => source)
    const { locales, missingEnglish } = buildStandaloneCatalogue(fr, [], 'baroqueart', regions)
    expect(locales.fr).toEqual({ 'baroqueart.credits.body01': 'Role' })
    expect(missingEnglish).toEqual(['baroqueart.credits.body01'])
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

  it.runIf(existsSync(credits))("sets Baroque Art's roles beside their people", () => {
    const { regions, files } = siteRegions(STANDALONE_SITES.baroqueart!, 'baroqueart', () => readFileSync(credits, 'utf8'))
    const rows = files['data/credits.json']!
    const text = (column: { entry?: string }) => regions[column.entry!.slice('baroqueart.'.length)]!
    // The heading alone; Austria's roles beside its people; the MWNF team's
    // two roles and their people in one .row.
    expect(rows[0]).toEqual([{ entry: 'baroqueart.credits.body01', md: 12, sm: 12 }])
    expect(text(rows[0]![0]!)).toContain('MUSEUM WITH NO FRONTIERS')
    const austria = rows.find((row) => text(row[0]!).includes('Austria'))!
    expect(austria.map(({ md, sm }) => [md, sm])).toEqual([
      [6, 2],
      [6, 12],
    ])
    expect(text(austria[1]!)).toContain('Innsbruck Tourism')
    expect(rows.find((row) => text(row[0]!).includes('Overall Coordination'))).toHaveLength(4)
    expect(rows.find((row) => text(row[0]!).includes('MWNF Project Team'))![0]!.lead).toBe(1)
    expect(regions).not.toHaveProperty(['credits.body'])
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

  it("lists Islamic Art's international sponsors in the order read, without labels", () => {
    const rows = composeInternationalSponsors([sponsor('European Union'), sponsor('Euromed Heritage')])
    expect(rows.map((r) => r.name)).toEqual(['European Union', 'Euromed Heritage'])
    expect(rows[0]).toEqual({ name: 'European Union', web: 'www.example.org', remarks: '**Main** sponsor', logo: 'sponsors/34.jpg' })
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

  it("names a local team's entries after its country", () => {
    expect(countryKey('United Kingdom')).toBe('UnitedKingdom')
    expect(countryKey('Türkiye')).toBe('Turkiye')
    expect(countryKey('Germany')).toBe('Germany')
  })

  it("reads the project's name in each language the site offers, À as A", async () => {
    const db = {
      select: async <T>() =>
        [
          { lang: 'en', name: 'Discover Islamic Art' },
          { lang: 'fr', name: 'Découvrir l’art islamique' },
          { lang: 'de', name: 'Islamische Kunst entdecken' },
          { lang: 'es', name: 'À la découverte' },
        ] as T[],
    }
    const output = await STANDALONE_TABLES.islamicartProjectName!({ db, site: STANDALONE_SITES.islamicart!, namespace: 'islamicart', warn: () => {} })
    expect(output.entries).toEqual({
      en: { 'islamicart.partner.projectName': 'Discover Islamic Art' },
      fr: { 'islamicart.partner.projectName': 'Découvrir l’art islamique' },
      es: { 'islamicart.partner.projectName': 'A la découverte' },
    })
  })
})

