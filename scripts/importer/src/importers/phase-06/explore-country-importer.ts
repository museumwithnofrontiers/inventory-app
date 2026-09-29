/**
 * Explore Country Importer
 *
 * Creates Collection records for each unique country in the Explore locations.
 * Countries serve as containers under "Explore by Country".
 *
 * Legacy schema:
 * - mwnf3_explore.locations (countryId references existing countries)
 * - mwnf3_explore.countries (countryId, geoCoordinates, zoom, path)
 * - mwnf3_explore.explorecountry (countryId, showOnLocation, showOnMonument)
 *
 * New schema:
 * - collections (id, context_id, language_id, parent_id, type, internal_name, backward_compatibility, country_id,
 *   latitude, longitude, map_zoom)
 *
 * Mapping:
 * - countryId → backward_compatibility (mwnf3_explore:country:{countryId})
 * - countryId → country_id (FK to countries table)
 * - country name → internal_name (human-readable title)
 * - countries.geoCoordinates, zoom → latitude, longitude, map_zoom: where the
 *   country's map is centred; set on a country imported before they were carried
 * - type = 'collection'
 * - parent_id = explore_by_country root collection
 *
 * Dependencies:
 * - ExploreContextImporter
 * - ExploreRootCollectionsImporter
 * - CountryImporter (countries must exist)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { parseGeoCoordinates } from '../../domain/transformers/explore-monument-transformer.js';
import { mapCountryCode } from '../../utils/code-mappings.js';

/**
 * Country info from locations, with its map position from `countries`
 */
interface LegacyExploreCountry {
  countryId: string;
  geoCoordinates: string | null;
  zoom: number | null;
}

/** A country's position, or none: a zoom means nothing without coordinates. */
export function countryGeo(legacy: Pick<LegacyExploreCountry, 'geoCoordinates' | 'zoom'>): {
  latitude: number | null;
  longitude: number | null;
  map_zoom: number | null;
} {
  const [latitude, longitude] = parseGeoCoordinates(legacy.geoCoordinates ?? null);
  if (latitude === null || longitude === null) {
    return { latitude: null, longitude: null, map_zoom: null };
  }
  return { latitude, longitude, map_zoom: legacy.zoom ?? null };
}

export class ExploreCountryImporter extends BaseImporter {
  private exploreContextId!: string;
  private exploreByCountryId: string | null = null;
  private defaultLanguageId: string = 'eng';

  getName(): string {
    return 'ExploreCountryImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Looking up Explore context and root collection...');

      // Get the Explore context ID
      const exploreContextBackwardCompat = 'mwnf3_explore:context';
      const exploreContextId = await this.getEntityUuidAsync(
        exploreContextBackwardCompat,
        'context'
      );

      if (!exploreContextId) {
        throw new Error(
          `Explore context not found (${exploreContextBackwardCompat}). Run ExploreContextImporter first.`
        );
      }
      this.exploreContextId = exploreContextId;

      // Get the "Explore by Country" root collection
      const exploreByCountryBackwardCompat = 'mwnf3_explore:root:explore_by_country';
      this.exploreByCountryId = await this.getEntityUuidAsync(
        exploreByCountryBackwardCompat,
        'collection'
      );

      if (!this.exploreByCountryId) {
        throw new Error(
          `Explore by Country collection not found (${exploreByCountryBackwardCompat}). Run ExploreRootCollectionsImporter first.`
        );
      }

      this.defaultLanguageId = await this.getDefaultLanguageIdAsync();

      this.logInfo(`Found Explore context: ${this.exploreContextId}`);
      this.logInfo(`Found Explore by Country: ${this.exploreByCountryId}`);
      this.logInfo('Importing countries from Explore locations...');

      // Get distinct countries from locations table
      const countries = await this.context.legacyDb.query<LegacyExploreCountry>(
        `SELECT l.countryId, c.geoCoordinates, c.zoom
         FROM (SELECT DISTINCT countryId FROM mwnf3_explore.locations
               WHERE countryId IS NOT NULL AND countryId != '') l
         LEFT JOIN mwnf3_explore.countries c ON c.countryId = l.countryId
         ORDER BY l.countryId`
      );

      this.logInfo(`Found ${countries.length} unique countries in Explore locations`);

      for (const legacy of countries) {
        try {
          const backwardCompat = `mwnf3_explore:country:${legacy.countryId}`;
          const geo = countryGeo(legacy);

          // Already imported: only make sure it carries its position, which
          // countries imported before it was kept lack.
          if (await this.entityExistsAsync(backwardCompat, 'collection')) {
            const existingId = await this.getEntityUuidAsync(backwardCompat, 'collection');
            if (existingId && !this.isDryRun && !this.isSampleOnlyMode) {
              await this.context.strategy.updateCollectionGeo(
                existingId,
                geo.latitude,
                geo.longitude,
                geo.map_zoom
              );
            }
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Map country ID (legacy uses 2-letter, our system uses 3-letter ISO codes)
          const countryId = mapCountryCode(legacy.countryId);

          const countryName = await this.getCountryName(legacy.countryId);
          let internalName = '';
          if (countryName && countryName.trim() !== '') {
            internalName = countryName;
          } else {
            internalName = legacy.countryId.toUpperCase();
            this.logWarning(
              `Explore country ${backwardCompat} missing country name, using ${internalName} instead`
            );
          }

          // Collect sample
          this.collectSample(
            'explore_country',
            legacy as unknown as Record<string, unknown>,
            'success'
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create collection: ${internalName} (${backwardCompat})`
            );
            this.registerEntity('', backwardCompat, 'collection');
            result.imported++;
            this.showProgress();
            continue;
          }

          // Write collection using strategy
          const collectionId = await this.context.strategy.writeCollection({
            internal_name: internalName,
            backward_compatibility: backwardCompat,
            context_id: this.exploreContextId,
            language_id: this.defaultLanguageId,
            parent_id: this.exploreByCountryId,
            type: 'collection',
            ...geo,
            country_id: countryId,
          });

          this.registerEntity(collectionId, backwardCompat, 'collection');

          // Create translation - use country name if available
          const translationBackwardCompat = `${backwardCompat}:translation:${this.defaultLanguageId}`;

          await this.context.strategy.writeCollectionTranslation({
            collection_id: collectionId,
            language_id: this.defaultLanguageId,
            context_id: this.exploreContextId,
            backward_compatibility: translationBackwardCompat,
            title: countryName || legacy.countryId.toUpperCase(),
            description: '',
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          result.success = false;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Error importing country ${legacy.countryId}: ${errorMessage}`);
          this.logError('ExploreCountryImporter', errorMessage, { countryId: legacy.countryId });
          this.showError();
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in country import: ${errorMessage}`);
      this.logError('ExploreCountryImporter', errorMessage);
      this.showError();
    }

    return result;
  }

  /**
   * Get country name from legacy database
   */
  private async getCountryName(countryId: string): Promise<string | null> {
    try {
      const result = await this.context.legacyDb.query<{ name: string }>(
        `SELECT name FROM mwnf3.countries WHERE country = ? LIMIT 1`,
        [countryId]
      );
      return result.length > 0 ? result[0].name : null;
    } catch (error) {
      throw new Error(`Failed to resolve country name for Explore country ${countryId}`, {
        cause: error,
      });
    }
  }
}
