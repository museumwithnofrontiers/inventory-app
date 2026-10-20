/**
 * The standalone sites' texts — Discover Islamic Art, Discover Baroque Art and
 * Sharing History — as their websites' own locales.
 *
 * These are not DXA sites: no `thg_gallery` row names them, so none of
 * `extract`'s selectors reaches them. Their legacy PHP pages print two kinds
 * of text, and this module reads both:
 * - words of legacy's dictionary, `mwnf3.translation`, through `getTerm()`:
 *   the labels, the footer, and whole pages kept as one word (Islamic Art's
 *   mission statement). `mod.dictionary.inc.php` loads groups 2 and 3 plus
 *   the page's own (`$TRSL_GROUP`, 4 on the museum sites) into one array, row
 *   by row in primary-key order, so where a word is in several of them the
 *   highest group wins. `wordRows` below does the same.
 * - text written into the PHP source itself (Islamic Art's Recommended Links):
 *   a region of the page, cut out between two markers and converted the way
 *   every other legacy fragment is.
 *
 * Each site lists its words and regions in STANDALONE_SITES, with the entry
 * each one becomes under the site's namespace and the languages legacy's
 * switcher offers (`$INTERFACELNGLIST` / `$LNGLIST`). A word in another
 * language is a row legacy never prints, so it is not written. They are the
 * site's copy, not inventory data, and travel the way a gallery's credits do:
 * converted to Markdown, into the site's `locales/<lang>.json`.
 */
import { convertHtmlToMarkdown } from './core/html-to-markdown.js'
import type { MessageCatalogue } from './core/types.js'
import { dropVueI18nLiterals } from './website.js'

/** The groups `getTerm()` reads on a museum site's pages, lowest first. */
export const STANDALONE_DEFAULT_GROUPS = [2, 3, 4]

/** One dictionary word: its id, and the groups the page reads it from (lowest first). */
export interface StandaloneWord {
  word: string
  groups?: number[]
}

/**
 * A region of a legacy PHP page: the text from the first `start` (included)
 * to the first `end` after it (excluded). `constants` gives the value the
 * live page prints for each PHP constant the region echoes; any other PHP in
 * the region fails the run. Written in one language only, which `language`
 * names: legacy prints it whatever the interface language.
 */
export interface PhpRegion {
  file: string
  start: string
  end: string
  language: string
  constants?: Record<string, string>
}

export interface StandaloneSite {
  /** The legacy site's checkout, relative to `.legacy-code`. */
  root: string
  /** The languages legacy's switcher offers. */
  languages: string[]
  words: Record<string, string | StandaloneWord>
  regions?: Record<string, PhpRegion>
}

