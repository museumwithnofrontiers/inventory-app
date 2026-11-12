/**
 * Travels Trail Translation Importer
 *
 * Creates CollectionTranslation records for each trail in all available languages.
 *
 * Legacy schema:
 * - mwnf3_travels.trails (project_id, country, lang, number, title, subtitle, description, ...)
 *   - One row per language
 *
 * New schema:
 * - collection_translations (collection_id, language_id, context_id, title, description, ...)
 *
 * Mapping:
 * - title → title
 * - description → description (that column only: nothing is merged into it)
 * - subtitle, curated_by, local_coordinator, photo_by, region_territory → extra,
 *   one key per legacy column, each only when set
 * - lang → language_id (via legacy code lookup)
 *
 * Dependencies:
 * - TravelsContextImporter
 * - TravelsTrailImporter (must run first to create trail collections)
 * - LanguageImporter (for language lookup)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

/**
 * Legacy trail translation structure
 */
interface LegacyTrailTranslation {
  project_id: string;
  country: string;
  lang: string;
  number: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  curated_by: string | null;
  local_coordinator: string | null;
  photo_by: string | null;
  region_territory: string | null;
}

const TRAIL_EXTRA_FIELDS = [
  'subtitle',
  'curated_by',
  'local_coordinator',
  'photo_by',
  'region_territory',
] as const;

/** The trail's text besides its title and description: each legacy column under its own key. */
export function trailTextExtra(
  legacy: Pick<LegacyTrailTranslation, (typeof TRAIL_EXTRA_FIELDS)[number]>
): Record<string, string> | null {
  const extra: Record<string, string> = {};
  for (const field of TRAIL_EXTRA_FIELDS) {
    const value = legacy[field]?.trim();
    if (value) extra[field] = value;
  }
  return Object.keys(extra).length > 0 ? extra : null;
}

export class TravelsTrailTranslationImporter extends BaseImporter {
  private travelsContextId!: string;

  getName(): string {
    return 'TravelsTrailTranslationImporter';
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

      this.logInfo('Importing trail translations...');

      // Query all trail translations (all languages)
      const translations = await this.context.legacyDb.query<LegacyTrailTranslation>(
        `SELECT project_id, country, lang, number, title, subtitle, description, 
                curated_by, local_coordinator, photo_by, region_territory
         FROM mwnf3_travels.trails 
         ORDER BY project_id, country, number, lang`
      );

      this.logInfo(`Found ${translations.length} trail translations to import`);

      for (const legacy of translations) {
        try {
          const trailBackwardCompat = `mwnf3_travels:trail:${legacy.project_id}:${legacy.country}:${legacy.number}`;
          const translationBackwardCompat = `${trailBackwardCompat}:translation:${legacy.lang}`;

          // Get parent trail collection ID
          const trailId = await this.getEntityUuidAsync(trailBackwardCompat, 'collection');
          if (!trailId) {
            this.logWarning(`Trail not found for translation: ${trailBackwardCompat}`, {
              lang: legacy.lang,
            });
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Get language ID from legacy code
          const languageId = await this.getLanguageIdByLegacyCodeAsync(legacy.lang);
          if (!languageId) {
            this.logWarning(`Language not found: ${legacy.lang}`, { trailBackwardCompat });
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

          const extra = trailTextExtra(legacy);

          // Collect sample
          this.collectSample(
            'trail_translation',
            legacy as unknown as Record<string, unknown>,
            'success',
            `Trail translation ${legacy.project_id}/${legacy.country}/${legacy.number}:${legacy.lang}`,
            legacy.lang
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create trail translation: ${translationBackwardCompat}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          // Write translation
          await this.context.strategy.writeCollectionTranslation({
            collection_id: trailId,
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
            `Error importing trail translation ${legacy.project_id}/${legacy.country}/${legacy.number}:${legacy.lang}: ${errorMessage}`
          );
          this.logError('TravelsTrailTranslationImporter', errorMessage, {
            project_id: legacy.project_id,
            country: legacy.country,
            number: legacy.number,
            lang: legacy.lang,
          });
          this.showError();
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in trail translation import: ${errorMessage}`);
      this.logError('TravelsTrailTranslationImporter', errorMessage);
      this.showError();
    }

    return result;
  }
}
