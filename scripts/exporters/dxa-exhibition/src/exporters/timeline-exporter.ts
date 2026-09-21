import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface TimelineRow {
  id: string
  internal_name: string
  backward_compatibility: string | null
  country_id: string | null
}

interface TimelineEventRow {
  id: string
  timeline_id: string
  year_from: number | null
  year_to: number | null
  year_from_ah: number | null
  year_to_ah: number | null
  date_from: string | null
  date_to: string | null
  display_order: number
}

interface TimelineEventTranslationRow {
  timeline_event_id: string
  language_id: string
  name: string | null
  description: string | null
  date_from_description: string | null
  date_to_description: string | null
  date_from_ah_description: string | null
}

interface TimelineEventImageRow {
  timeline_event_id: string
  path: string
  alt_text: string | null
  display_order: number
}

interface TimelineEventItemRow {
  timeline_event_id: string
  item_id: string
  display_order: number
}

/**
 * The worldwide chronology every DXA gallery shows.
 *
 * The gallery timeline is NOT gallery-specific, and it is NOT one table either.
 * `/v2/events` is served by `App\MWNF\DAO\v2\Events`, which **merges two
 * sources** and sorts the result by year:
 *
 *  1. `mwnf3.hcr` — the Discover Islamic Art country chronologies
 *     (`app/MWNF/SQL/mwnf3/Events.blade.php`). Importer keyspace
 *     `mwnf3:hcr:country:<cc>` — 18 timelines, 1,075 events.
 *  2. `mwnf3_sharing_history.sh_hcr` — but only exhibition 2, "Political
 *     Context", pinned by a comment that calls itself a "HARDCODED BUSINESS
 *     DECISION" in `app/MWNF/SQL/sh/Events.blade.php`. Importer keyspace
 *     `mwnf3_sharing_history:sh_hcr:country:<cc>:exhibition:2` — 19 timelines,
 *     315 events.
 *
 * Matching only the first source is a real mistake, not a theoretical one:
 * skipping it ships fewer country chronologies than the live API serves.
 * Widening to a bare `mwnf3:hcr:%` is the opposite mistake — it catches
 * the separate Baroque Art chronology (`mwnf3:hcr:bar:country:*`), which no DXA
 * gallery shows. Two exact families, no wildcard in the middle.
 *
 * The remaining Sharing History chronologies (exhibitions other than 2) stay
 * out for the same reason legacy leaves them out, and a country present only
 * in one of those other exhibitions disappears with them — which is why its
 * live `/events/count` can answer 0 even though the country exists in the
 * source data.
 *
 * Verified against a live DXA instance: per-country totals match on both
 * single-source countries and merged ones, and the merged total for a country
 * present in both sources is the sum of its two per-source counts.
 */
export const GLOBAL_TIMELINE_LIKE_PATTERNS = [
  // `\_` escapes the LIKE single-character wildcard so these match the literal
  // underscores in the keyspace rather than any character.
  'mwnf3:hcr:country:%',
  'mwnf3\\_sharing\\_history:sh\\_hcr:country:%:exhibition:2',
]

/**
 * The exhibition's OWN chronology (`mwnf3_thematic_gallery.hcr`), which a
 * gallery does not have.
 *
 * The exhibition spec said this timeline *replaces* the worldwide one. It does
 * not — the live instance serves both, from two different endpoints:
 * `/thg/timeline` returns the exhibition's own events, while `/events` returns
 * the same worldwide merge every gallery gets. The `hasTimeline` /
 * `hasCountryBasedTimeline` flags are what differ from one exhibition to the
 * next — an exhibition with no own chronology answers false on both — and
 * they gate nav entries rather than the data. So the package ships both sets
 * in one pair of files and each timeline says which chronology it belongs to
 * via `source`.
 *
 * Unlike the worldwide timelines this one has no `country_id` — it is a
 * narrative chronology of the exhibition's subject, not of a place — so it
 * contributes nothing to `countries.json`, which is why CountryExporter still
 * reads only GLOBAL_TIMELINE_LIKE_PATTERNS.
 */
export const localTimelineLikePattern = (galleryId: string): string =>
  `mwnf3\\_thematic\\_gallery:timeline:${galleryId}`

/**
 * The JS mirror of the SQL predicate below, kept next to the patterns it
 * evaluates so a test can pin the rule without a database. Both the query and
 * this function read the same `GLOBAL_TIMELINE_LIKE_PATTERNS`, so they cannot
 * drift apart.
 */