export const STANDALONE_SITES: Record<string, StandaloneSite> = {
  islamicart: {
    root: 'islamicart/www.discoverislamicart.org',
    // includes/header_bottom.php's switcher: $INTERFACELNGLIST.
    languages: ['ar', 'en', 'es', 'fr'],
    words: {
      // The page title, and the heading over every inner page (header_bottom.php).
      'identity.title': 'dia_gn_title',
      'identity.heading': 'db_partner_ISL',
      // The header's links (header.php, header_bottom.php).
      'nav.portal': 'portal_link',
      'nav.home': 'back_to_section',
      // The menu (header_bottom.php), in its order.
      'nav.permanentCollection': 'PermanentCollection',
      'nav.database': 'home_database',
      'nav.exhibitions': 'home_exhibitions',
      'nav.artisticIntroduction': 'home_artistic_intro',
      'nav.partners': 'home_partnermuseums',
      'nav.timeline': 'timeline_header',
      'nav.myCollection': 'my_museum',
      // The banner over each section (SectionTitle() on each page).
      'section.permanentCollection': 'museum_home_pc',
      'section.database': 'museum_home_db',
      'section.partners': 'museum_home_pm_partners',
      // The home page's left column (diaTemplates/leftLink.php).
      'home.recommendedLinks': 'home_recommendedlinks',
      'home.credits': 'footer4',
      'home.missionStatement': 'mission_statement',
      'home.visit': 'dia_home_visit',
      'home.explore': 'dia_home_EIAC',
      'home.exploreTooltip': 'pm_EIAC_subtitle',
      // Today's highlight (diaTemplates/randomText.php).
      'home.highlight': 'index_today',
      'home.alsoKnownAs': 'db_alsoknowas',
      'home.viewDescription': 'view_description',
      // The sponsor band (diaTemplates/bottomSection1.php, bottomSection2.php),
      // and the European Union's text its logo opens (explenation_text_home.php).
      'sponsors.supportHead': 'dia_supporttexthead',
      'sponsors.supportText': 'dia_supporttext',
      'sponsors.exploreHead': 'dia_supporttexthead2',
      'sponsors.exploreText': 'dia_supporttext2',
      'sponsors.europeanUnion': 'DatabaseEuOver',
      // The footer (includes/footer.php), in its order; the year follows the copyright.
      'footer.aboutMwnf': 'footer1',
      'footer.contact': 'footer2',
      'footer.legalNotice': 'footer3',
      'footer.credits': 'footer4',
      'footer.languagePolicy': 'language_policy',
      'footer.cookies': 'cookie_policy',
      'footer.copyright': 'footer5',
      // The item sheet (database_item.php, modules/database_item.php).
      'item.back': 'back',
      'item.collectionStart': 'pc_start_page',
      'item.addToCollection': 'add_to_collection',
      'item.viewShortDescription': 'pc_view_sdesc',
      'item.hideShortDescription': 'pc_hide_sdesc',
      'item.relatedContent': 'gn_related_context',
      'item.relatedObjects': 'item_relatedobjects',
      'item.relatedMonuments': 'item_linkedmonuments',
      'item.timeline': 'pc_view_hcr_item',
      'item.dynasties': 'pc_linkeddynasties',
      'item.relatedVideos': 'related_video',
      'item.onDisplayIn': 'on_display_in',
      'item.exhibitions': 'gn_exhibitions',
      'item.galleries': 'gn_galleries',
      'item.download': 'gn_download',
      'item.asPdf': 'gn_aspdf_img',
      // The Mission Statement page (isl_missionstatement.php): its banner, its
      // text (read from group 3 alone) and the print link.
      'missionStatement.title': 'missionstatement',
      'missionStatement.body': { word: 'mission_statement_text', groups: [3] },
      'page.print': 'print',
    },
    regions: {
      // recommendedlinks.php: every group heading and link, from the first
      // heading to the end of the page's content.
      'recommendedLinks.body': {
        file: 'recommendedlinks.php',
        start: '<div class="short_heading">',
        end: '</section>',
        language: 'en',
        // The one constant the region echoes, as the live page prints it.
        constants: { EXPLORE_WEBSITE_URL: 'https://explore.museumwnf.org' },
      },
    },
  },
}

/** A dictionary row, with the group it was read from. */
export interface StandaloneWordRow {
  wordId: string
  groupId: number
  langId: string
  value: string | null
}

/** A site's word list, normalised: entry → word and groups. */
export function siteWords(site: StandaloneSite): Record<string, Required<StandaloneWord>> {
  const words: Record<string, Required<StandaloneWord>> = {}
  for (const [entry, spec] of Object.entries(site.words)) {
    const word = typeof spec === 'string' ? { word: spec } : spec
    words[entry] = { word: word.word, groups: word.groups ?? STANDALONE_DEFAULT_GROUPS }
  }
  return words
}

/** Every group any of the site's words is read from. */
export function siteGroups(site: StandaloneSite): number[] {
  return [...new Set(Object.values(siteWords(site)).flatMap((w) => w.groups))].sort((a, b) => a - b)
}

// An entity in a string with no tag: legacy stores some labels that way, and
// the converter only rewrites strings that carry a tag.
const ENTITY = /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i

