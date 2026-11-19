/**
 * Collection Relations Importer (M16 E3, #2649; ADR 006)
 *
 * Moves the collection relations kept as legacy id lists in `extra` to the
 * model (see utils/collection-relations.ts):
 * - from the collection's English translation in its own context:
 *   `country_ids` → `collection_country`; `location_ids`, `territory_ids`,
 *   `theme_ids`, `additional_regions` → `collection_collection`, by kind;
 * - from the collection: `historical_background` → `collection_collection`;
 *   `thg_theme.cover_picture` → `cover_item_id`; `days` → `days`.
 *
 * Every legacy id is resolved by its legacy key. A key moves only when the
 * whole list resolves and can be given back as it was: a country list with an
 * alias code (`ix`, `px`), an id that resolves to nothing, or a value of
 * another shape stays in `extra` and is reported. `logos` stays: it is site
 * presentation (Decision 6, E4).
 *
 * The Explore, Travels and thematic gallery importers write these keys, so
 * the move runs once, after every one of them (`runsLast`). It reads nothing
 * from the legacy database. Idempotent: a second run finds no key left. Run
 * it again with `--only collection-relations` after re-running one of the
 * writers on its own.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  COLLECTION_RELATION_KEYS,
  TRANSLATION_LINK_KEYS,
  TRANSLATION_RELATION_KEYS,
  backgroundKeysOf,
  countryIdsOf,
  coverPictureOf,
  daysOf,
  legacyKeysOf,
  withoutKeys,
} from '../../utils/collection-relations.js';

export class CollectionRelationsImporter extends BaseImporter {
  getName(): string {
    return 'CollectionRelationsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      await this.moveTranslationRelations(result);
      await this.moveCollectionRelations(result);
      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to move collection relations: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private get writes(): boolean {
    return !this.isDryRun && !this.isSampleOnlyMode;
  }

  /** The collection ids of these legacy keys, in order, or null if one resolves to nothing. */
  private async resolveCollections(keys: string[]): Promise<string[] | null> {
    const ids: string[] = [];
    for (const key of keys) {
      const id = await this.getEntityUuidAsync(key, 'collection');
      if (!id) return null;
      ids.push(id);
    }
    return ids;
  }

  private async moveTranslationRelations(result: ImportResult): Promise<void> {
    this.logInfo(`Moving ${TRANSLATION_RELATION_KEYS.join(', ')} from collection_translations.extra...`);
    const rows = await this.context.strategy.findCollectionTranslationsWithExtraKeys(
      TRANSLATION_RELATION_KEYS
    );
    this.logInfo(`Found ${rows.length} collection translation(s) to update`);

    for (const row of rows) {
      try {
        if (row.language_id !== 'eng' || row.context_id !== row.collection_context_id) {
          throw new Error(
            'holds collection relations but is not the English text in its collection\'s own context, left in extra'
          );
        }
        const moved: string[] = [];

        if ('country_ids' in row.extra) {
          const countryIds = countryIdsOf(row.extra['country_ids']);
          if (countryIds === null) {
            this.logWarning(
              `Collection translation ${row.id}: 'country_ids' can't be given back from ISO3 ids (an alias or unknown code), left in extra`
            );
          } else {
            if (this.writes) {
              await this.context.strategy.replaceCollectionCountries(row.collection_id, countryIds);
            }
            moved.push('country_ids');
          }
        }

        for (const { key, kind, prefix } of TRANSLATION_LINK_KEYS) {
          if (!(key in row.extra)) continue;
          const legacyKeys = legacyKeysOf(row.extra[key], prefix);
          const ids = legacyKeys === null ? null : await this.resolveCollections(legacyKeys);
          if (ids === null) {
            this.logWarning(
              `Collection translation ${row.id}: '${key}' does not resolve to collections, left in extra`
            );
            continue;
          }
          if (this.writes) {
            await this.context.strategy.replaceCollectionLinks(row.collection_id, kind, ids);
          }
          moved.push(key);
        }

        if (moved.length === 0) {
          result.skipped++;
          this.showSkipped();
          continue;
        }
        if (this.writes) {
          const extra = withoutKeys(row.extra, moved);
          await this.context.strategy.setCollectionTranslationExtraAsStoredById(
            row.id,
            extra === null ? null : JSON.stringify(extra)
          );
        }
        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Collection translation ${row.id}: ${message}`);
        this.logError(`Collection translation ${row.id}`, message);
        this.showError();
      }
    }
  }

  private async moveCollectionRelations(result: ImportResult): Promise<void> {
    this.logInfo(`Moving ${COLLECTION_RELATION_KEYS.join(', ')} from collections.extra...`);
    const rows = await this.context.strategy.findCollectionsWithExtraKeys(COLLECTION_RELATION_KEYS);
    this.logInfo(`Found ${rows.length} collection(s) to update`);

    for (const row of rows) {
      try {
        const moved: string[] = [];
        const columns: { cover_item_id?: string; days?: number } = {};

        if ('historical_background' in row.extra) {
          const keys = backgroundKeysOf(row.extra['historical_background']);
          const ids = keys === null ? null : await this.resolveCollections(keys);
          if (ids === null) {
            this.logWarning(
              `Collection ${row.id}: 'historical_background' does not resolve to collections, left in extra`
            );
          } else {
            if (this.writes) {
              await this.context.strategy.replaceCollectionLinks(row.id, 'historical_background', ids);
            }
            moved.push('historical_background');
          }
        }

        if ('thg_theme' in row.extra) {
          const cover = coverPictureOf(row.extra['thg_theme']);
          const itemId = cover
            ? await this.getEntityUuidAsync(cover.backward_compatibility, 'item')
            : null;
          if (!cover || itemId !== cover.item_id) {
            this.logWarning(
              `Collection ${row.id}: 'thg_theme' is not one cover picture that resolves by its legacy key, left in extra`
            );
          } else {
            columns.cover_item_id = cover.item_id;
            moved.push('thg_theme');
          }
        }

        if ('days' in row.extra) {
          const days = daysOf(row.extra['days']);
          if (days === null) {
            this.logWarning(`Collection ${row.id}: 'days' is not a number of days, left in extra`);
          } else {
            columns.days = days;
            moved.push('days');
          }
        }

        if (moved.length === 0) {
          result.skipped++;
          this.showSkipped();
          continue;
        }
        if (this.writes) {
          const extra = withoutKeys(row.extra, moved);
          await this.context.strategy.setCollectionRelationColumnsAsStored(
            row.id,
            columns,
            extra === null ? null : JSON.stringify(extra)
          );
        }
        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Collection ${row.id}: ${message}`);
        this.logError(`Collection ${row.id}`, message);
        this.showError();
      }
    }
  }
}