export function isGlobalCountryTimeline(backwardCompatibility: string | null | undefined): boolean {
  if (!backwardCompatibility) return false
  return GLOBAL_TIMELINE_LIKE_PATTERNS.some(pattern =>
    likePatternToRegExp(pattern).test(backwardCompatibility)
  )
}

/** Translates a MySQL LIKE pattern (`%`, `_`, `\_`, `\%`) into an anchored RegExp. */
function likePatternToRegExp(pattern: string): RegExp {
  let source = '^'
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]!
    if (char === '\\' && index + 1 < pattern.length) {
      index += 1
      source += escapeRegExp(pattern[index]!)
    } else if (char === '%') {
      source += '.*'
    } else if (char === '_') {
      source += '.'
    } else {
      source += escapeRegExp(char)
    }
  }
  return new RegExp(source + '$')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export class TimelineExporter extends BaseExporter {
  getName(): string {
    return 'Timelines'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting timelines.json / timeline_events.json...')

    const galleryId = legacyGalleryId(this.exhibition.backwardCompatibility)
    const patterns = [...GLOBAL_TIMELINE_LIKE_PATTERNS]
    if (galleryId) {
      patterns.push(localTimelineLikePattern(galleryId))
    } else {
      this.logger.warning(
        `timelines.json: could not read the legacy gallery id from ` +
          `${this.exhibition.backwardCompatibility} — the exhibition's own chronology is omitted`
      )
    }

    const timelines = await this.db.query<TimelineRow>(
      `SELECT id, internal_name, backward_compatibility, country_id
       FROM timelines
       WHERE ${patterns.map(() => 'backward_compatibility LIKE ?').join(' OR ')}
       ORDER BY country_id, backward_compatibility`,
      patterns
    )

    if (timelines.length === 0) {
      await this.writeJson('timelines.json', [])
      await this.writeJson('timeline_events.json', [])
      this.logger.warning('timelines.json (0 — no timelines found)')
      return { file: 'timelines.json', count: 0 }
    }

    const timelineIds = timelines.map(t => t.id)
    const events = await this.db.query<TimelineEventRow>(
      `SELECT id, timeline_id, year_from, year_to, year_from_ah, year_to_ah,
              date_from, date_to, display_order
       FROM timeline_events
       WHERE timeline_id IN (${this.placeholders(timelineIds.length)})
       ORDER BY timeline_id, display_order`,
      timelineIds
    )

    // A country can now carry two timelines (a DIA one and a Sharing History
    // one), which legacy merged into a single per-country list. `source` lets a
    // viewer group them the same way without re-parsing keyspaces.
    const timelineOutput = timelines.map(timeline => ({
      id: timeline.id,
      backward_compatibility: timeline.backward_compatibility,
      internal_name: timeline.internal_name,
      country_id: timeline.country_id,
      source: timelineSource(timeline.backward_compatibility),
    }))

    const countryCount = new Set(timelines.map(t => t.country_id).filter(Boolean)).size
    // Printed separately because conflating the two chronologies is exactly the
    // mistake this exporter exists to avoid: 37 worldwide timelines over 26
    // countries, plus 1 country-less chronology belonging to this exhibition.
    const localCount = timelines.filter(t => timelineSource(t.backward_compatibility) === 'thg_local')
      .length

    if (events.length === 0) {
      await this.writeJson('timelines.json', timelineOutput)
      await this.writeJson('timeline_events.json', [])
      this.logger.success(
        `timelines.json (${timelines.length} timelines — ${countryCount} countries + ` +
          `${localCount} exhibition-local, 0 events)`
      )
      return { file: 'timelines.json', count: timelines.length }
    }

    const eventIds = events.map(e => e.id)
    const eventPh = this.placeholders(eventIds.length)
    const langCodeMap = await this.buildLangCodeMap()

    const [translations, images, itemLinks] = await Promise.all([
      this.db.query<TimelineEventTranslationRow>(
        `SELECT timeline_event_id, language_id, name, description,
                date_from_description, date_to_description, date_from_ah_description
         FROM timeline_event_translations
         WHERE timeline_event_id IN (${eventPh})`,
        eventIds
      ),
      this.db.query<TimelineEventImageRow>(
        `SELECT timeline_event_id, path, alt_text, display_order
         FROM timeline_event_images
         WHERE timeline_event_id IN (${eventPh})
         ORDER BY timeline_event_id, display_order`,
        eventIds
      ),
      // Only members: an event may name items from any project, but this site
      // can only open the ones it ships.
      this.memberItemIds.length > 0
        ? this.db.query<TimelineEventItemRow>(
            `SELECT tei.timeline_event_id, tei.item_id, tei.display_order
             FROM timeline_event_item tei
             WHERE tei.timeline_event_id IN (${eventPh})
               AND tei.item_id IN (${this.placeholders(this.memberItemIds.length)})
             ORDER BY tei.timeline_event_id, tei.display_order`,
            [...eventIds, ...this.memberItemIds]
          )
        : Promise.resolve([]),
    ])

    const byLang = new Map<string, Record<string, unknown>>()
    for (const row of translations) {
      const code = langCodeMap.get(row.language_id)
      if (!code) continue
      const bucket = byLang.get(code) ?? {}
      bucket[row.timeline_event_id] = this.stripNulls({
        name: row.name,
        description: row.description,
        date_from_description: row.date_from_description,
        date_to_description: row.date_to_description,
        date_from_ah_description: row.date_from_ah_description,
      })
      byLang.set(code, bucket)
    }
    await this.writeTranslationFiles('timeline_events', byLang)

    const imageMap = new Map<string, unknown[]>()
    for (const image of images) {
      const entry = {
        url: this.imageUrl(image.path),
        alt_text: image.alt_text,
        display_order: image.display_order,
      }
      const bucket = imageMap.get(image.timeline_event_id)
      if (bucket) bucket.push(entry)
      else imageMap.set(image.timeline_event_id, [entry])
    }

    const itemMap = new Map<string, string[]>()
    for (const link of itemLinks) {
      const bucket = itemMap.get(link.timeline_event_id)
      if (bucket) bucket.push(link.item_id)
      else itemMap.set(link.timeline_event_id, [link.item_id])
    }

    const countryByTimeline = new Map(timelines.map(t => [t.id, t.country_id]))

    const eventOutput = events.map(event => ({
      id: event.id,
      timeline_id: event.timeline_id,
      country_id: countryByTimeline.get(event.timeline_id) ?? null,
      year_from: event.year_from,
      year_to: event.year_to,
      year_from_ah: event.year_from_ah,
      year_to_ah: event.year_to_ah,
      date_from: event.date_from,
      date_to: event.date_to,
      display_order: event.display_order,
      images: imageMap.get(event.id) ?? [],
      item_ids: itemMap.get(event.id) ?? [],
    }))

    await this.writeJson('timelines.json', timelineOutput)
    await this.writeJson('timeline_events.json', eventOutput)
    this.logger.success(
      `timelines.json (${timelines.length} timelines — ${countryCount} countries + ` +
        `${localCount} exhibition-local, ${eventOutput.length} events)`
    )

    return { file: 'timelines.json', count: timelines.length }
  }
}