/** A legacy text as a site's entry: Markdown, entities decoded, vue-i18n literals unwrapped. */
function entryValue(value: string | null): string {
  if (value === null) return ''
  const html = !value.includes('<') && ENTITY.test(value) ? `<span>${value}</span>` : value
  return dropVueI18nLiterals(convertHtmlToMarkdown(html))
}

/**
 * The PHP region as HTML: cut out, its constants replaced, and line breaks
 * dropped where they only lay the page out — at the start of a heading
 * (spacing above it) and inside a link's text (a long address wrapped).
 */
export function phpRegionHtml(source: string, region: PhpRegion): string {
  const start = source.indexOf(region.start)
  if (start < 0) throw new Error(`${region.file}: "${region.start}" not found`)
  const end = source.indexOf(region.end, start)
  if (end < 0) throw new Error(`${region.file}: no "${region.end}" after "${region.start}"`)
  let html = source.slice(start, end)

  for (const [name, value] of Object.entries(region.constants ?? {})) {
    html = html.replaceAll(new RegExp(`<\\?=\\s*${name}\\s*\\?>`, 'g'), value)
  }
  if (html.includes('<?')) {
    throw new Error(`${region.file}: the region holds PHP this extractor cannot evaluate`)
  }

  return html
    .replace(/(<h[1-6][^>]*>)\s*(<br\s*\/?>\s*)+/gi, '$1')
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (link) => link.replace(/<br\s*\/?>/gi, ''))
}

export interface StandaloneCatalogue {
  /** Per-locale entries, one file per language legacy has a text in; English always. */
  locales: MessageCatalogue
  /** Entries no row gives in English: the site falls back on nothing for them. */
  missingEnglish: string[]
}

/**
 * Builds a standalone site's locales from its dictionary rows and its PHP
 * regions (entry → HTML). For each entry and language the highest group the
 * page reads wins, as in `mod.dictionary.inc.php`. An empty text is left out
 * rather than written blank, a language legacy's switcher does not offer is
 * left out, and no language is padded with English: the site falls back on its
 * English file, like every other.
 */
export function buildStandaloneCatalogue(
  site: StandaloneSite,
  rows: StandaloneWordRow[],
  namespace: string,
  regions: Record<string, string> = {}
): StandaloneCatalogue {
  const offered = new Set(site.languages)
  const locales: MessageCatalogue = { en: {} }

  for (const [entry, { word, groups }] of Object.entries(siteWords(site))) {
    const best = new Map<string, StandaloneWordRow>()
    for (const row of rows) {
      if (row.wordId !== word || !groups.includes(row.groupId) || !offered.has(row.langId)) continue
      const current = best.get(row.langId)
      if (current === undefined || row.groupId > current.groupId) best.set(row.langId, row)
    }
    for (const [langId, row] of best) {
      const text = entryValue(row.value)
      if (text !== '') (locales[langId] ??= {})[`${namespace}.${entry}`] = text
    }
  }

  for (const [entry, html] of Object.entries(regions)) {
    const language = site.regions?.[entry]?.language ?? 'en'
    const text = entryValue(html)
    if (text !== '') (locales[language] ??= {})[`${namespace}.${entry}`] = text
  }

  for (const [locale, messages] of Object.entries(locales)) {
    for (const [key, value] of Object.entries(messages)) {
      if (/[{}]/.test(value)) throw new Error(`${locale} ${key}: a text may not contain braces`)
    }
  }

  const entries = [...Object.keys(site.words), ...Object.keys(site.regions ?? {})]
  const missingEnglish = entries.filter((entry) => locales.en![`${namespace}.${entry}`] === undefined).sort()

  const sorted: MessageCatalogue = {}
  for (const locale of Object.keys(locales).sort()) {
    const messages = locales[locale]!
    sorted[locale] = Object.fromEntries(Object.keys(messages).sort().map((key) => [key, messages[key]!]))
  }
  return { locales: sorted, missingEnglish }
}
