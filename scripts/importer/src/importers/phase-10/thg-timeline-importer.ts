/**
 * THG Timeline Importer
 *
 * Imports THG exhibition timeline data from mwnf3_thematic_gallery.hcr and
 * mwnf3_thematic_gallery.hcr_events into timeline/timeline_event/timeline_event_translation
 * records, binding each timeline to the corresponding gallery/exhibition collection.
 *
 * Legacy schema:
 * - mwnf3_thematic_gallery.hcr (hcr_id, gallery_id, name, from_ad, to_ad, ...)
 * - mwnf3_thematic_gallery.hcr_events (hcr_id, lang, name, description, ...)
 *
 * New schema:
 * - timelines  (bound to the gallery collection via collection_id)
 * - timeline_events
 * - timeline_event_translations
 *
 * Backward compatibility keys:
 * - Timeline:       mwnf3_thematic_gallery:timeline:{gallery_id}
 * - TimelineEvent:  mwnf3_thematic_gallery:hcr:{hcr_id}
 *
 * Must run AFTER phase-10 (THG gallery collections exist).
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

/**
 * THG HCR row — one entry per chronology/timeline event
 * PK: hcr_id
 */
interface ThgLegacyHcr {
  hcr_id: number;
  gallery_id: number;
  name: string;
  from_ad: number | null;
  to_ad: number | null;
  from_ah: number | null;
  to_ah: number | null;
}

/**
 * THG HCR event translation row
 * PK: (hcr_id, lang)
 */
interface ThgLegacyHcrEvent {
  hcr_id: number;
  lang_id: string; // 2-char legacy language code
  name: string | null;
  description: string | null;
  datedesc_ah: string | null;
  datedesc_ad: string | null;
}

export class ThgTimelineImporter extends BaseImporter {
  getName(): string {
    return 'ThgTimelineImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing THG exhibition timelines from mwnf3_thematic_gallery.hcr...');

      // Load all THG HCR rows
      let hcrRows: ThgLegacyHcr[];
      try {
        hcrRows = await this.context.legacyDb.query<ThgLegacyHcr>(
          `SELECT hcr_id, gallery_id, name, from_ad, to_ad, from_ah, to_ah
           FROM mwnf3_thematic_gallery.hcr
           ORDER BY gallery_id, from_ad, hcr_id`
        );
      } catch (queryError) {
        const message = queryError instanceof Error ? queryError.message : String(queryError);
        if (message.includes("doesn't exist") || message.includes('Table') || message.includes('Unknown')) {
          this.logInfo(`⚠️ THG hcr table not available: ${message}`);
          result.warnings = result.warnings || [];
          result.warnings.push(`THG hcr table not available: ${message}`);
          result.success = true;
          return result;
        }
        throw queryError;
      }

      this.logInfo(`Found ${hcrRows.length} THG HCR rows`);

      // Load all THG HCR event translations
      let hcrEvents: ThgLegacyHcrEvent[];
      try {
        hcrEvents = await this.context.legacyDb.query<ThgLegacyHcrEvent>(
          `SELECT hcr_id, lang_id, name, description, datedesc_ah, datedesc_ad
           FROM mwnf3_thematic_gallery.hcr_events
           ORDER BY hcr_id, lang_id`
        );
      } catch {
        hcrEvents = [];
        result.warnings = result.warnings || [];
        result.warnings.push('THG hcr_events table not available; timeline events will have no translations');
      }

      this.logInfo(`Found ${hcrEvents.length} THG HCR event translations`);

      // Group events by hcr_id
      const eventsByHcrId = new Map<number, ThgLegacyHcrEvent[]>();
      for (const evt of hcrEvents) {
        const existing = eventsByHcrId.get(evt.hcr_id) ?? [];
        existing.push(evt);
        eventsByHcrId.set(evt.hcr_id, existing);
      }

      // Group HCR rows by gallery_id — one timeline per gallery
      const byGallery = new Map<number, ThgLegacyHcr[]>();
      for (const row of hcrRows) {
        const existing = byGallery.get(row.gallery_id) ?? [];
        existing.push(row);
        byGallery.set(row.gallery_id, existing);
      }

      this.logInfo(`Found ${byGallery.size} THG timelines (grouped by gallery_id)`);

