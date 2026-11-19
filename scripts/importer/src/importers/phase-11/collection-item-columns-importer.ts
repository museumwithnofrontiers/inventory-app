/**
 * Collection Item Columns Importer (M16 C1, #2641; ADR 006)
 *
 * Moves the placement fields that have a column of their own out of
 * `collection_item.extra` (see utils/collection-item-columns.ts):
 * `n2` → `variant_order`, `parent_n2` → `parent_variant_order`,
 * `curator_status` → `curator_selected`, `picture` → `picture_item_id`; and
 * drops `n` (it equals `display_order`) and `detail_n` (always 1).
 *
 * The mwnf3 and Sharing History exhibition importers, the Sharing History
 * historical background importer and the justification step write these keys,
 * so the move runs once, after every one of them (`runsLast`). It reads
 * nothing from the legacy database.
 *
 * `picture` is a legacy image path. It resolves to the picture item of the
 * placed item whose image has that original name; a path that resolves to
 * none, or to more than one, stays in `extra` and is reported.
 *
 * Idempotent: a second run finds no key left. Run it again with
 * `--only collection-item-columns` after re-running one of the writers on its
 * own.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  COLLECTION_ITEM_COLUMN_KEYS,
  splitCollectionItemColumns,
} from '../../utils/collection-item-columns.js';

export class CollectionItemColumnsImporter extends BaseImporter {
  getName(): string {
    return 'CollectionItemColumnsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo(
        `Moving ${COLLECTION_ITEM_COLUMN_KEYS.join(', ')} from collection_item.extra to their columns...`
      );
      const rows = await this.context.strategy.findCollectionItemsWithExtraKeys(
        COLLECTION_ITEM_COLUMN_KEYS
      );
      this.logInfo(`Found ${rows.length} placement(s) to update`);

      for (const row of rows) {
        try {
          let pictureItemId: string | null = null;
          if (typeof row.extra.picture === 'string') {
            const pictures = await this.context.strategy.findPictureItemIdsByOriginalName(
              row.item_id,
              row.extra.picture
            );
            pictureItemId = pictures.length === 1 ? pictures[0]! : null;
          }

          const { extra, columns, kept } = splitCollectionItemColumns(
            row.extra,
            row.display_order,
            pictureItemId
          );
          for (const reason of kept) {
            this.logWarning(`Placement ${row.id}: ${reason}, left in extra`);
          }
          if (extra !== null && Object.keys(extra).length === Object.keys(row.extra).length) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would move ${Object.keys(columns).join(', ')} of placement ${row.id}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.setCollectionItemColumnsById(
            row.id,
            columns,
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
      result.errors.push(`Failed to move placement columns: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
