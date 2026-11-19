/**
 * Collection Item Explore Monuments Importer (M16 C4, #2644; ADR 006)
 *
 * Moves Explore's monuments out of `collection_item.extra` to the rows of the
 * placement, `collection_item_explore_monuments` (see
 * utils/explore-monuments.ts): a location's list of Explore monuments with
 * their coordinates and museums, and an itinerary's monument with its
 * location and legacy's description references.
 *
 * The Explore location and itinerary importers write these keys, so the move
 * runs once, after every one of them (`runsLast`). It reads nothing from the
 * legacy database: a location and a museum resolve by their legacy keys, and a
 * placement whose location or museum doesn't resolve keeps its keys, reported.
 *
 * Idempotent: a second run finds no key left. Run it again with
 * `--only collection-item-explore-monuments` after re-running one of the
 * writers on its own; it replaces that placement's rows.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  EXPLORE_MONUMENT_KEYS,
  splitExploreMonuments,
} from '../../utils/explore-monuments.js';

export class CollectionItemExploreMonumentsImporter extends BaseImporter {
  getName(): string {
    return 'CollectionItemExploreMonumentsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    const collections = new Map<string, string | null>();
    const partners = new Map<string, string | null>();
    const resolve = async (
      cache: Map<string, string | null>,
      table: string,
      key: string
    ): Promise<string | null> => {
      if (!cache.has(key)) {
        cache.set(key, await this.context.strategy.findByBackwardCompatibility(table, key));
      }
      return cache.get(key) ?? null;
    };

    try {
      this.logInfo(
        `Moving ${EXPLORE_MONUMENT_KEYS.join(', ')} from collection_item.extra to the placements' Explore monuments...`
      );
      const rows = await this.context.strategy.findCollectionItemTextRows(EXPLORE_MONUMENT_KEYS);
      this.logInfo(`Found ${rows.length} placement(s) to update`);

      for (const row of rows) {
        try {
          const { extra, monuments, kept } = splitExploreMonuments(
            row.extra,
            row.collection_backward_compatibility
          );
          for (const reason of kept) {
            this.logWarning(`Placement ${row.id}: ${reason}, left in extra`);
          }
          if (monuments.length === 0) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const resolved = [];
          const missing: string[] = [];
          for (const monument of monuments) {
            const locationId =
              monument.location_key === null
                ? null
                : await resolve(collections, 'collections', monument.location_key);
            if (monument.location_key !== null && locationId === null) {
              missing.push(`location ${monument.location_key}`);
            }
            const partnerIds: string[] = [];
            for (const key of monument.museum_keys) {
              const partnerId = await resolve(partners, 'partners', key);
              if (partnerId === null) missing.push(`museum ${key}`);
              else partnerIds.push(partnerId);
            }
            resolved.push({ ...monument, location_collection_id: locationId, partner_ids: partnerIds });
          }
          if (missing.length > 0) {
            this.logWarning(
              `Placement ${row.id}: ${missing.join(', ')} not found, Explore keys left in extra`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would write ${resolved.length} Explore monument(s) of placement ${row.id}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.replaceCollectionItemExploreMonuments(row.id, resolved);
          await this.context.strategy.setCollectionItemColumnsById(
            row.id,
            {},
            extra === null ? null : JSON.stringify(extra)
          );

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Placement ${row.id}: ${message}`);
          this.logError(`Placement ${row.id}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to move the Explore monuments: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