      for (const [galleryId, events] of byGallery) {
        try {
          const timelineBC = `mwnf3_thematic_gallery:timeline:${galleryId}`;

          if (await this.entityExistsAsync(timelineBC, 'timeline')) {
            result.skipped += 1 + events.length;
            this.showSkipped();
            continue;
          }

          // Resolve the gallery collection
          const galleryBC = `mwnf3_thematic_gallery:thg_gallery:${galleryId}`;
          const collectionId = await this.getEntityUuidAsync(galleryBC, 'collection');
          if (!collectionId) {
            this.logWarning(
              `Gallery ${galleryId}: collection not found (${galleryBC}), skipping timeline`
            );
            result.skipped += 1 + events.length;
            this.showSkipped();
            continue;
          }

          const internalName = `thg_timeline_${galleryId}`;

          this.collectSample(
            'thg_timeline',
            { gallery_id: galleryId, events: events.length } as unknown as Record<string, unknown>,
            'success'
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create THG timeline: ${internalName} (${events.length} events)`
            );
            this.registerEntity('sample-thg-timeline-' + galleryId, timelineBC, 'timeline');
            result.imported += 1 + events.length;
            this.showProgress();
            continue;
          }

          // Create timeline bound to the gallery collection
          const timelineId = await this.context.strategy.writeTimeline({
            internal_name: internalName,
            country_id: null,
            collection_id: collectionId,
            backward_compatibility: timelineBC,
          });
          this.registerEntity(timelineId, timelineBC, 'timeline');
          result.imported++;
          this.showProgress();

          // Create timeline events
          let displayOrder = 1;
          for (const hcr of events) {
            try {
              const eventBC = `mwnf3_thematic_gallery:hcr:${hcr.hcr_id}`;

              if (await this.entityExistsAsync(eventBC, 'timeline_event')) {
                result.skipped++;
                this.showSkipped();
                continue;
              }

              const eventId = await this.context.strategy.writeTimelineEvent({
                timeline_id: timelineId,
                internal_name: hcr.name || `hcr_${hcr.hcr_id}`,
                year_from: hcr.from_ad ?? 0,
                year_to: hcr.to_ad ?? null,
                year_from_ah: hcr.from_ah ?? null,
                year_to_ah: hcr.to_ah ?? null,
                date_from: null,
                date_to: null,
                display_order: displayOrder,
                backward_compatibility: eventBC,
              });
              this.registerEntity(eventId, eventBC, 'timeline_event');
              result.imported++;
              displayOrder++;

              // Create event translations
              const translations = eventsByHcrId.get(hcr.hcr_id) ?? [];
              for (const trans of translations) {
                try {
                  if (!trans.lang_id) {
                    this.logWarning(
                      `THG HCR event ${hcr.hcr_id}: translation row has no language value (table: hcr_events, pk: hcr_id=${hcr.hcr_id}), skipping`
                    );
                    continue;
                  }
                  const languageId = await this.getLanguageIdByLegacyCodeAsync(trans.lang_id);
                  if (!languageId) {
                    this.logWarning(
                      `THG HCR event ${hcr.hcr_id}: unknown language '${trans.lang_id}', skipping translation`
                    );
                    continue;
                  }

                  await this.context.strategy.writeTimelineEventTranslation({
                    timeline_event_id: eventId,
                    language_id: languageId,
                    name: trans.name || hcr.name,
                    description: trans.description ?? null,
                    date_from_description: trans.datedesc_ad ?? null,
                    date_from_ah_description: trans.datedesc_ah ?? null,
                  });
                  result.imported++;
                } catch (transError) {
                  const message = transError instanceof Error ? transError.message : String(transError);
                  this.logWarning(
                    `THG HCR event ${hcr.hcr_id} lang ${trans.lang_id}: ${message}`
                  );
                }
              }

              this.showProgress();
            } catch (eventError) {
              const message = eventError instanceof Error ? eventError.message : String(eventError);
              result.errors.push(`THG HCR event ${hcr.hcr_id}: ${message}`);
              this.logError(`THG HCR event ${hcr.hcr_id}`, message);
              this.showError();
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`THG timeline gallery_id=${galleryId}: ${message}`);
          this.logError(`THG timeline gallery_id=${galleryId}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ThgTimelineImporter', message);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
