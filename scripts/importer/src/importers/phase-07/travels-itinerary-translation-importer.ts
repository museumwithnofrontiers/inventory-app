/**
 * Travels Itinerary Translation Importer
 *
 * Creates CollectionTranslation records for each itinerary in all available languages.
 *
 * Legacy schema:
 * - mwnf3_travels.tr_itineraries (project_id, country, number, lang, trail_id, title, description, days)
 *   - One row per language
 *
 * New schema:
 * - collection_translations (collection_id, language_id, context_id, title, description, extra, ...)
 *
 * Mapping:
 * - description → description (that column only; the itinerary's days are
 *   stored once, on the collection's extra.days, by TravelsItineraryImporter)
 * - description2, author, introduction, prepared_by → extra (description_2,
 *   author, introduction, prepared_by), each only when set
 *
 * Dependencies:
 * - TravelsContextImporter
 * - TravelsItineraryImporter (must run first)
 * - LanguageImporter (for language lookup)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

/**
 * Legacy itinerary translation structure
 */
interface LegacyItineraryTranslation {
  project_id: string;
  country: string;
  number: string;
  lang: string;
  trail_id: number;
  title: string;
  description: string | null;
  description2: string | null;
  author: string | null;
  introduction: string | null;
  prepared_by: string | null;
}

/** The itinerary's text besides its title and description: each legacy column under its own key. */
export function itineraryTextExtra(
  legacy: Pick<
    LegacyItineraryTranslation,
    'description2' | 'author' | 'introduction' | 'prepared_by'
  >
): Record<string, string> | null {
  const fields = {
    description_2: legacy.description2,
    author: legacy.author,
    introduction: legacy.introduction,
    prepared_by: legacy.prepared_by,
  };
  const extra: Record<string, string> = {};
  for (const [key, raw] of Object.entries(fields)) {
    const value = raw?.trim();
    if (value) extra[key] = value;
  }
  return Object.keys(extra).length > 0 ? extra : null;
}

export class TravelsItineraryTranslationImporter extends BaseImporter {
  private travelsContextId!: string;

  getName(): string {
    return 'TravelsItineraryTranslationImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Looking up Travels context...');

      // Get the Travels context ID
      const travelsContextBackwardCompat = 'mwnf3_travels:context';
      const travelsContextId = await this.getEntityUuidAsync(
        travelsContextBackwardCompat,
        'context'
      );

      if (!travelsContextId) {
        throw new Error(
          `Travels context not found (${travelsContextBackwardCompat}). Run TravelsContextImporter first.`
        );
      }
      this.travelsContextId = travelsContextId;

      this.logInfo('Importing itinerary translations...');

      // Query all itinerary translations
      const translations = await this.context.legacyDb.query<LegacyItineraryTranslation>(
        `SELECT project_id, country, number, lang, trail_id, title, description,
                description2, author, introduction, prepared_by
        FROM mwnf3_travels.tr_itineraries 
         ORDER BY project_id, country, trail_id, number, lang`
      );

      this.logInfo(`Found ${translations.length} itinerary translations to import`);

      for (const legacy of translations) {
        try {
          const itineraryBackwardCompat = `mwnf3_travels:itinerary:${legacy.project_id}:${legacy.country}:${legacy.trail_id}:${legacy.number}`;
          const translationBackwardCompat = `${itineraryBackwardCompat}:translation:${legacy.lang}`;

          // Get parent itinerary collection ID
          const itineraryId = await this.getEntityUuidAsync(itineraryBackwardCompat, 'collection');
          if (!itineraryId) {
            this.logWarning(`Itinerary not found for translation: ${itineraryBackwardCompat}`, {
              lang: legacy.lang,
            });
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Get language ID from legacy code
          const languageId = await this.getLanguageIdByLegacyCodeAsync(legacy.lang);
          if (!languageId) {
            this.logWarning(`Language not found: ${legacy.lang}`, { itineraryBackwardCompat });
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Check if translation already exists
          const existsCheck = await this.context.strategy.findByBackwardCompatibility(
            'collection_translations',
            translationBackwardCompat
          );
          if (existsCheck) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const extra = itineraryTextExtra(legacy);

          // Collect sample
          this.collectSample(
            'itinerary_translation',
            legacy as unknown as Record<string, unknown>,
            'success',
            `Itinerary translation ${legacy.project_id}/${legacy.country}/${legacy.trail_id}/${legacy.number}:${legacy.lang}`,
            legacy.lang
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create itinerary translation: ${translationBackwardCompat}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          // Write translation
          await this.context.strategy.writeCollectionTranslation({
            collection_id: itineraryId,
            language_id: languageId,
            context_id: this.travelsContextId,
            backward_compatibility: translationBackwardCompat,
            title: legacy.title || '',
            description: legacy.description?.trim() || null,
            extra: extra ? JSON.stringify(extra) : null,
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          result.success = false;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Error importing itinerary translation ${legacy.project_id}/${legacy.country}/${legacy.trail_id}/${legacy.number}:${legacy.lang}: ${errorMessage}`
          );
          this.logError('TravelsItineraryTranslationImporter', errorMessage, {
            project_id: legacy.project_id,
            country: legacy.country,
            trail_id: legacy.trail_id,
            number: legacy.number,
            lang: legacy.lang,
          });
          this.showError();
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in itinerary translation import: ${errorMessage}`);
      this.logError('TravelsItineraryTranslationImporter', errorMessage);
      this.showError();
    }

    return result;
  }
}