/**
 * Which chronology a timeline came from. `mwnf3` and `sharing_history` are the
 * two halves of the worldwide country timeline that legacy merges per country;
 * `thg_local` is the exhibition's own, which legacy serves from a separate
 * endpoint and renders as its own page. A viewer must not merge the third into
 * the first two — it has no country to merge on.
 */
export function timelineSource(
  backwardCompatibility: string | null
): 'mwnf3' | 'sharing_history' | 'thg_local' | null {
  if (!backwardCompatibility) return null
  if (backwardCompatibility.startsWith('mwnf3_thematic_gallery:')) return 'thg_local'
  if (backwardCompatibility.startsWith('mwnf3_sharing_history:')) return 'sharing_history'
  if (backwardCompatibility.startsWith('mwnf3:')) return 'mwnf3'
  return null
}

/**
 * The legacy gallery id from the exhibition's own key —
 * `mwnf3_thematic_gallery:thg_gallery:<id>` → `<id>`. Returns null rather than
 * guessing when the key does not have that shape, and the caller then omits the
 * local chronology instead of matching an unintended LIKE pattern.
 */
export function legacyGalleryId(backwardCompatibility: string | null): string | null {
  if (!backwardCompatibility) return null
  const segments = backwardCompatibility.split(':')
  if (segments[0] !== 'mwnf3_thematic_gallery' || segments[1] !== 'thg_gallery') return null
  const id = segments[2]
  return id && /^\d+$/.test(id) ? id : null
}
