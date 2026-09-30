/**
 * Explore Monument Importer
 *
 * Creates Item records for each monument from the Explore database.
 * Monuments are placed in their respective location collections.
 *
 * Legacy schema:
 * - mwnf3_explore.exploremonument (monumentId, locationId, title, geoCoordinates, zoom, special_monument, related_monument)
 *
 * New schema:
 * - items (id, internal_name, backward_compatibility, latitude, longitude, map_zoom, ...)
 * - collection_item (collection_id, item_id) - linking items to location collections
 *
 * Mapping:
 * - monumentId → backward_compatibility (mwnf3_explore:monument:{monumentId})
 * - exploremonumentext.name → internal_name (default language first, then first named translation)
 * - geoCoordinates → latitude, longitude
 * - zoom → map_zoom
 * - locationId → collection link (via collection_item pivot), which keeps the
 *   monument's id, position and museums whichever record it resolves to
 *   (writeLocationLink)
 * - locations.countryId → country_id (natively created monuments only — the
 *   `referenced` and `resolvedCandidates` paths reuse an existing BAR/Travels/
 *   Sharing-History item whose country is authoritative, #1593)
 *
 * Dependencies:
 * - ExploreContextImporter
 * - ExploreLocationImporter (parent location collections must exist)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  parseGeoCoordinates,
  transformExploreMonument,
  type ExploreLegacyMonument,
  type ExploreMonumentNameTranslation,
} from '../../domain/transformers/explore-monument-transformer.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { ExploreMonumentResolver } from './explore-monument-resolver.js';

export class ExploreMonumentImporter extends BaseImporter {
  private exploreContextId: string | null = null;
  private locationCollectionCache: Map<number, string | null> = new Map();
  private monumentResolver!: ExploreMonumentResolver;
  private museumsByMonument: Map<number, string[]> = new Map();

  getName(): string {
    return 'ExploreMonumentImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Looking up Explore context...');

      // Get the Explore context ID
      const exploreContextBackwardCompat = 'mwnf3_explore:context';
      this.exploreContextId = await this.getEntityUuidAsync(
        exploreContextBackwardCompat,
        'context'
      );

      if (!this.exploreContextId) {
        throw new Error(
          `Explore context not found (${exploreContextBackwardCompat}). Run ExploreContextImporter first.`
        );
      }

      this.logInfo(`Found Explore context: ${this.exploreContextId}`);
      this.logInfo('Importing Explore monuments...');
      const defaultLanguageId = await this.getDefaultLanguageIdAsync();
      this.monumentResolver = new ExploreMonumentResolver({
        legacyDb: this.context.legacyDb,
        tracker: this.context.tracker,
        getEntityUuid: (backwardCompatibility, entityType) =>
          this.getEntityUuidAsync(backwardCompatibility, entityType),
      });

      // Query monuments from legacy database
      // The country is joined in from the monument's location: legacy stores
      // none on the monument row and derives it at query time through exactly
      // this hop. LEFT JOIN — a monument with no location keeps a null
      // country rather than dropping out of the import (#1593).
      const monuments = await this.context.legacyDb.query<ExploreLegacyMonument>(
        `SELECT m.monumentId, m.locationId, m.title, m.geoCoordinates, m.zoom,
                m.special_monument, m.related_monument, l.countryId
         FROM mwnf3_explore.exploremonument m
         LEFT JOIN mwnf3_explore.locations l ON l.locationId = m.locationId
         ORDER BY m.locationId, m.monumentId`
      );

      const monumentTranslations = await this.context.legacyDb.query<
        ExploreMonumentNameTranslation & { monumentId: number }
      >(
        `SELECT monumentId, langId, name
         FROM mwnf3_explore.exploremonumentext
         WHERE name IS NOT NULL AND name != ''
         ORDER BY monumentId, langId`
      );

      const translationsByMonumentId = new Map<number, ExploreMonumentNameTranslation[]>();
      for (const translation of monumentTranslations) {
        const existingTranslations = translationsByMonumentId.get(translation.monumentId);
        if (existingTranslations) {
          existingTranslations.push({
            langId: translation.langId,
            name: translation.name,
          });
          continue;
        }

        translationsByMonumentId.set(translation.monumentId, [
          {
            langId: translation.langId,
            name: translation.name,
          },
        ]);
      }

      this.museumsByMonument = await this.loadMuseums();

      this.logInfo(`Found ${monuments.length} monuments to import`);

      for (const legacy of monuments) {
        try {
          const backwardCompat = `mwnf3_explore:monument:${legacy.monumentId}`;
          const resolution = await this.monumentResolver.resolve(legacy.monumentId);
          if (resolution.mode === 'missing-target') {
            throw new Error(resolution.message ?? `Unable to resolve ${backwardCompat}`);
          }

          if (resolution.mode === 'native' && resolution.itemId) {
            // Already imported: its location membership still has to carry
            // the Explore id, which memberships written before it was kept lack.
            const existingLocation = legacy.locationId
              ? await this.getLocationCollectionId(legacy.locationId)
              : null;
            if (existingLocation && !this.isDryRun && !this.isSampleOnlyMode) {
              await this.writeLocationLink(existingLocation, resolution.itemId, legacy);
            }
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Collect sample
          this.collectSample(
            'explore_monument',
            legacy as unknown as Record<string, unknown>,
            'success'
          );

          const collectionId = legacy.locationId
            ? await this.getLocationCollectionId(legacy.locationId)
            : null;

          // A monument that resolves onto another record takes that record's
          // name: legacy lists one with no name rows of its own (1682) under
          // its Sharing History record's pictures. Only a monument created
          // here needs a name of its own (below).
          if (resolution.mode === 'resolvedCandidates') {
            this.logInfo(
              resolution.message ??
                `Explore monument ${backwardCompat} resolves to multiple source items`
            );
            for (const candidate of resolution.resolvedCandidates ?? []) {
              this.context.tracker.set(backwardCompat, candidate.itemId, 'item');
              if (!this.isDryRun && !this.isSampleOnlyMode && collectionId) {
                await this.writeLocationLink(collectionId, candidate.itemId, legacy);
              }
            }
            result.imported++;
            this.showProgress();
            continue;
          }

          if (resolution.mode === 'referenced') {
            if (!resolution.itemId || !resolution.itemBackwardCompatibility) {
              throw new Error(`Referenced monument ${backwardCompat} did not resolve to a target item`);
            }

            this.context.tracker.set(backwardCompat, resolution.itemId, 'item');

            if (this.isDryRun || this.isSampleOnlyMode) {
              this.logInfo(
                `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would reuse source item ${resolution.itemBackwardCompatibility} for ${backwardCompat}`
              );
              this.registerEntity(resolution.itemId, backwardCompat, 'item');
            } else if (collectionId) {
              await this.writeLocationLink(collectionId, resolution.itemId, legacy);
            }

            result.imported++;
            this.showProgress();
            continue;
          }

          const translations = translationsByMonumentId.get(legacy.monumentId);
          if (!translations) {
            throw new Error(
              `Explore monument ${backwardCompat} missing translation rows required for internal_name selection`
            );
          }

          const transformed = transformExploreMonument(legacy, translations, defaultLanguageId);
          for (const w of transformed.warnings) {
            this.logWarning(w);
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create item: ${transformed.data.internal_name} (${backwardCompat})`
            );
            this.registerEntity('', backwardCompat, 'item');
            result.imported++;
            this.showProgress();
            continue;
          }

          // Write item using strategy
          const itemId = await this.context.strategy.writeItem({
            ...transformed.data,
            collection_id: null,
            partner_id: null,
            project_id: null,
          });

          this.registerEntity(itemId, backwardCompat, 'item');

          // Link item to location collection if available
          if (collectionId) {
            await this.writeLocationLink(collectionId, itemId, legacy);
          }

          result.imported++;
          this.showProgress();
        } catch (error) {
          result.success = false;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Error importing monument ${legacy.monumentId}: ${errorMessage}`);
          this.logError('ExploreMonumentImporter', errorMessage, { monumentId: legacy.monumentId });
          this.showError();
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in monument import: ${errorMessage}`);
      this.logError('ExploreMonumentImporter', errorMessage);
      this.showError();
    }

    return result;
  }

  /**
   * Links an item into its Explore location, keeping on the membership what
   * legacy knows of the Explore monument it stands for:
   * - `extra.explore_monument_ids`: its id;
   * - `extra.explore_geo`: its position, by id — `{ latitude, longitude, map_zoom }`;
   * - `extra.explore_museums`: the museums it is, by id — their partner keys,
   *   in legacy's order (G19).
   *
   * Most Explore monuments resolve onto an existing record of another
   * database, whose own key and position say nothing of Explore, so the
   * membership is the one place legacy's monument survives. The ids are a
   * list, and the positions keyed by id, because two Explore monuments can
   * resolve to the same record in the same location. The position is written
   * for every monument, a native one included, so a map reads one place. The
   * write replaces the membership's `extra` (writeCollectionItem's upsert), so
   * the current value is read and merged first.
   */
  private async writeLocationLink(
    collectionId: string,
    itemId: string,
    legacy: ExploreLegacyMonument
  ): Promise<void> {
    const current = (await this.context.strategy.getCollectionItemExtra(collectionId, itemId)) ?? {};
    const known = Array.isArray(current['explore_monument_ids'])
      ? (current['explore_monument_ids'] as unknown[]).filter((id): id is number => typeof id === 'number')
      : [];
    const ids = [...new Set([...known, legacy.monumentId])].sort((a, b) => a - b);

    // This monument's position is legacy's current one, or none.
    const knownGeo =
      current['explore_geo'] !== null && typeof current['explore_geo'] === 'object'
        ? (current['explore_geo'] as Record<string, unknown>)
        : {};
    const [latitude, longitude] = parseGeoCoordinates(legacy.geoCoordinates);
    const position =
      latitude !== null && longitude !== null
        ? { latitude, longitude, map_zoom: legacy.zoom ?? null }
        : null;
    const geo = Object.fromEntries(
      Object.entries({ ...knownGeo, [String(legacy.monumentId)]: position }).filter(
        ([, value]) => value !== null
      )
    );

    // This monument's museums are legacy's current ones, or none.
    const knownMuseums =
      current['explore_museums'] !== null && typeof current['explore_museums'] === 'object'
        ? (current['explore_museums'] as Record<string, unknown>)
        : {};
    const ownMuseums = this.museumsByMonument.get(legacy.monumentId) ?? [];
    const museums = Object.fromEntries(
      Object.entries({
        ...knownMuseums,
        [String(legacy.monumentId)]: ownMuseums.length > 0 ? ownMuseums : null,
      }).filter(([, value]) => value !== null)
    );

    const { explore_geo: _previous, explore_museums: _previousMuseums, ...rest } = current;
    const extra: Record<string, unknown> = {
      ...rest,
      explore_monument_ids: ids,
      ...(Object.keys(geo).length > 0 ? { explore_geo: geo } : {}),
      ...(Object.keys(museums).length > 0 ? { explore_museums: museums } : {}),
    };

    await this.context.strategy.writeCollectionItem({
      collection_id: collectionId,
      item_id: itemId,
      display_order: null,
      extra,
    });
  }

  /**
   * The museums each Explore monument is (`exploremonument_museums`), as the
   * keys of their partners, in the order legacy's API picks them: ISL, then
   * BAR, then DGA (MonumentResource.php). Legacy shows a monument's first
   * museum as its record when Explore has no description of its own. A museum
   * the import doesn't have as a partner is left out, with a warning.
   */
  private async loadMuseums(): Promise<Map<number, string[]>> {
    const rows = await this.context.legacyDb.query<{
      monumentId: number;
      museum_id: string;
      country: string;
    }>(
      `SELECT monumentId, museum_id, country
       FROM mwnf3_explore.exploremonument_museums
       ORDER BY monumentId, FIELD(project_id, 'ISL', 'BAR', 'DGA'), museum_id, country`
    );
    const museums = new Map<number, string[]>();
    for (const row of rows) {
      const key = formatBackwardCompatibility({
        schema: 'mwnf3',
        table: 'museums',
        pkValues: [row.museum_id, row.country],
      });
      const keys = museums.get(row.monumentId) ?? [];
      if (keys.includes(key)) continue;
      if (!(await this.getEntityUuidAsync(key, 'partner'))) {
        this.logWarning(`Explore monument ${row.monumentId}: museum ${key} is not imported as a partner`);
        continue;
      }
      keys.push(key);
      museums.set(row.monumentId, keys);
    }
    return museums;
  }

  /**
   * Get location collection ID from cache or lookup
   */
  private async getLocationCollectionId(locationId: number): Promise<string | null> {
    if (this.locationCollectionCache.has(locationId)) {
      return this.locationCollectionCache.get(locationId) ?? null;
    }

    const backwardCompat = `mwnf3_explore:location:${locationId}`;
    const collectionId = await this.getEntityUuidAsync(backwardCompat, 'collection');

    this.locationCollectionCache.set(locationId, collectionId);

    return collectionId;
  }
}
