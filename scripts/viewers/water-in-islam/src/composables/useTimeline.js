import { computed } from 'vue'
import {
  exhibition, timelines, timelineEvents, countries, countryById, countryLabel,
  tr, defaultLang,
} from './useExhibitionData.js'
import { yearBucketsFromRange } from './useCollection.js'

// ── Which chronology this site's Timeline section shows ────────────────────
//
// An exhibition package carries BOTH chronologies, because the live instance
// serves both: `/events` answers the worldwide 26-country merge on every DXA
// site, and `/thg/timeline` answers the exhibition's own narrative one. What
// decides which the *Timeline pages* show is `hasCountryBasedTimeline`:
// legacy's TimelinePage sets `countriesAvailable` from it and TimelineResults
// switches its endpoint on it (`timelineURL = "/thg/timeline?hash="` in the
// false branch).
//
// Both flags are false for this exhibition, and that does NOT mean "no timeline
// data". `timelines.json` still ships 37 timelines and 1,390 events — every DXA
// site gets the worldwide merge whatever its flags say — with no `thg_local`
// row at all. The flags gate NAVIGATION, not data. Colours proved that in one
// direction (`has_timeline` true, its own 45-event chronology) and this
// exhibition proves it in the other.
//
// The `thg_local` row has no `country_id`, which is exactly why it must be
// separated by `source` rather than left to the country filter: on "All
// Countries" it would otherwise be interleaved into the worldwide list.
const localTimeline = computed(
  () => timelines.value.find(t => t.source === 'thg_local') ?? null
)

/** True when the Timeline section is the exhibition's own chronology. */
export const usesLocalTimeline = computed(
  () => !exhibition.has_country_timeline && Boolean(localTimeline.value)
)

/**
 * Whether this site offers a Timeline at all — the one flag every piece of
 * timeline chrome is gated on.
 *
 * Legacy hides more than the nav entry when both chronology flags are false,
 * which is only visible on a site that has them both false. Checked against the
 * live instance: the word "timeline" appears nowhere on its item sheet (no
 * "Timeline for this item" popout) or on its collection results ("Timeline for
 * this Search"), and the nav runs ABOUT · THEMES · COLLECTION · PARTNERS ·
 * RELATED CONTENT · CREDITS · MY COLLECTION with no TIMELINE between PARTNERS
 * and RELATED CONTENT.
 *
 * The ROUTES stay reachable, because legacy's do: typing /timeline on the live
 * instance still renders the page and its `txtTimeline` introduction. Only the
 * links into it are withheld.
 */
export const hasTimeline = computed(
  () => Boolean(exhibition.has_timeline || exhibition.has_country_timeline)
)

/** The events the Timeline pages work over — one chronology, never both. */
const eventPool = computed(() => {
  const local = localTimeline.value
  if (usesLocalTimeline.value) {
    return timelineEvents.value.filter(e => e.timeline_id === local.id)
  }
  if (!local) return timelineEvents.value
  return timelineEvents.value.filter(e => e.timeline_id !== local.id)
})

// The global country timeline, served by legacy `/v2/events`. It is
// country-scoped and project-independent — which is why the live carpets
// instance answers `/events/countries` with the worldwide list even though its
// own `hasCountryBasedTimeline` flag is false.
//
// It is also a MERGE of two chronologies rather than one table. Legacy's
// `App\MWNF\DAO\v2\Events` unions `mwnf3.hcr` (the Discover Islamic Art country
// chronologies, 18 timelines) with `mwnf3_sharing_history.sh_hcr` restricted to
// exhibition 2, "Political Context" (19 timelines), and sorts the result by
// year. The package mirrors that exactly: `timelines.json` carries 37 rows over
// 26 countries, each tagged `source: 'mwnf3' | 'sharing_history'`, and
// `timeline_events.json` carries all 1,390 events keyed by `country_id`.
//
// Eleven countries are served by BOTH sources, so anything user-facing must key
// on the country and never on the timeline row: the picker below is built per
// country, and `findEvents` filters on `country_id`, which is what merges the
// two chronologies into one year-ordered list the way legacy did.
//
// Names and legacy codes both come from countries.json. The exporter scopes
// that file to "member item countries ∪ their holders' countries ∪ the global
// timeline's countries", so it covers all 26 timeline countries — the
// `Intl.DisplayNames` fallback below is therefore dead code for them, and is
// kept only so a regressed package degrades to a rendered ISO code rather than
// a raw id. The `code` countries.json ships is the country's
// `backward_compatibility`, which is exactly the code legacy's own timeline
// URLs used, including the ones that are not ISO 3166-1 alpha-2 (`uk`, `pa`,
// `qt`, `rm`, `sb`, `ua`, …). Those are the reason the fallback must stay
// unreachable rather than merely rare: read as ISO, `ua` is Ukraine and `sb` is
// the Solomon Islands, where legacy means the UAE and Serbia. Only
// countries.json can name them correctly.
const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
})()

// Two legacy codes are not ISO 3166-1 alpha-2.
const LEGACY_TO_ISO = { uk: 'GB', pa: 'PS' }

