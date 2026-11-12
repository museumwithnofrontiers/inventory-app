/**
 * Travels Itinerary Importer
 *
 * Creates Collection records for each itinerary from the Travels database.
 * Itineraries are routes within a trail, like "Itinerary I - The Seat of the Sultanate".
 *
 * Legacy schema:
 * - mwnf3_travels.tr_itineraries (project_id, country, number, lang, trail_id, title, description, days)
 *   - Composite key: (project_id, country, trail_id, number) identifies unique itinerary
 *   - Multiple rows per itinerary (one per language)
 *   - trail_id references trails.number
 *
 * New schema:
 * - collections (id, context_id, language_id, parent_id, type, internal_name, ...)
 *
 * Mapping:
 * - (project_id, country, trail_id, number) → backward_compatibility
 * - internal_name = 'travels:itinerary:{project_id}:{country}:{trail_id}:{number}' (namespaced; globally unique)
 * - Public titles are stored in collection_translations.title, not in internal_name
 * - type = 'itinerary'
 * - parent_id = trail collection
 *
 * Dependencies:
 * - TravelsContextImporter
 * - TravelsTrailImporter (must run first)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

/**
 * Legacy itinerary structure
 */
interface LegacyItinerary {
  project_id: string;
  country: string;
  number: string; // Roman numeral like 'I', 'II', etc.
  lang: string;
  trail_id: number;
  title: string;
  description: string | null;
  days: number | null;
}

/** The itinerary's number of days: the first positive value of its language rows. */
export function itineraryDays(rows: Pick<LegacyItinerary, 'days'>[]): number | null {
  for (const row of rows) {
    const days = row.days === null ? null : Number(row.days);
    if (days !== null && Number.isFinite(days) && days > 0) return days;
  }
  return null;
}

export class TravelsItineraryImporter extends BaseImporter {
  private travelsContextId: string | null = null;
  private defaultLanguageId: string = 'eng';

  getName(): string {
    return 'TravelsItineraryImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Looking up Travels context...');

      // Get the Travels context ID
      const travelsContextBackwardCompat = 'mwnf3_travels:context';
      this.travelsContextId = await this.getEntityUuidAsync(
        travelsContextBackwardCompat,
        'context'
      );

      if (!this.travelsContextId) {
        throw new Error(
          `Travels context not found (${travelsContextBackwardCompat}). Run TravelsContextImporter first.`
        );
      }

      // Get default language ID
      this.defaultLanguageId = await this.getDefaultLanguageIdAsync();

      this.logInfo('Importing itineraries...');

      // Query all itinerary rows and group by project/country/trail/number
      const itineraries = await this.context.legacyDb.query<LegacyItinerary>(
        `SELECT project_id, country, number, lang, trail_id, title, description, days
        FROM mwnf3_travels.tr_itineraries 
         ORDER BY project_id, country, trail_id, number, lang`
      );

      const groupedItineraries = new Map<string, LegacyItinerary[]>();
      for (const itinerary of itineraries) {
        const key = `${itinerary.project_id}:${itinerary.country}:${itinerary.trail_id}:${itinerary.number}`;
        const existingItineraries = groupedItineraries.get(key);
        if (existingItineraries) {
          existingItineraries.push(itinerary);
          continue;
        }

        groupedItineraries.set(key, [itinerary]);
      }

      this.logInfo(`Found ${groupedItineraries.size} itineraries to import`);

      for (const itineraryGroup of groupedItineraries.values()) {
        const legacy = itineraryGroup[0]!;
        try {
          const backwardCompat = `mwnf3_travels:itinerary:${legacy.project_id}:${legacy.country}:${legacy.trail_id}:${legacy.number}`;

          // Check if already exists
          if (await this.entityExistsAsync(backwardCompat, 'collection')) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Find parent trail collection
          const trailBackwardCompat = `mwnf3_travels:trail:${legacy.project_id}:${legacy.country}:${legacy.trail_id}`;
          const trailId = await this.getEntityUuidAsync(trailBackwardCompat, 'collection');

          if (!trailId) {
            this.logWarning(`Parent trail not found for itinerary: ${backwardCompat}`, {
              trailBackwardCompat,
            });
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const internalName = `travels:itinerary:${legacy.project_id}:${legacy.country}:${legacy.trail_id}:${legacy.number}`;

          // Collect sample
          this.collectSample(
            'itinerary',
            legacy as unknown as Record<string, unknown>,
            'success',
            `Itinerary ${legacy.project_id}/${legacy.country}/${legacy.trail_id}/${legacy.number}`
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create itinerary: ${internalName}`
            );
            this.registerEntity('', backwardCompat, 'collection');
            result.imported++;
            this.showProgress();
            continue;
          }

          // The itinerary's length, repeated on each language row in legacy:
          // stored once, never merged into a description.
          const days = itineraryDays(itineraryGroup);

          // Write collection
          const collectionId = await this.context.strategy.writeCollection({
            internal_name: internalName,
            backward_compatibility: backwardCompat,
            context_id: this.travelsContextId,
            language_id: this.defaultLanguageId,
            parent_id: trailId,
            type: 'itinerary',
            extra: days !== null ? JSON.stringify({ days }) : null,
            latitude: null,
            longitude: null,
            map_zoom: null,
            country_id: null,
          });

          this.registerEntity(collectionId, backwardCompat, 'collection');
          result.imported++;
          this.showProgress();
        } catch (error) {
          result.success = false;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Error importing itinerary ${legacy.project_id}/${legacy.country}/${legacy.trail_id}/${legacy.number}: ${errorMessage}`
          );
          this.logError('TravelsItineraryImporter', errorMessage, {
            project_id: legacy.project_id,
            country: legacy.country,
            trail_id: legacy.trail_id,
            number: legacy.number,
          });
          this.showError();
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in itinerary import: ${errorMessage}`);
      this.logError('TravelsItineraryImporter', errorMessage);
      this.showError();
    }

    return result;
  }
}
