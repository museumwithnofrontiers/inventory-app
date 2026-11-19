/**
 * Collection Translation Columns Importer (M16, ADR 006)
 *
 * Moves the collection translation texts that have a column of their own out
 * of `collection_translations.extra` (see utils/collection-translation-columns.ts):
 * - E1 (#2647): `subtitle`, `intro_text` and `introduction` → `introduction`,
 *   `duration`.
 *
 * The mwnf3, Sharing History, Explore and Travels exhibition, trail and
 * itinerary importers write these keys, and later steps move translations
 * between contexts, so the move runs once, after every one of them
 * (`runsLast`). It reads nothing from the legacy database. The texts were
 * sanitized when they were written into `extra`, so they are copied as stored.
 *
 * A key moves only when its value is a text; the column takes it as written,
 * replacing what it held. A translation left with no other key gets a null
 * `extra`. A translation with both `intro_text` and `introduction` is an
 * error: it is left as it is, for review.
 *
 * Idempotent: a second run finds no key left. Run it again with
 * `--only collection-translation-columns` after re-running one of the writers
 * on its own.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  COLLECTION_TRANSLATION_COLUMN_KEYS,
  splitCollectionTranslationColumns,
} from '../../utils/collection-translation-columns.js';

export class CollectionTranslationColumnsImporter extends BaseImporter {
  getName(): string {
    return 'CollectionTranslationColumnsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo(
        `Moving ${COLLECTION_TRANSLATION_COLUMN_KEYS.join(', ')} from collection_translations.extra to their columns...`
      );
      const rows = await this.context.strategy.findCollectionTranslationsWithExtraKeys(
        COLLECTION_TRANSLATION_COLUMN_KEYS
      );
      this.logInfo(`Found ${rows.length} collection translation(s) to update`);

      for (const row of rows) {
        try {
          const { extra, columns, kept, conflicts } = splitCollectionTranslationColumns(row.extra);
          if (conflicts.length > 0) {
            throw new Error(`two keys for one column, left in extra: ${conflicts.join('; ')}`);
          }
          for (const key of kept) {
            this.logWarning(
              `Collection translation ${row.id}: '${key}' is not a text, left in extra`
            );
          }
          if (Object.keys(columns).length === 0) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would move ${Object.keys(columns).join(', ')} of collection translation ${row.id}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.setCollectionTranslationColumnsAsStoredById(
            row.id,
            columns,
            extra === null ? null : JSON.stringify(extra)
          );

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Collection translation ${row.id}: ${message}`);
          this.logError(`Collection translation ${row.id}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to move collection translation columns: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
