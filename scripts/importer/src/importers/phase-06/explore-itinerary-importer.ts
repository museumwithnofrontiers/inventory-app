/**
 * Explore Itinerary Importer
 *
 * Creates Collection records for itineraries from the Explore database.
 * Itineraries link thematic cycles to monuments/locations in a specific order.
 *
 * Legacy schema:
 * - mwnf3_explore.explore_itineraries (itineraries_id, cycle, country, regionId, locationId, monumentId, parent_itineraries_id, type, itinorder, path)
 *
 * New schema:
 * - collections (id, context_id, language_id, parent_id, type='itinerary', internal_name, backward_compatibility, ...)
 *
 * Mapping:
 * - itineraries_id → backward_compatibility (mwnf3_explore:itinerary:{itineraries_id})
 * - derived title → internal_name (human-readable title)
 * - parent_itineraries_id → parent_id (for nested itineraries)
 * - cycle → link to thematic cycle collection
 * - type = 'itinerary' (or 'exhibition trail' for sub-itineraries)
 * - type, itinorder, location_home_link → extra.explore_itinerary (see itineraryExtra)
 *
 * It writes no translation: the derived title is not legacy's. Every
 * translation, English included, comes from explore_itineraries_langs through
 * ExploreItineraryContentImporter.
 *
 * Note: Itineraries contain comma-separated lists of locationIds and monumentIds.
 * These will be linked to the itinerary collection in a separate step.
 *
 * Dependencies:
 * - ExploreContextImporter
 * - ExploreRootCollectionsImporter
 * - ExploreThematicCycleImporter (for cycle references)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

/**
 * Parse legacy geoCoordinates format (e.g., "25,10" or "40.178873,-8.063965")
 * Returns [latitude, longitude] or [null, null] if invalid
 */
function parseGeoCoordinates(coords: string | null): [number | null, number | null] {
  if (!coords || !coords.trim()) {
    return [null, null];
  }
  const cleaned = coords.replace(/\s+/g, '').trim();
  const parts = cleaned.split(',');
  if (parts.length !== 2) {
    return [null, null];
  }
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lon)) {
    return [null, null];
  }
  return [lat, lon];
}

/**
 * Legacy itinerary structure
 */
interface LegacyItinerary {
  itineraries_id: number;
  cycle: string | null;
  country: string | null;
  regionId: string | null;
  locationId: string | null;
  monumentId: string | null;
  parent_itineraries_id: number | null;
  type: string | null;
  itinorder: number | null;
  location_home_link: string | null;
  path: string | null;
  // GPS from thematiccycle join
  geoCoordinates: string | null;
  zoom: number | null;
}

/**
 * What an itinerary is in legacy, kept on the collection as
 * `extra.explore_itinerary`, because the collection type alone ('itinerary' or
 * 'exhibition trail') cannot say it:
 *
 * - `type`: legacy's kind, per the column comment in `explore_itineraries`:
 *   1 explore, 2 not to be missed, 3 to know more, 4 thematic, 5 territorial.
 *   The live site's itineraries page lists the top-level thematic ones (4);
 *   kinds 1–3 are routes a location links to, served only from there.
 * - `order`: `itinorder`, the order among its siblings.
 * - `location_home_link`: 'Y' where legacy shows the route on its location's home.
 */
export function itineraryExtra(legacy: Pick<LegacyItinerary, 'type' | 'itinorder' | 'location_home_link'>): {
  type: string | null;
  order: number | null;
  location_home_link: string | null;
} {
  return {
    type: legacy.type ?? null,
    order: legacy.itinorder ?? null,
    location_home_link: legacy.location_home_link ?? null,
  };
}

/**
 * Legacy thematic cycle for title lookup
 */
interface LegacyCycleInfo {
  cycleLabel: string;
  cycleDescription: string;
}

