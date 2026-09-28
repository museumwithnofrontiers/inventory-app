/**
 * Explore's texts: its six pages, as the Explore website's own locales.
 *
 * Explore is not a DXA site: it has no `thg_gallery` row and no
 * `mwnf3.translation` group. Legacy's API serves its pages from two places in
 * `mwnf3_explore`:
 * - `texts/home`: five `Home-*` words of `mwnf3_explore.translation`;
 * - `texts/{about,credits,get-involved,important-information,what-is-new}`:
 *   `explore_pages_langs`, a title and a description per page and language.
 *
 * They are the site's copy, not inventory data (decision D2 of the Explore
 * analysis, `scripts/exporters/docs/explore-legacy-analysis.md`), so they
 * travel the way a gallery's credits do: converted to Markdown, into the
 * site's `locales/<lang>.json`, under the site's namespace.
 */
import { convertHtmlToMarkdown } from './core/html-to-markdown.js'
import type { MessageCatalogue, TranslationRow } from './core/types.js'
import { dropVueI18nLiterals } from './website.js'

/** The home page's words, and the entry each becomes under the site's namespace. */
export const EXPLORE_HOME_WORDS: Record<string, string> = {
  'Home-Leitmotif': 'home.leitmotif',
  'Home-Description': 'home.description',
  'Home-Explore-by-Theme': 'home.byTheme',
  'Home-Explore-by-Country': 'home.byCountry',
  'Home-Explore-by-Itinerary': 'home.byItinerary',
}

/**
 * The pages, by their legacy `pagename`, and the section each becomes. A page
 * gives its section a `title` and a `body`.
 */
export const EXPLORE_PAGES: Record<string, string> = {
  About: 'about',
  'Get Involved': 'getInvolved',
  Credits: 'credits',
  "What's new": 'whatsNew',
  'Important Information': 'importantInformation',
}

/** One language of one page: a row of `explore_pages` joined to `explore_pages_langs`. */
export interface ExplorePageRow {
  pagename: string
  langId: string
  title: string | null
  description: string | null
}

export interface ExploreCatalogue {
  /** Per-locale entries, one file per language legacy has a text in; English always. */
  locales: MessageCatalogue
  /** Pages legacy has a text for that no section is mapped to: listed, not written. */
  notEmitted: string[]
}

/** A legacy text as a site's entry: Markdown, with vue-i18n's literal escapes unwrapped. */
function entryValue(value: string | null): string {
  return dropVueI18nLiterals(convertHtmlToMarkdown(value))
}

/**
 * Builds the Explore site's locales from its pages and its home words. An empty
 * text is left out rather than written blank, and a language is never padded
 * with English: the site falls back on its English file, like every other.
 */
export function buildExploreCatalogue(
  pages: ExplorePageRow[],
  words: TranslationRow[],
  namespace: string
): ExploreCatalogue {
  const locales: MessageCatalogue = { en: {} }
  const put = (locale: string, entry: string, value: string | null) => {
    const text = entryValue(value)
    if (text === '') return
    const messages = (locales[locale] ??= {})
    // A word stored in more than one group keeps its first value.
    if (messages[`${namespace}.${entry}`] === undefined) {
      messages[`${namespace}.${entry}`] = text
    }
  }

  for (const word of words) {
    const entry = EXPLORE_HOME_WORDS[word.wordId]
    if (entry !== undefined) put(word.langId, entry, word.value)
  }

  const notEmitted = new Set<string>()
  for (const page of pages) {
    const section = EXPLORE_PAGES[page.pagename]
    if (section === undefined) {
      if (entryValue(page.title) !== '' || entryValue(page.description) !== '') {
        notEmitted.add(page.pagename)
      }
      continue
    }
    put(page.langId, `${section}.title`, page.title)
    put(page.langId, `${section}.body`, page.description)
  }

  const sorted: MessageCatalogue = {}
  for (const locale of Object.keys(locales).sort()) {
    const messages = locales[locale]!
    sorted[locale] = Object.fromEntries(Object.keys(messages).sort().map((key) => [key, messages[key]!]))
  }
  return { locales: sorted, notEmitted: [...notEmitted].sort() }
}
