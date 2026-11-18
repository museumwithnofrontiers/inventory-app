/**
 * Item Translation Columns Importer (M16, ADR 006)
 *
 * Moves the item translation texts that have a column of their own out of
 * `item_translations.extra` (see utils/item-translation-columns.ts):
 * - B1 (#2635): `materials`, `description2` → `short_description`, `dynasty`,
 *   `province` → `region`, `history`.
 *
 * The mwnf3, Sharing History, Explore and Travels object and monument
 * importers write these keys, and later steps move translations between
 * contexts, so the move runs once, after every one of them (`runsLast`). It
 * reads nothing from the legacy database. The texts were sanitized when they
 * were written into `extra`, so they are copied as stored.
 *
 * A key moves only when its value is a text; the column takes it as written,
 * replacing what it held. A translation left with no other key gets a null
 * `extra`.
 *
 * Idempotent: a second run finds no key left. Run it again with
 * `--only item-translation-columns` after re-running one of the writers on its
 * own.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  ITEM_TRANSLATION_COLUMN_KEYS,
  splitItemTranslationColumns,
} from '../../utils/item-translation-columns.js';

export class ItemTranslationColumnsImporter extends BaseImporter {
  getName(): string {
    return 'ItemTranslationColumnsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo(
        `Moving ${ITEM_TRANSLATION_COLUMN_KEYS.join(', ')} from item_translations.extra to their columns...`
      );
      const rows = await this.context.strategy.findItemTranslationsWithExtraKeys(
        ITEM_TRANSLATION_COLUMN_KEYS
      );
      this.logInfo(`Found ${rows.length} item translation(s) to update`);

      for (const row of rows) {
        try {
          const { extra, columns, kept } = splitItemTranslationColumns(row.extra);
          for (const key of kept) {
            this.logWarning(`Item translation ${row.id}: '${key}' is not a text, left in extra`);
          }
          if (Object.keys(columns).length === 0) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would move ${Object.keys(columns).join(', ')} of item translation ${row.id}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.setItemTranslationColumnsAsStoredById(
            row.id,
            columns,
            extra === null ? null : JSON.stringify(extra)
          );

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Item translation ${row.id}: ${message}`);
          this.logError(`Item translation ${row.id}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to move item translation columns: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
