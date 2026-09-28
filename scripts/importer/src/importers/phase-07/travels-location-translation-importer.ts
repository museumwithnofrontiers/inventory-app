/**
 * Travels Location Translation Importer
 *
 * Creates CollectionTranslation records for each location in all available languages.
 *
 * Legacy schema:
 * - mwnf3_travels.tr_locations (project_id, country, itinerary_id, number, lang, trail_id, title,
 *   description, author, about, prepared_by)
 *   - One row per language
 *
 * New schema:
 * - collection_translations (collection_id, language_id, context_id, title, description, extra, ...)
 *
 * Mapping:
 * - title → title
 * - description → description: the location's introduction, which Explore also
 *   shows as a location's historical background
 * - author, about, prepared_by → extra, each only when set
 *
 * A translation imported before its text was carried keeps its row: the text is
 * filled in on it rather than skipped.
 *
 * Dependencies:
 * - TravelsContextImporter
 * - TravelsLocationImporter (must run first)
 * - LanguageImporter (for language lookup)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

/**
 * Legacy location translation structure
 */
interface LegacyLocationTranslation {
  project_id: string;
  country: string;
  itinerary_id: string;
  number: number;
  lang: string;
  trail_id: number;
  title: string;
  description: string | null;
  author: string | null;
  about: string | null;
  prepared_by: string | null;
}

/** The location's text besides its title and introduction: who wrote it, and about whom. */
export function locationTextExtra(
  legacy: Pick<LegacyLocationTranslation, 'author' | 'about' | 'prepared_by'>
): Record<string, string> | null {
  const extra: Record<string, string> = {};
  for (const field of ['author', 'about', 'prepared_by'] as const) {
    const value = legacy[field]?.trim();
    if (value) extra[field] = value;
  }
  return Object.keys(extra).length > 0 ? extra : null;
}

function locationDescription(legacy: LegacyLocationTranslation): string | null {
  return legacy.description && legacy.description.trim() ? legacy.description : null;
}

export class TravelsLocationTranslationImporter extends BaseImporter {
  private travelsContextId!: string;

  getName(): string {
    return 'TravelsLocationTranslationImporter';
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

      this.logInfo('Importing location translations...');

      // Query all location translations
      const translations = await this.context.legacyDb.query<LegacyLocationTranslation>(
        `SELECT project_id, country, itinerary_id, number, lang, trail_id, title,
                description, author, about, prepared_by
        FROM mwnf3_travels.tr_locations
         ORDER BY project_id, country, trail_id, itinerary_id, number, lang`
      );

      this.logInfo(`Found ${translations.length} location translations to import`);

      for (const legacy of translations) {
        try {
          const locationBackwardCompat = `mwnf3_travels:location:${legacy.project_id}:${legacy.country}:${legacy.trail_id}:${legacy.itinerary_id}:${legacy.number}`;
          const translationBackwardCompat = `${locationBackwardCompat}:translation:${legacy.lang}`;

          // Get parent location collection ID
          const locationId = await this.getEntityUuidAsync(locationBackwardCompat, 'collection');
          if (!locationId) {
            this.logWarning(`Location not found for translation: ${locationBackwardCompat}`, {
              lang: legacy.lang,
            });
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Get language ID from legacy code
          const languageId = await this.getLanguageIdByLegacyCodeAsync(legacy.lang);
          if (!languageId) {
            this.logWarning(`Language not found: ${legacy.lang}`, { locationBackwardCompat });
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
            if (!this.isDryRun && !this.isSampleOnlyMode) {
              await this.fillLocationText(locationId, languageId, legacy);
            }
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Collect sample
          this.collectSample(
            'location_translation',
            legacy as unknown as Record<string, unknown>,
            'success',
            `Location translation ${legacy.project_id}/${legacy.country}/${legacy.trail_id}/${legacy.itinerary_id}/${legacy.number}:${legacy.lang}`,
            legacy.lang
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create location translation: ${translationBackwardCompat}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          const extra = locationTextExtra(legacy);
          await this.context.strategy.writeCollectionTranslation({
            collection_id: locationId,
            language_id: languageId,
            context_id: this.travelsContextId,
            backward_compatibility: translationBackwardCompat,
            title: legacy.title || '',
            description: locationDescription(legacy),
            extra: extra ? JSON.stringify(extra) : null,
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          result.success = false;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Error importing location translation ${legacy.project_id}/${legacy.country}/${legacy.trail_id}/${legacy.itinerary_id}/${legacy.number}:${legacy.lang}: ${errorMessage}`
          );
          this.logError('TravelsLocationTranslationImporter', errorMessage, {
            project_id: legacy.project_id,
            country: legacy.country,
            trail_id: legacy.trail_id,
            itinerary_id: legacy.itinerary_id,
            number: legacy.number,
            lang: legacy.lang,
          });
          this.showError();
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in location translation import: ${errorMessage}`);
      this.logError('TravelsLocationTranslationImporter', errorMessage);
      this.showError();
    }

    return result;
  }

  /**
   * Brings the text onto a translation written before it was imported. Its
   * `extra` is merged, not replaced, so whatever else it holds stays.
   */
  private async fillLocationText(
    collectionId: string,
    languageId: string,
    legacy: LegacyLocationTranslation
  ): Promise<void> {
    const description = locationDescription(legacy);
    const text = locationTextExtra(legacy);
    if (!description && !text) return;

    const current = await this.context.strategy.getCollectionTranslationByKey(
      collectionId,
      languageId,
      this.travelsContextId
    );
    if (!current) return;

    if (description) {
      await this.context.strategy.setCollectionTranslationDescriptionByKey(
        collectionId,
        languageId,
        this.travelsContextId,
        description
      );
    }
    if (text) {
      await this.context.strategy.setCollectionTranslationExtraByKey(
        collectionId,
        languageId,
        this.travelsContextId,
        JSON.stringify({ ...(current.extra ?? {}), ...text })
      );
    }
  }
}
