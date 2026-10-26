/**
 * Explore Region Importer (Story 11.1)
 *
 * Creates Collection records for regions from the Explore database.
 * Regions are administrative divisions within countries,
 * parented under their respective country collections.
 *
 * Legacy schema:
 * - mwnf3_explore.regions (regionId, countryId, label, geoCoordinates, zoom, type)
 * - mwnf3_explore.regiontranslated (regionId, langId, spelling, description)
 * - mwnf3_explore.regionsthemes (regionId, themeId)
 *
 * New schema:
 * - collections (type='region', parent_id → country collection)
 * - collection_translations
 *
 * BC: mwnf3_explore:region:{regionId}
 *
 * Dependencies:
 * - ExploreContextImporter
 * - ExploreCountryImporter (parent country collections must exist)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { mapLanguageCode } from '../../utils/code-mappings.js';
import { selectItemInternalName } from '../../domain/transformers/item-internal-name-transformer.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';

function parseGeoCoordinates(coords: string | null): [number | null, number | null] {
  if (!coords || !coords.trim()) return [null, null];
  const cleaned = coords.replace(/\s+/g, '').trim();
  const parts = cleaned.split(',');
  if (parts.length !== 2) return [null, null];
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lon)) return [null, null];
  return [lat, lon];
}

interface LegacyRegion {
  regionId: number;
  countryId: string;
  label: string;
  geoCoordinates: string | null;
  zoom: number | null;
  type: number | null;
}

interface LegacyRegionTranslation {
  regionId: number;
  langId: string;
  spelling: string;
  description: string | null;
}

interface LegacyRegionTheme {
  regionId: number;
  themeId: number;
}

export class ExploreRegionImporter extends BaseImporter {
  private exploreContextId!: string;
  private countryCollectionCache: Map<string, string | null> = new Map();
  private defaultLanguageId: string = 'eng';

  getName(): string {
    return 'ExploreRegionImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      // Resolve Explore context
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
      this.defaultLanguageId = await this.getDefaultLanguageIdAsync();

      this.logInfo('Importing Explore regions...');

      // Query regions
      const regions = await this.context.legacyDb.query<LegacyRegion>(
        `SELECT regionId, countryId, label, geoCoordinates, zoom, type
         FROM mwnf3_explore.regions
         WHERE label IS NOT NULL AND label != ''
         ORDER BY countryId, regionId`
      );
      this.logInfo(`Found ${regions.length} regions to import`);

      // Pre-fetch translations and theme associations
      const translations = await this.context.legacyDb.query<LegacyRegionTranslation>(
        `SELECT regionId, langId, spelling, description FROM mwnf3_explore.regiontranslated`
      );
      const translationsByRegion = new Map<number, LegacyRegionTranslation[]>();
      for (const t of translations) {
        const list = translationsByRegion.get(t.regionId) ?? [];
        list.push(t);
        translationsByRegion.set(t.regionId, list);
      }

      const themes = await this.context.legacyDb.query<LegacyRegionTheme>(
        `SELECT regionId, themeId FROM mwnf3_explore.regionsthemes`
      );
      const themesByRegion = new Map<number, number[]>();
      for (const t of themes) {
        const list = themesByRegion.get(t.regionId) ?? [];
        list.push(t.themeId);
        themesByRegion.set(t.regionId, list);
      }

      for (const legacy of regions) {
        try {
          const backwardCompat = `mwnf3_explore:region:${legacy.regionId}`;

          if (await this.entityExistsAsync(backwardCompat, 'collection')) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Resolve parent country collection
          const parentId = await this.getCountryCollectionId(legacy.countryId);

          const [latitude, longitude] = parseGeoCoordinates(legacy.geoCoordinates);

          const internalNameCandidates = [
            {
              languageId: this.defaultLanguageId,
              value: legacy.label,
            },
          ];

          const regionTranslations = translationsByRegion.get(legacy.regionId) ?? [];
          for (const translation of regionTranslations) {
            internalNameCandidates.push({
              languageId: mapLanguageCode(translation.langId),
              value: translation.spelling,
            });
          }

          const selectedInternalName = selectItemInternalName(
            internalNameCandidates,
            this.defaultLanguageId,
            'Explore region',
            backwardCompat
          );
          if (selectedInternalName.warning) {
            this.logWarning(selectedInternalName.warning);
          }

          // Build extra with territory_level and theme_ids
          const extra: Record<string, unknown> = {};
          if (legacy.type !== null && legacy.type !== undefined) {
            extra.territory_level = legacy.type;
          }
          const regionThemes = themesByRegion.get(legacy.regionId);
          if (regionThemes && regionThemes.length > 0) {
            extra.theme_ids = regionThemes;
          }
          const extraJson = Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;

          this.collectSample(
            'explore_region',
            legacy as unknown as Record<string, unknown>,
            'success'
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create collection: ${selectedInternalName.internalName} (${backwardCompat})`
            );
            this.registerEntity('', backwardCompat, 'collection');
            result.imported++;
            this.showProgress();
            continue;
          }

          // Write collection
          const collectionId = await this.context.strategy.writeCollection({
            internal_name: selectedInternalName.internalName,
            backward_compatibility: backwardCompat,
            context_id: this.exploreContextId,
            language_id: 'eng',
            parent_id: parentId,
            type: 'region',
            latitude,
            longitude,
            map_zoom: legacy.zoom ?? null,
            country_id: null,
          });
          this.registerEntity(collectionId, backwardCompat, 'collection');

          // Legacy's Explore prints a region's name and description from
          // regiontranslated, English included ("Tyrol"); `label` is the
          // region's own-language label ("Tirol"), the English title only
          // when regiontranslated has no English row.
          const english = await this.findEnglish(regionTranslations);
          await this.context.strategy.writeCollectionTranslation({
            collection_id: collectionId,
            language_id: 'eng',
            context_id: this.exploreContextId,
            backward_compatibility: `${backwardCompat}:translation:eng`,
            title: english?.spelling?.trim() ? english.spelling : legacy.label,
            description: english?.description ? convertHtmlToMarkdown(english.description) : '',
            extra: extraJson,
          });

          // Write multilingual translations from regiontranslated
          for (const trans of regionTranslations) {
            try {
              const languageId = await this.getLanguageIdByLegacyCodeAsync(trans.langId);
              if (!languageId) {
                this.logWarning(
                  `Unknown language code '${trans.langId}' for region ${legacy.regionId}, skipping translation`
                );
                continue;
              }
              // Skip English — already created from label above
              if (languageId === 'eng') continue;

              if (!trans.spelling || !trans.spelling.trim()) continue;

              await this.context.strategy.writeCollectionTranslation({
                collection_id: collectionId,
                language_id: languageId,
                context_id: this.exploreContextId,
                backward_compatibility: `${backwardCompat}:translation:${languageId}`,
                title: trans.spelling,
                description: trans.description ? convertHtmlToMarkdown(trans.description) : '',
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              this.logWarning(
                `Failed translation for region ${legacy.regionId} lang ${trans.langId}: ${message}`
              );
            }
          }

          result.imported++;
          this.showProgress();
        } catch (error) {
          result.success = false;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Region ${legacy.regionId}: ${errorMessage}`);
          this.logError('ExploreRegionImporter', errorMessage, { regionId: legacy.regionId });
          this.showError();
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in region import: ${errorMessage}`);
      this.logError('ExploreRegionImporter', errorMessage);
      this.showError();
    }

    return result;
  }

  private async getCountryCollectionId(countryId: string): Promise<string | null> {
    if (this.countryCollectionCache.has(countryId)) {
      return this.countryCollectionCache.get(countryId) ?? null;
    }
    const backwardCompat = `mwnf3_explore:country:${countryId}`;
    const collectionId = await this.getEntityUuidAsync(backwardCompat, 'collection');
    this.countryCollectionCache.set(countryId, collectionId);
    if (!collectionId) {
      this.logWarning(
        `Country collection not found for '${countryId}', region will have no parent`
      );
    }
    return collectionId;
  }

  private async findEnglish(
    translations: LegacyRegionTranslation[]
  ): Promise<LegacyRegionTranslation | undefined> {
    for (const trans of translations) {
      if ((await this.getLanguageIdByLegacyCodeAsync(trans.langId)) === 'eng') return trans;
    }
    return undefined;
  }
}
