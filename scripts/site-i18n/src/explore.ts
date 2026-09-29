/**
 * Explore's texts: its six pages and its labels, as the Explore website's own
 * locales.
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
 *
 * The labels come from legacy's code and data, never from our own hand
 * (Pascal, 2026-09-29), in this order:
 * - legacy's dictionary, `mwnf3_explore.translation` (Explore's group), where
 *   the old PHP site (`.legacy-code/explore`) uses the word for the same
 *   element: EXPLORE_LABEL_WORDS, in every language the dictionary has;
 * - else the live client's source (`.legacy-code/explore-client`), the
 *   element's static text: EXPLORE_CLIENT_LABELS, in English, the only
 *   language that client is written in.
 * A label found in neither is not the site's to have.
 */
import { convertHtmlToMarkdown } from './core/html-to-markdown.js'
import type { MessageCatalogue, TranslationRow } from './core/types.js'
import type { TextOptions } from './core/vue-template.js'
import { dropVueI18nLiterals } from './website.js'

/** Explore's group in legacy's dictionary, `mwnf3_explore.translation`. */
export const EXPLORE_DICTIONARY_GROUP = 12

/** The home page's words, and the entry each becomes under the site's namespace. */
export const EXPLORE_HOME_WORDS: Record<string, string> = {
  'Home-Leitmotif': 'home.leitmotif',
  'Home-Description': 'home.description',
  'Home-Explore-by-Theme': 'home.byTheme',
  'Home-Explore-by-Country': 'home.byCountry',
  'Home-Explore-by-Itinerary': 'home.byItinerary',
}

/**
 * The labels legacy's dictionary holds, and the entry each becomes. Each word
 * is the one the old PHP site prints on the same element.
 */
export const EXPLORE_LABEL_WORDS: Record<string, string> = {
  // The selection's placeholders: index.php's country select, right.php's
  // territory select, location list and monument select.
  sel_country: 'select.pickCountry',
  sel_a_ter: 'select.pickTerritory',
  sel_loc: 'select.pickLocation',
  sel_mon: 'select.pickMonument',
  // The headings over a country's locations (country.php) and a location's
  // monuments (monument.php).
  exp_loc: 'next.location',
  exp_mon: 'next.monument',
  // The travel layer's boxes (rt-featured-load.php, rt-otherlinks-ajax.php),
  // over the same records.
  fea_pub: 'travel.books',
  fea_tour: 'travel.tours',
  acco: 'info.accommodations',
  guided: 'info.guidedVisits',
  use_web: 'info.usefulWebsites',
  // A place's practical details (country.php, explore.php).
  how_reach: 'info.howToReach',
  info: 'info.information',
  contact: 'info.contact',
  // The heading of a location's historical background (location.php).
  introduction_location: 'location.background',
  // Where a monument's text comes from (monument_it.php: "In <project> …").
  et: 'source.trails',
  vm: 'source.virtualMuseum',
  // The link to MWNF's portal (include.php).
  mwnf_portal: 'nav.mwnfPortal',
}

/** Where a label stands in the live client: a component, and the element in its template. */
export interface ClientLabel {
  /** The single-file component, relative to the client's checkout. */
  file: string
  /** The element (see core/vue-template.ts). */
  selector: string
  options?: TextOptions
}

const APP = 'src/App.vue'
const MENU = 'src/components/NavigationMenu.vue'
const SIDE = 'src/components/SideNavigation.vue'
const MONUMENT = 'src/components/MonumentComponent.vue'
const icons = { exclude: ['font-awesome-icon'] }
// A selection label's step number is a span of its own.
const numbered = { exclude: ['span'] }
// The sentence under the selection, its two forms: exploring by theme, by country.
const exploring = { exclude: ['router-link'] }

/** The labels only the live client has, and the entry each becomes. */
export const EXPLORE_CLIENT_LABELS: Record<string, ClientLabel> = {
  'nav.byTheme': { file: MENU, selector: '#navigation-menu-theme > a' },
  'nav.byCountry': { file: MENU, selector: '#navigation-menu-country > a' },
  'nav.whatsNew': {
    file: APP,
    selector: `#header-links > router-link[:to="{ name: 'whats-new' }"]`,
  },
  'nav.getInvolved': {
    file: APP,
    selector: `#header-links > router-link[:to="{ name: 'get-involved' }"]`,
  },
  'nav.importantInformation': {
    file: APP,
    selector: `#search-overlay > router-link[:to="{ name: 'important-information' }"]`,
  },
  'home.highlighted': {
    file: 'src/components/ExploreTheme.vue',
    selector: '#highlighted-themes-header',
  },
  'select.heading': {
    file: SIDE,
    selector: '#side-navigation-title > div',
    options: icons,
  },
  'select.themes': {
    file: SIDE,
    selector: 'label[for="theme-select"]',
    options: { dropStepNumber: true },
  },
  'select.countries': {
    file: SIDE,
    selector: 'label[for="country-select"]',
    options: numbered,
  },
  'select.filters': {
    file: SIDE,
    selector: 'label[for="filters-select"]',
    options: numbered,
  },
  'select.territories': {
    file: SIDE,
    selector: 'label[for="territory-select"]',
    options: numbered,
  },
  'select.locations': {
    file: SIDE,
    selector: 'label[for="location-select"]',
    options: numbered,
  },
  'select.monuments': {
    file: SIDE,
    selector: 'label[for="monument-select"]',
    options: numbered,
  },
  'select.pickTheme': {
    file: SIDE,
    selector: 'select#theme-select > option[value=""]',
  },
  'select.pickFilter': {
    file: SIDE,
    selector: 'select#filter-select > option[value=""]',
  },
  'select.exploringTheme': {
    file: SIDE,
    selector: 'div.side-navigation-select p',
    options: { ...exploring, branches: [1, 2] },
  },
  'select.exploringCountry': {
    file: SIDE,
    selector: 'div.side-navigation-select p',
    options: { ...exploring, branches: [2, 1] },
  },
  'select.returnHome': {
    file: SIDE,
    selector: 'router-link#side-navigation-home',
  },
  // "Explore by Monument / Location / Country": the heading over a page's tiles.
  'next.country': {
    file: 'src/pages/ExplorePage.vue',
    selector: 'div.explore-next-header',
    options: { branches: [2] },
  },
  'monument.directions': {
    file: MONUMENT,
    selector: '#monument-menu-directions',
    options: icons,
  },
  'info.heading': {
    file: MONUMENT,
    selector: '#monument-menu-additional',
    options: icons,
  },
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
 * Builds the Explore site's locales from its pages, its dictionary words (the
 * home page's and the labels') and the labels read from the live client
 * (`clientLabels`, entry → English text). An empty text is left out rather
 * than written blank, and a language is never padded with English: the site
 * falls back on its English file, like every other.
 */
export function buildExploreCatalogue(
  pages: ExplorePageRow[],
  words: TranslationRow[],
  namespace: string,
  clientLabels: Record<string, string> = {}
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
    const entry = EXPLORE_HOME_WORDS[word.wordId] ?? EXPLORE_LABEL_WORDS[word.wordId]
    if (entry !== undefined) put(word.langId, entry, word.value)
  }

  // Legacy's client is written in English only; its text is plain, not markup.
  // A label the dictionary has in English keeps the dictionary's.
  for (const [entry, text] of Object.entries(clientLabels)) {
    const key = `${namespace}.${entry}`
    if (text.trim() !== '' && locales.en![key] === undefined) {
      locales.en![key] = text.trim()
    }
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
