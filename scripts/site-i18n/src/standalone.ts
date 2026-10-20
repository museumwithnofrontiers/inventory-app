/**
 * The standalone sites' texts — Discover Islamic Art, Discover Baroque Art and
 * Sharing History — as their websites' own locales.
 *
 * These are not DXA sites: no `thg_gallery` row names them, so none of
 * `extract`'s selectors reaches them. Their legacy PHP pages print three kinds
 * of text, and this tool reads all three:
 * - words of legacy's dictionary, `mwnf3.translation`, through `getTerm()`:
 *   the labels, the footer, and whole pages kept as one word (Islamic Art's
 *   mission statement). `mod.dictionary.inc.php` loads groups 2 and 3 plus
 *   the page's own (`$TRSL_GROUP`: 4 on the museum sites, 13 on Sharing
 *   History) into one array, row by row in primary-key order, so where a word
 *   is in several of them the highest group wins. `buildStandaloneCatalogue`
 *   does the same.
 * - text written into the PHP source itself (Islamic Art's Recommended Links,
 *   Baroque Art's credits): a region of the page, cut out between two markers
 *   and converted the way every other legacy fragment is.
 * - rows of legacy's own tables that a page composes into text (the sponsors,
 *   Sharing History's team and its About page): src/standalone-tables.ts, each
 *   composed by the same rules as the PHP that prints it.
 *
 * Each site lists what it reads in STANDALONE_SITES (src/standalone-sites.ts),
 * with the entry each text becomes and the languages legacy's switcher offers
 * (`$INTERFACELNGLIST` / `$LNGLIST`). A word in another language is a row
 * legacy never prints, so it is not written. They are the site's copy, not
 * inventory data (sponsors, team and contributors included: Pascal,
 * 2026-10-20), and travel the way a gallery's credits do: converted to
 * Markdown, into the site's `locales/<lang>.json`.
 */
import { convertHtmlToMarkdown } from './core/html-to-markdown.js'
import type { MessageCatalogue } from './core/types.js'
import { dropVueI18nLiterals } from './website.js'

export { STANDALONE_SITES } from './standalone-sites.js'

/** The groups `getTerm()` reads on a museum site's pages, lowest first. */
export const STANDALONE_DEFAULT_GROUPS = [2, 3, 4]

/**
 * One dictionary word: its id, and the groups the page reads it from (lowest
 * first). `words` names several, which the page prints one after the other
 * (`<?= getTerm("a") ?><?= getTerm("b") ?>`): the entry is their texts joined
 * as printed, in every language that has them all.
 */
export interface StandaloneWord {
  word: string
  words?: string[]
  groups?: number[]
}

/**
 * A region of a legacy PHP page: the text from the first `start` (included)
 * to the first `end` after it (excluded). `constants` gives the value the
 * live page prints for each PHP constant the region echoes; any other PHP in
 * the region fails the run. HTML comments are dropped: the page never shows
 * them. Written in one language only, which `language` names: legacy prints
 * it whatever the interface language.
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
  /** The legacy site's address, which its own relative links resolve against. */
  host: string
  /** The languages legacy's switcher offers. */
  languages: string[]
  /** The groups a word is read from when it names none. */
  groups?: number[]
  /** Words written under the site's namespace: entry → word. */
  words: Record<string, string | StandaloneWord>
  /**
   * Words written under a shared viewer-i18n entry's own name, which the
   * site's locale overrides (local wins): a label a shared component prints,
   * in legacy's wording. Full entry name → word.
   */
  overrides?: Record<string, string | StandaloneWord>
  regions?: Record<string, PhpRegion>
  /**
   * Legacy pages the new site rebuilds, and the route each became: a link
   * inside a text to one of them points at the route. A link to any other
   * legacy page stays a link to legacy, made absolute. A key is the page as
   * the text names it, relative to `host`, query included when it matters
   * (`pm_partner_list.php?type=museum`); a key without a query matches the
   * page whatever its query.
   */
  links?: Record<string, string>
  /** The site's table builders (src/standalone-tables.ts), by name. */
  tables?: string[]
}

/** A dictionary row, with the group it was read from. */
export interface StandaloneWordRow {
  wordId: string
  groupId: number
  langId: string
  value: string | null
}

/** A site's word, normalised. */
export interface NormalisedWord {
  words: string[]
  groups: number[]
}

/**
 * A site's words, normalised: the entry each is written under (its own under
 * the namespace, an override under its shared name) → the words it joins and
 * the groups they are read from.
 */
export function siteWords(site: StandaloneSite, namespace: string): Record<string, NormalisedWord> {
  const words: Record<string, NormalisedWord> = {}
  const add = (key: string, spec: string | StandaloneWord) => {
    const word = typeof spec === 'string' ? { word: spec } : spec
    words[key] = {
      words: word.words ?? [word.word],
      groups: word.groups ?? site.groups ?? STANDALONE_DEFAULT_GROUPS,
    }
  }
  for (const [entry, spec] of Object.entries(site.words)) add(`${namespace}.${entry}`, spec)
  for (const [key, spec] of Object.entries(site.overrides ?? {})) add(key, spec)
  return words
}

/** Every word id the site reads. */
export function siteWordIds(site: StandaloneSite): string[] {
  return [...new Set(Object.values(siteWords(site, 'site')).flatMap((w) => w.words))]
}

/** Every group any of the site's words is read from. */
export function siteGroups(site: StandaloneSite): number[] {
  return [...new Set(Object.values(siteWords(site, 'site')).flatMap((w) => w.groups))].sort((a, b) => a - b)
}

// An entity in a string with no tag: legacy stores some labels that way, and
// the converter only rewrites strings that carry a tag.
const ENTITY = /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i

