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
 * Matching only the first source is a mistake an earlier fork of this exporter
 * made: it undercounts against what the live API actually serves, because the
 * second source's countries and events are silently dropped. Widening to a
 * bare `mwnf3:hcr:%` is the opposite mistake — it catches the separate
 * Baroque Art chronology (`mwnf3:hcr:bar:country:*`), which no DXA gallery
 * shows. Two exact families, no wildcard in the middle.
 *
 * The remaining 142 Sharing History chronologies (exhibitions 1, 3–11) stay out
 * for the same reason legacy leaves them out, and North Macedonia disappears
 * with them: `mc` has exhibitions 4/5/8/9 and no exhibition 2, which is why the
 * live `/events/count?ic[]=mc` answers 0.
 *
 * Verified against a live gallery instance: per-country totals match on both
 * single-source countries and merged ones.
 */
export const GLOBAL_TIMELINE_LIKE_PATTERNS = [
  // `\_` escapes the LIKE single-character wildcard so these match the literal
  // underscores in the keyspace rather than any character.
  'mwnf3:hcr:country:%',
  'mwnf3\\_sharing\\_history:sh\\_hcr:country:%:exhibition:2',
]

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

    const timelines = await this.db.query<TimelineRow>(
      `SELECT id, internal_name, backward_compatibility, country_id
       FROM timelines
       WHERE ${GLOBAL_TIMELINE_LIKE_PATTERNS.map(() => 'backward_compatibility LIKE ?').join(' OR ')}
       ORDER BY country_id, backward_compatibility`,
      [...GLOBAL_TIMELINE_LIKE_PATTERNS]
    )

    if (timelines.length === 0) {
      await this.writeJson('timelines.json', [])
      await this.writeJson('timeline_events.json', [])
      this.logger.warning('timelines.json (0 — no global country timelines found)')
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

    if (events.length === 0) {
      await this.writeJson('timelines.json', timelineOutput)
      await this.writeJson('timeline_events.json', [])
      this.logger.success(
        `timelines.json (${timelines.length} timelines, ${countryCount} countries, 0 events)`
      )
      return { file: 'timelines.json', count: timelines.length }
    }

    const eventIds = events.map(e => e.id)
    const eventPh = this.placeholders(eventIds.length)
    const langCodeMap = await this.buildLangCodeMap()

    const [translations, images, itemLinks] = await Promise.all([
      this.db.query<TimelineEventTranslationRow>(
        // Row order is unspecified; sorted so two exports of one database are byte-identical.
        `SELECT timeline_event_id, language_id, name, description,
                date_from_description, date_to_description, date_from_ah_description
         FROM timeline_event_translations
         WHERE timeline_event_id IN (${eventPh})
         ORDER BY timeline_event_id, language_id`,
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
      `timelines.json (${timelines.length} timelines, ${countryCount} countries, ` +
        `${eventOutput.length} events)`
    )

    return { file: 'timelines.json', count: timelines.length }
  }
}

/** Which of the two merged chronologies a timeline came from. */
export function timelineSource(backwardCompatibility: string | null): 'mwnf3' | 'sharing_history' | null {
  if (!backwardCompatibility) return null
  if (backwardCompatibility.startsWith('mwnf3_sharing_history:')) return 'sharing_history'
  if (backwardCompatibility.startsWith('mwnf3:')) return 'mwnf3'
  return null
}