export class ExploreItineraryImporter extends BaseImporter {
  private exploreContextId!: string;
  private exploreByItineraryId: string | null = null;
  private defaultLanguageId: string = 'eng';
  private parentCache: Map<number, string | null> = new Map();
  private cycleInfoCache: Map<string, LegacyCycleInfo | null> = new Map();

  getName(): string {
    return 'ExploreItineraryImporter';
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

      // Get the "Explore by Itinerary" root collection
      const exploreByItineraryBackwardCompat = 'mwnf3_explore:root:explore_by_itinerary';
      this.exploreByItineraryId = await this.getEntityUuidAsync(
        exploreByItineraryBackwardCompat,
        'collection'
      );

      if (!this.exploreByItineraryId) {
        throw new Error(
          `Explore by Itinerary collection not found (${exploreByItineraryBackwardCompat}). Run ExploreRootCollectionsImporter first.`
        );
      }

      this.defaultLanguageId = await this.getDefaultLanguageIdAsync();

      this.logInfo(`Found Explore context: ${this.exploreContextId}`);
      this.logInfo(`Found Explore by Itinerary: ${this.exploreByItineraryId}`);
      this.logInfo('Importing itineraries...');

      // Query itineraries from legacy database with GPS from thematiccycle
      // Order by parent first to ensure hierarchy
      const itineraries = await this.context.legacyDb.query<LegacyItinerary>(
        `SELECT ei.itineraries_id, ei.cycle, ei.country, ei.regionId, ei.locationId, ei.monumentId, 
                ei.parent_itineraries_id, ei.type, ei.itinorder, ei.location_home_link, ei.path,
                tc.geoCoordinates, tc.zoom
         FROM mwnf3_explore.explore_itineraries ei
         LEFT JOIN mwnf3_explore.thematiccycle tc ON ei.cycle = tc.cycleId
         ORDER BY COALESCE(ei.parent_itineraries_id, 0), ei.itinorder, ei.itineraries_id`
      );

      this.logInfo(`Found ${itineraries.length} itineraries to import`);

      // First pass: import root itineraries (parent_itineraries_id is NULL)
      for (const legacy of itineraries) {
        if (legacy.parent_itineraries_id !== null) continue;
        await this.importItinerary(legacy, result);
      }

      // Second pass: import child itineraries
      for (const legacy of itineraries) {
        if (legacy.parent_itineraries_id === null) continue;
        await this.importItinerary(legacy, result);
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in itinerary import: ${errorMessage}`);
      this.logError('ExploreItineraryImporter', errorMessage);
      this.showError();
    }

    return result;
  }

  private async importItinerary(legacy: LegacyItinerary, result: ImportResult): Promise<void> {
    try {
      const backwardCompat = `mwnf3_explore:itinerary:${legacy.itineraries_id}`;

      // Already imported: only make sure it carries the legacy fields, which
      // collections imported before they were kept lack.
      if (await this.entityExistsAsync(backwardCompat, 'collection')) {
        await this.ensureItineraryExtra(backwardCompat, legacy);
        result.skipped++;
        this.showSkipped();
        return;
      }

      // Determine parent
      let parentId: string | null = null;
      if (legacy.parent_itineraries_id) {
        parentId = await this.getItineraryCollectionId(legacy.parent_itineraries_id);
      } else {
        parentId = this.exploreByItineraryId;
      }

      // Build title from cycle info or country
      const title = await this.buildItineraryTitle(legacy);

      // Determine type - sub-itineraries get 'exhibition trail' type
      const collectionType = legacy.parent_itineraries_id ? 'exhibition trail' : 'itinerary';

      // Parse GPS coordinates from thematiccycle
      const [latitude, longitude] = parseGeoCoordinates(legacy.geoCoordinates);

      // Collect sample
      this.collectSample(
        'explore_itinerary',
        legacy as unknown as Record<string, unknown>,
        'success'
      );

      if (this.isDryRun || this.isSampleOnlyMode) {
        this.logInfo(
          `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create collection: ${title} (${backwardCompat})`
        );
        this.registerEntity('', backwardCompat, 'collection');
        result.imported++;
        this.showProgress();
        return;
      }

      // Write collection using strategy
      const collectionId = await this.context.strategy.writeCollection({
        internal_name: title,
        backward_compatibility: backwardCompat,
        context_id: this.exploreContextId,
        language_id: this.defaultLanguageId,
        parent_id: parentId,
        type: collectionType,
        latitude,
        longitude,
        map_zoom: legacy.zoom ?? null,
        country_id: null,
        extra: JSON.stringify({ explore_itinerary: itineraryExtra(legacy) }),
      });

      this.registerEntity(collectionId, backwardCompat, 'collection');
      this.parentCache.set(legacy.itineraries_id, collectionId);

      result.imported++;
      this.showProgress();
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error importing itinerary ${legacy.itineraries_id}: ${errorMessage}`);
      this.logError('ExploreItineraryImporter', errorMessage, {
        itineraryId: legacy.itineraries_id,
      });
      this.showError();
    }
  }

  /**
   * Merges `extra.explore_itinerary` into an existing itinerary collection,
   * keeping whatever else its `extra` holds. Writes nothing when it is already
   * there, so a re-run is idempotent.
   */
  private async ensureItineraryExtra(backwardCompat: string, legacy: LegacyItinerary): Promise<void> {
    if (this.isDryRun || this.isSampleOnlyMode) return;
    const collectionId = await this.getEntityUuidAsync(backwardCompat, 'collection');
    if (!collectionId) return;

    const wanted = itineraryExtra(legacy);
    const current = (await this.context.strategy.getCollectionExtra(collectionId)) ?? {};
    if (JSON.stringify(current['explore_itinerary']) === JSON.stringify(wanted)) return;

    await this.context.strategy.setCollectionExtra(
      collectionId,
      JSON.stringify({ ...current, explore_itinerary: wanted })
    );
  }

  /**
   * Build itinerary title from available data
   */
  private async buildItineraryTitle(legacy: LegacyItinerary): Promise<string> {
    // Try to get cycle info
    if (legacy.cycle) {
      const cycleInfo = await this.getCycleInfo(legacy.cycle);
      if (cycleInfo) {
        const country = legacy.country ? ` - ${legacy.country.toUpperCase()}` : '';
        return `${cycleInfo.cycleDescription || cycleInfo.cycleLabel}${country}`;
      }
    }

    // Fall back to country
    if (legacy.country) {
      return `Itinerary - ${legacy.country.toUpperCase()}`;
    }

    return `Itinerary ${legacy.itineraries_id}`;
  }

  /**
   * Get cycle info from cache or lookup
   */
  private async getCycleInfo(cycleId: string): Promise<LegacyCycleInfo | null> {
    if (this.cycleInfoCache.has(cycleId)) {
      return this.cycleInfoCache.get(cycleId) ?? null;
    }

    try {
      const result = await this.context.legacyDb.query<LegacyCycleInfo>(
        `SELECT cycleLabel, cycleDescription FROM mwnf3_explore.thematiccycle WHERE cycleId = ? LIMIT 1`,
        [cycleId]
      );
      const info = result.length > 0 ? result[0] : null;
      this.cycleInfoCache.set(cycleId, info);
      return info;
    } catch {
      this.cycleInfoCache.set(cycleId, null);
      return null;
    }
  }

  /**
   * Get itinerary collection ID from cache or lookup
   */
  private async getItineraryCollectionId(itineraryId: number): Promise<string | null> {
    if (this.parentCache.has(itineraryId)) {
      return this.parentCache.get(itineraryId) ?? null;
    }

    const backwardCompat = `mwnf3_explore:itinerary:${itineraryId}`;
    const collectionId = await this.getEntityUuidAsync(backwardCompat, 'collection');

    this.parentCache.set(itineraryId, collectionId);

    return collectionId;
  }
}