/**
 * A legacy text as a site's entry: its links pointed at the new site or made
 * absolute, then Markdown, entities decoded, vue-i18n literals unwrapped.
 */
export function entryValue(value: string | null, site?: StandaloneSite): string {
  if (value === null) return ''
  const linked = site ? rewriteLinks(value, site) : value
  const html = !linked.includes('<') && ENTITY.test(linked) ? `<span>${linked}</span>` : linked
  return dropVueI18nLiterals(convertHtmlToMarkdown(html))
}

/**
 * Every `href` of a legacy text, as the new site needs it: a page the site
 * rebuilt (`site.links`) becomes its route; any other page of the legacy site
 * becomes an absolute link to it; anything else (another site, `mailto:`, an
 * anchor) is left alone.
 */
export function rewriteLinks(html: string, site: StandaloneSite): string {
  const host = site.host.replace(/\/$/, '')
  return html.replace(/href=(["'])([^"']*)\1/gi, (whole, quote: string, href: string) => {
    let page: string | null = null
    if (href.startsWith(`${host}/`)) page = href.slice(host.length + 1)
    else if (!/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href)) page = href.replace(/^\.?\//, '')
    if (page === null) return whole
    const route = site.links?.[page] ?? site.links?.[page.split('?')[0]!]
    return `href=${quote}${route ?? `${host}/${page}`}${quote}`
  })
}

/**
 * The PHP region as HTML: cut out, its constants replaced, its comments
 * dropped, and line breaks dropped where they only lay the page out — at the
 * start of a heading (spacing above it) and inside a link's text (a long
 * address wrapped).
 */
export function phpRegionHtml(source: string, region: PhpRegion): string {
  const start = source.indexOf(region.start)
  if (start < 0) throw new Error(`${region.file}: "${region.start}" not found`)
  const end = source.indexOf(region.end, start)
  if (end < 0) throw new Error(`${region.file}: no "${region.end}" after "${region.start}"`)
  // The comments, until none is left: dropping one may join the halves of
  // another (`<!-<!---->-`).
  let html = source.slice(start, end)
  let previous: string
  do {
    previous = html
    html = html.replace(/<!--[\s\S]*?-->/g, '')
  } while (html !== previous)

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

/** What a site's table builders produce: entries per language, and data files. */
export interface TableOutput {
  entries?: MessageCatalogue
  files?: Record<string, unknown>
}

export interface StandaloneCatalogue {
  /** Per-locale entries, one file per language legacy has a text in; English always. */
  locales: MessageCatalogue
  /** Entries no row gives in English: the site falls back on nothing for them. */
  missingEnglish: string[]
}

/**
 * Builds a standalone site's locales from its dictionary rows, its PHP
 * regions (entry → HTML) and its tables' entries. For each entry and language
 * the highest group the page reads wins, as in `mod.dictionary.inc.php`. An
 * empty text is left out rather than written blank, a language legacy's
 * switcher does not offer is left out, and no language is padded with
 * English: the site falls back on its English file, like every other.
 */
export function buildStandaloneCatalogue(
  site: StandaloneSite,
  rows: StandaloneWordRow[],
  namespace: string,
  regions: Record<string, string> = {},
  tables: MessageCatalogue = {}
): StandaloneCatalogue {
  const offered = new Set(site.languages)
  const locales: MessageCatalogue = { en: {} }

  // The text of one word in one language: its row in the highest group read.
  const best = new Map<string, StandaloneWordRow>()
  const pick = (word: string, groups: number[], langId: string) => {
    const key = `${word}\u0000${groups.join(',')}\u0000${langId}`
    if (!best.has(key)) {
      let found: StandaloneWordRow | undefined
      for (const row of rows) {
        if (row.wordId !== word || row.langId !== langId || !groups.includes(row.groupId)) continue
        if (found === undefined || row.groupId > found.groupId) found = row
      }
      if (found) best.set(key, found)
    }
    return best.get(key)
  }

  const words = siteWords(site, namespace)
  for (const [key, { words: ids, groups }] of Object.entries(words)) {
    for (const langId of offered) {
      const parts = ids.map((id) => pick(id, groups, langId))
      if (parts.some((part) => part === undefined)) continue
      const text = entryValue(parts.map((part) => part!.value ?? '').join(''), site)
      if (text !== '') (locales[langId] ??= {})[key] = text
    }
  }

  for (const [entry, html] of Object.entries(regions)) {
    const language = site.regions?.[entry]?.language ?? 'en'
    const text = entryValue(html, site)
    if (text !== '') (locales[language] ??= {})[`${namespace}.${entry}`] = text
  }

  for (const [language, messages] of Object.entries(tables)) {
    for (const [key, text] of Object.entries(messages)) {
      if (text !== '') (locales[language] ??= {})[key] = text
    }
  }

  // What viewer-i18n's check accepts: no braces in a text, and an entry name
  // of three parts (namespace, group, entry).
  for (const [locale, messages] of Object.entries(locales)) {
    for (const [key, value] of Object.entries(messages)) {
      if (/[{}]/.test(value)) throw new Error(`${locale} ${key}: a text may not contain braces`)
      if (key.split('.').length !== 3) throw new Error(`${locale} ${key}: an entry name has three parts`)
    }
  }

  const keys = [...Object.keys(words), ...Object.keys(site.regions ?? {}).map((entry) => `${namespace}.${entry}`)]
  const missingEnglish = keys.filter((key) => locales.en![key] === undefined).sort()

  const sorted: MessageCatalogue = {}
  for (const locale of Object.keys(locales).sort()) {
    const messages = locales[locale]!
    sorted[locale] = Object.fromEntries(Object.keys(messages).sort().map((key) => [key, messages[key]!]))
  }
  return { locales: sorted, missingEnglish }
}
