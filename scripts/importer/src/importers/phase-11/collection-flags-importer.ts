/**
 * Collection Flags Importer (M16 E4a, #2650; M17 A1, #2742)
 *
 * Cleans the collection texts' `extra` of what an older database still holds:
 * a legacy show flag or Explore theme status moves to `collections.draft`, and
 * the legacy codes nothing reads are dropped (see utils/collection-flags.ts).
 * The importers set `draft` themselves since M17 A1, so on a fresh import only
 * the codes are left to drop.
 *
 * A flag moves only when every translation of the collection holds the same
 * value, and an Explore theme's `legacy_status` only from its English text in
 * its own context (where the exporters give it back); otherwise the flags
 * stay and the collection is reported. The codes are dropped in every case.
 *
 * It runs once, after every importer that writes these keys (`runsLast`). It
 * reads nothing from the legacy database. Idempotent: a second run finds no
 * key left.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  COLLECTION_FLAG_KEYS,
  planCollectionFlags,
  stripCollectionFlags,
} from '../../utils/collection-flags.js';

const THEME_KEY_PREFIX = 'mwnf3_explore:thematiccycle:';

export class CollectionFlagsImporter extends BaseImporter {
  getName(): string {
    return 'CollectionFlagsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    const writes = !this.isDryRun && !this.isSampleOnlyMode;

    try {
      this.logInfo('Moving the collection flags out of collection_translations.extra...');
      const rows = await this.context.strategy.findCollectionTranslationsWithExtraKeys(
        COLLECTION_FLAG_KEYS
      );
      const byCollection = new Map<string, typeof rows>();
      for (const row of rows) {
        byCollection.set(row.collection_id, [...(byCollection.get(row.collection_id) ?? []), row]);
      }
      this.logInfo(`Found ${rows.length} translation(s) of ${byCollection.size} collection(s)`);

      for (const [collectionId, translations] of byCollection) {
        try {
          const plan = planCollectionFlags(translations.map((t) => t.extra));
          const misplacedStatus = translations.some(
            (t) =>
              'legacy_status' in t.extra &&
              !(
                t.language_id === 'eng' &&
                t.context_id === t.collection_context_id &&
                (t.collection_backward_compatibility ?? '').startsWith(THEME_KEY_PREFIX)
              )
          );
          if (misplacedStatus) {
            plan.problems.push("legacy_status outside an Explore theme's English text");
            plan.columns = {};
          }
          const moveFlags = plan.problems.length === 0;
          if (!moveFlags) {
            const message = `flags left in extra: ${plan.problems.join('; ')}`;
            result.errors.push(`Collection ${collectionId}: ${message}`);
            this.logError(`Collection ${collectionId}`, message);
          }

          if (writes) {
            if (moveFlags && Object.keys(plan.columns).length > 0) {
              await this.context.strategy.setCollectionFlags(collectionId, plan.columns);
            }
            for (const t of translations) {
              const extra = stripCollectionFlags(t.extra, moveFlags);
              if (JSON.stringify(extra) === JSON.stringify(t.extra)) continue;
              await this.context.strategy.setCollectionTranslationExtraAsStoredById(
                t.id,
                extra === null ? null : JSON.stringify(extra)
              );
            }
          }
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Collection ${collectionId}: ${message}`);
          this.logError(`Collection ${collectionId}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to move the collection flags: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
