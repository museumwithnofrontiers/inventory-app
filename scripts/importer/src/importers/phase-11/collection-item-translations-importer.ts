/**
 * Collection Item Translations Importer (M16 C2, #2642; ADR 006)
 *
 * Moves the placement texts out of `collection_item.extra` to the placement
 * translations, one row per placement and language (see
 * utils/collection-item-translations.ts): the detail view's name, the
 * description, the justifications, the image caption, the item's caption
 * (name, date, location, museum) and each text's own legacy key.
 *
 * The mwnf3 and Sharing History exhibition importers, the National Context
 * importer, the thematic gallery theme importers, the Travels trail importer
 * and the justification step write these keys, so the move runs once, after
 * every one of them (`runsLast`). It reads nothing from the legacy database.
 *
 * Idempotent: a second run finds no key left. Run it again with
 * `--only collection-item-translations` after re-running one of the writers
 * on its own.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  COLLECTION_ITEM_TRANSLATION_KEYS,
  splitCollectionItemTranslations,
} from '../../utils/collection-item-translations.js';

export class CollectionItemTranslationsImporter extends BaseImporter {
  getName(): string {
    return 'CollectionItemTranslationsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo(
        `Moving ${COLLECTION_ITEM_TRANSLATION_KEYS.join(', ')} from collection_item.extra to the placement translations...`
      );
      const rows = await this.context.strategy.findCollectionItemTextRows(
        COLLECTION_ITEM_TRANSLATION_KEYS
      );
      this.logInfo(`Found ${rows.length} placement(s) to update`);

      for (const row of rows) {
        try {
          const { extra, translations, kept } = splitCollectionItemTranslations(
            row.extra,
            row.collection_backward_compatibility
          );
          for (const reason of kept) {
            this.logWarning(`Placement ${row.id}: ${reason}, left in extra`);
          }
          if (translations.size === 0) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would write ${translations.size} translation(s) of placement ${row.id}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          for (const [languageId, columns] of [...translations].sort(([a], [b]) =>
            a.localeCompare(b)
          )) {
            await this.context.strategy.upsertCollectionItemTranslation(row.id, languageId, columns);
          }
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
      result.errors.push(`Failed to move placement texts: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
