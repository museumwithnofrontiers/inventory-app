/**
 * Collection Credits Importer (M16 I5, #2648)
 *
 * Moves the collection credits out of `collection_translations.extra` into
 * Contributors: `author`, `travels_author`, `prepared_by`, `curated_by`,
 * `credits`, `local_coordinator`, `local_team` and `photo_by`
 * (see utils/collection-credits.ts).
 *
 * - One Contributor per collection and key, the key as its `category`.
 * - One Contributor translation per collection translation that holds the
 *   key, in the same language and context, with the text as written: a block
 *   is not split.
 * - The keys leave `extra`; a translation left with no other key gets a null
 *   `extra`.
 *
 * Seven importers write these keys, and some move or merge translations after
 * writing them, so the move runs once, after every one of them. It reads
 * nothing from the legacy database. The texts were sanitized when they were
 * written into `extra`, so they are copied as stored, not converted again.
 *
 * Idempotent: the Contributor ids come from its backward_compatibility, a
 * translation is replaced in place, and a second run finds no key left. Run it
 * again with `--only collection-credits` after re-running one of the writers
 * on its own.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  COLLECTION_CREDITS,
  COLLECTION_CREDIT_EXTRA_KEYS,
  collectionCreditKey,
  splitCollectionCredits,
} from '../../utils/collection-credits.js';
import { deterministicUuid } from '../../utils/deterministic-uuid.js';

export class CollectionCreditsImporter extends BaseImporter {
  getName(): string {
    return 'CollectionCreditsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo(
        'Moving collection credits from collection_translations.extra to Contributors...'
      );
      const rows =
        await this.context.strategy.findCollectionTranslationsWithExtraKeys(COLLECTION_CREDIT_EXTRA_KEYS);
      this.logInfo(`Found ${rows.length} collection translation(s) with credits`);

      for (const row of rows) {
        try {
          const { extra, credits, kept } = splitCollectionCredits(row.extra);
          for (const key of kept) {
            this.logWarning(
              `Collection translation ${row.id}: '${key}' is not a text, left in extra`
            );
          }
          if (credits.length === 0) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would move ${credits.map((c) => c.credit.category).join(', ')} of collection translation ${row.id}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          const collectionKey = row.collection_backward_compatibility ?? row.collection_id;
          for (const { credit, text } of credits) {
            const contributorKey = collectionCreditKey(collectionKey, credit.extraKey);
            let contributorId = await this.getEntityUuidAsync(contributorKey, 'contributor');
            if (!contributorId) {
              contributorId = await this.context.strategy.writeContributor({
                collection_id: row.collection_id,
                category: credit.category,
                display_order: COLLECTION_CREDITS.indexOf(credit) + 1,
                visible: true,
                backward_compatibility: contributorKey,
                internal_name: credit.label,
              });
              this.registerEntity(contributorId, contributorKey, 'contributor');
            }

            await this.context.strategy.upsertContributorTranslationAsStored({
              id: deterministicUuid(
                `contributor_translation:${contributorKey.toLowerCase()}:${row.language_id}:${row.context_id}`
              ),
              contributor_id: contributorId,
              language_id: row.language_id,
              context_id: row.context_id,
              name: credit.field === 'name' ? text : null,
              description: credit.field === 'description' ? text : null,
              backward_compatibility: contributorKey,
            });
          }

          await this.context.strategy.setCollectionTranslationExtraAsStoredById(
            row.id,
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
      result.errors.push(`Failed to move collection credits: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
