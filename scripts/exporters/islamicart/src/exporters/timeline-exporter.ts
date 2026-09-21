import type { ExportResult } from '../core/types.js'
import { BaseExporter } from './base-exporter.js'

interface TimelineRow {
  id: string
  internal_name: string
  backward_compatibility: string | null
  country_id: string | null
  collection_id: string | null
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

export class TimelineExporter extends BaseExporter {
  getName(): string {
    return 'Timelines'
  }

  async export(): Promise<ExportResult> {
    this.logger.info('Exporting timelines.json / timeline_events.json...')

    const ph = this.placeholders(this.projectIds.length)

    // Timelines are scoped to a project the same way collections are: via the
    // collection's context_id chain to the project. Timelines with no
    // collection_id are the direct mwnf3 HCR import (per-country history),
    // which the importer only ever produces for the ISL project — every other
    // project's timelines (BAR, SH exhibitions, THG) are always bound to a
    // project-specific collection. So a null collection_id unambiguously means
    // ISL, not a guess: it's an invariant of how the importer writes this data.
    const includeUnlinkedIslTimelines = this.context.projectKeys.includes('ISL')

    const timelines = await this.db.query<TimelineRow>(
      `SELECT t.id, t.internal_name, t.backward_compatibility, t.country_id, t.collection_id
       FROM timelines t
       WHERE t.collection_id IN (
         SELECT c.id FROM collections c
         WHERE c.context_id IN (
           SELECT p.context_id FROM projects p WHERE p.id IN (${ph})
         )
       )
       ${includeUnlinkedIslTimelines ? 'OR t.collection_id IS NULL' : ''}
       ORDER BY t.country_id, t.internal_name`,
      this.projectIds
    )

    if (timelines.length === 0) {
      await this.writeJson('timelines.json', [])
      await this.writeJson('timeline_events.json', [])
      this.logger.warning('timelines.json (0 — no timelines in project scope)')
      return { file: 'timelines.json', count: 0 }
    }

    const timelineIds = timelines.map(t => t.id)
    const timelinePh = this.placeholders(timelineIds.length)
    const langCodeMap = await this.buildLangCodeMap()

    const events = await this.db.query<TimelineEventRow>(
      `SELECT id, timeline_id, year_from, year_to, year_from_ah, year_to_ah,
              date_from, date_to, display_order
       FROM timeline_events
       WHERE timeline_id IN (${timelinePh})
       ORDER BY timeline_id, display_order`,
      timelineIds
    )

    const countryMap = new Map(timelines.map(t => [t.id, t.country_id]))

    if (events.length === 0) {
      await this.writeJson('timelines.json', this.buildTimelineOutput(timelines))
      await this.writeJson('timeline_events.json', [])
      this.logger.success(`timelines.json (${timelines.length} timelines, 0 events)`)
      return { file: 'timelines.json', count: timelines.length }
    }

    const eventIds = events.map(e => e.id)
    const eventPh = this.placeholders(eventIds.length)

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
      // Items linked to these events, restricted to non-picture items from the project
      this.db.query<TimelineEventItemRow>(
        `SELECT tei.timeline_event_id, tei.item_id, tei.display_order
         FROM timeline_event_item tei
         JOIN items i ON i.id = tei.item_id
         WHERE tei.timeline_event_id IN (${eventPh})
           AND i.project_id IN (${ph})
           AND i.type IN ('object', 'monument', 'detail')
         ORDER BY tei.timeline_event_id, tei.display_order`,
        [...eventIds, ...this.projectIds]
      ),
    ])

    // event_id -> lang_code -> fields
    const translationMap = new Map<string, Record<string, Record<string, unknown>>>()
    for (const t of translations) {
      if (!translationMap.has(t.timeline_event_id)) translationMap.set(t.timeline_event_id, {})
      const code = langCodeMap.get(t.language_id)
      if (!code) continue
      translationMap.get(t.timeline_event_id)![code] = {
        name: t.name,
        description: t.description,
        date_from_description: t.date_from_description,
        date_to_description: t.date_to_description,
        date_from_ah_description: t.date_from_ah_description,
      }
    }

    // Write one translations/timeline_events.{lang}.json per language (null fields omitted)
    const byLang = new Map<string, Record<string, unknown>>()
    for (const [eventId, langMap] of translationMap) {
      for (const [langCode, fields] of Object.entries(langMap)) {
        if (!byLang.has(langCode)) byLang.set(langCode, {})
        byLang.get(langCode)![eventId] = this.stripNulls(fields)
      }
    }
    await this.writeTranslationFiles('timeline_events', byLang)

    // event_id -> images[]
    const imageMap = new Map<string, { url: string; alt_text: string | null; display_order: number }[]>()
    for (const img of images) {
      if (!imageMap.has(img.timeline_event_id)) imageMap.set(img.timeline_event_id, [])
      imageMap.get(img.timeline_event_id)!.push({
        url: this.imageUrl(img.path),
        alt_text: img.alt_text,
        display_order: img.display_order,
      })
    }

    // event_id -> item_ids[]
    const itemMap = new Map<string, string[]>()
    for (const link of itemLinks) {
      if (!itemMap.has(link.timeline_event_id)) itemMap.set(link.timeline_event_id, [])
      itemMap.get(link.timeline_event_id)!.push(link.item_id)
    }

    const eventOutput = events.map(e => ({
      id: e.id,
      timeline_id: e.timeline_id,
      country_id: countryMap.get(e.timeline_id) ?? null,
      year_from: e.year_from,
      year_to: e.year_to,
      year_from_ah: e.year_from_ah,
      year_to_ah: e.year_to_ah,
      date_from: e.date_from,
      date_to: e.date_to,
      display_order: e.display_order,
      images: imageMap.get(e.id) ?? [],
      item_ids: itemMap.get(e.id) ?? [],
    }))

    await this.writeJson('timelines.json', this.buildTimelineOutput(timelines))
    await this.writeJson('timeline_events.json', eventOutput)
    this.logger.success(`timelines.json (${timelines.length} timelines, ${eventOutput.length} events)`)

    return { file: 'timelines.json', count: timelines.length }
  }

  private buildTimelineOutput(timelines: TimelineRow[]): unknown[] {
    return timelines.map(t => ({
      id: t.id,
      internal_name: t.internal_name,
      country_id: t.country_id,
      collection_id: t.collection_id,
    }))
  }
}
