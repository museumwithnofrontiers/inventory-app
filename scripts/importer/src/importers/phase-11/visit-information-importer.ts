/**
 * Visit Information Importer (M16 D1, #2645; ADR 006)
 *
 * Moves the visit keys of item, collection and partner translations out of
 * `extra` into the shared `visit_information` model, one row per owner,
 * language and context, every text as written (see utils/visit-information.ts
 * for the mapping).
 *
 * The monument, Travels and Explore importers write these keys into the
 * translations, and later steps move translations between contexts, so the
 * move runs once, after every one of them (`runsLast`). It reads nothing from
 * the legacy database. The texts were sanitized when they were written into
 * `extra`, so they are copied as stored.
 *
 * Idempotent: a second run finds no key left. Run it again with
 * `--only visit-information` after re-running one of the writers on its own;
 * the row of that owner, language and context is replaced.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { deterministicUuid } from '../../utils/deterministic-uuid.js';
import {
  VISIT_INFORMATION_KEYS,
  splitVisitInformation,
  visitInformationUuidName,
  type VisitOwner,
} from '../../utils/visit-information.js';

const OWNERS: readonly VisitOwner[] = ['item', 'collection', 'partner'];

export class VisitInformationImporter extends BaseImporter {
  getName(): string {
    return 'VisitInformationImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    for (const owner of OWNERS) {
      try {
        const keys = VISIT_INFORMATION_KEYS[owner];
        const rows = await this.context.strategy.findVisitInformationSources(owner, keys);
        this.logInfo(`Moving ${keys.join(', ')} of ${rows.length} ${owner} translation(s) to visit_information...`);

        for (const row of rows) {
          try {
            const { extra, fields, kept } = splitVisitInformation(row.extra, owner);
            for (const key of kept) {
              this.logWarning(`${owner} translation ${row.id}: ${key} left in extra`);
            }
            const extraChanged = JSON.stringify(extra) !== JSON.stringify(row.extra);
            if (Object.keys(fields).length === 0 && !extraChanged) {
              result.skipped++;
              this.showSkipped();
              continue;
            }

            if (this.isDryRun || this.isSampleOnlyMode) {
              this.logInfo(
                `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would move ${Object.keys(fields).join(', ')} of ${owner} translation ${row.id}`
              );
              result.imported++;
              this.showProgress();
              continue;
            }

            if (Object.keys(fields).length > 0) {
              await this.context.strategy.upsertVisitInformationAsStored({
                id: deterministicUuid(
                  visitInformationUuidName(owner, row.owner_id, row.language_id, row.context_id)
                ),
                owner,
                ownerId: row.owner_id,
                languageId: row.language_id,
                contextId: row.context_id,
                fields,
                backwardCompatibility: row.backward_compatibility,
              });
            }
            await this.context.strategy.setVisitInformationSourceExtraAsStored(
              owner,
              row.id,
              extra === null ? null : JSON.stringify(extra)
            );

            result.imported++;
            this.showProgress();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`${owner} translation ${row.id}: ${message}`);
            this.logError(`${owner} translation ${row.id}`, message);
            this.showError();
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to move the ${owner} visit information: ${message}`);
      }
    }

    this.showSummary(result.imported, result.skipped, result.errors.length);
    result.success = result.errors.length === 0;
    return result;
  }
}