// A lookup, not a parse. The fallback exists only for the regressed-package
// case described above, and it must agree with GLOBAL_TIMELINE_LIKE_PATTERNS in
// `scripts/exporters/dxa-gallery/src/exporters/timeline-exporter.ts`: the country
// sits after the literal `country` segment in BOTH keyspaces
// (`mwnf3:hcr:country:<cc>` and
// `mwnf3_sharing_history:sh_hcr:country:<cc>:exhibition:2`), and it is the last
// segment in only the first — taking the last one yields `2` on the second.
function legacyCodeOf(timeline) {
  const fromPackage = countryById.value.get(timeline.country_id)?.code
  if (fromPackage) return fromPackage
  const parts = (timeline.backward_compatibility ?? '').split(':')
  const at = parts.indexOf('country')
  return (at >= 0 ? parts[at + 1] : null) || timeline.country_id
}

function nameFor(timeline) {
  const fromPackage = countries.value.some(c => c.id === timeline.country_id)
    ? countryLabel(timeline.country_id)
    : null
  if (fromPackage) return fromPackage
  const legacy = legacyCodeOf(timeline)
  const iso = LEGACY_TO_ISO[legacy] ?? String(legacy).toUpperCase()
  try {
    return regionNames?.of(iso) ?? iso
  } catch {
    return iso
  }
}

/**
 * Countries that actually have a chronology, alphabetized, "All" first.
 *
 * One entry per COUNTRY, not per timeline row: the eleven countries served by
 * both `mwnf3` and `sharing_history` would otherwise appear twice in every
 * country picker on the site.
 */
export const timelineCountries = computed(() => {
  // No picker at all when the section is the exhibition's own chronology —
  // legacy hides the select on `countriesAvailable === false`.
  if (usesLocalTimeline.value) return []
  const byCountry = new Map()
  for (const timeline of timelines.value) {
    if (!timeline.country_id || byCountry.has(timeline.country_id)) continue
    byCountry.set(timeline.country_id, [legacyCodeOf(timeline), nameFor(timeline)])
  }
  const rows = [...byCountry.values()].sort((a, b) => a[1].localeCompare(b[1]))
  return [['all', 'All Countries'], ...rows]
})

/** Display name for an event's country. */
export function timelineCountryName(countryId) {
  if (countries.value.some(c => c.id === countryId)) return countryLabel(countryId)
  const timeline = timelines.value.find(t => t.country_id === countryId)
  return timeline ? nameFor(timeline) : countryId
}

/**
 * Legacy 2-letter code → the inventory country id the events are keyed by.
 * A country served by both chronologies has two rows carrying the same code and
 * the same `country_id`, so either row answers.
 */
export function countryIdForCode(code) {
  if (!code || code === 'all') return null
  const timeline = timelines.value.find(t => legacyCodeOf(t) === code)
  if (timeline) return timeline.country_id
  // Countries with no chronology still reach here from the collection page's
  // "Timeline for this Search" link, which uses countries.json's own codes.
  return countries.value.find(c => c.code === code)?.id ?? null
}

/** Every event year present, as the year dropdown's source range. */
export const eventYearRange = computed(() => {
  const years = eventPool.value.map(e => e.year_from).filter(v => Number.isFinite(v) && v !== 0)
  if (!years.length) return [null, null]
  return [Math.min(...years), Math.max(...years)]
})

export const eventYearBuckets = computed(() => {
  const [min, max] = eventYearRange.value
  return yearBucketsFromRange(min, max)
})

/**
 * Legacy's `/events?ic[]=&ya=&yo=` — events for a country within a year range,
 * ordered chronologically.
 *
 * Filtering on `country_id` rather than `timeline_id` is what reproduces the
 * legacy merge: a country served by both chronologies yields both sets of
 * events here, and the year sort below interleaves them into one list.
 */
export function findEvents({ countryCode, start, end }) {
  const countryId = countryIdForCode(countryCode)
  const from = start === '' || start == null ? null : Number(start)
  const to = end === '' || end == null ? null : Number(end)

  return eventPool.value
    .filter(e => {
      if (countryId && e.country_id !== countryId) return false
      const year = e.year_from
      if (!Number.isFinite(year)) return false
      if (from != null && year < from) return false
      if (to != null && year > to) return false
      return true
    })
    .map(e => ({
      ...e,
      countryName: timelineCountryName(e.country_id),
      text: tr('timeline_events', e.id, defaultLang),
    }))
    .sort((a, b) => (a.year_from - b.year_from) || (a.display_order ?? 0) - (b.display_order ?? 0))
}

/** "1193 A.D." / "502 B.C." — legacy's era suffix rule. */
export function eraLabel(year) {
  if (!Number.isFinite(year) || year === 0) return ''
  return year < 0 ? `${Math.abs(year)} B.C.` : `${year} A.D.`
}

/**
 * The item sheet's "Timeline for this item" window rounds the item's own dates
 * outward to the nearest century before querying, which is how a single-year
 * object still lands on a readable stretch of chronology.
 */
export function roundOutward(start, end) {
  const from = Number.isFinite(start) ? Math.floor(start / 100) * 100 : null
  const last = Number.isFinite(end) ? end : start
  const to = Number.isFinite(last) ? Math.ceil(last / 100) * 100 : null
  return [from, to]
}
