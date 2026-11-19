/**
 * Partner Columns Importer (M16 D2, #2646; decision 7; ADR 006)
 *
 * Moves the partner fields out of `partner_translations.extra` (see
 * utils/partner-columns.ts): the contact persons to `partner_contacts`, the
 * category, Portal flag and city to `partners`, the other name to the
 * translation's `also_known_as`.
 *
 * The museum, institution, school and Sharing History partner importers write
 * these keys on every translation of a partner, so the move runs once, after
 * every one of them (`runsLast`), one partner at a time. It reads nothing
 * from the legacy database; the texts are copied as stored.
 *
 * Idempotent: a second run finds no key left. Run it again with
 * `--only partner-columns` after re-running one of the writers on its own.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { deterministicUuid } from '../../utils/deterministic-uuid.js';
import {
  PARTNER_COLUMN_KEYS,
  partnerContactUuidName,
  splitPartnerColumns,
  type PartnerTranslationSource,
} from '../../utils/partner-columns.js';

export class PartnerColumnsImporter extends BaseImporter {
  getName(): string {
    return 'PartnerColumnsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      const rows = await this.context.strategy.findPartnerTranslationsWithExtraKeys(PARTNER_COLUMN_KEYS);
      const byPartner = new Map<string, PartnerTranslationSource[]>();
      for (const row of rows) {
        byPartner.set(row.partner_id, [...(byPartner.get(row.partner_id) ?? []), { id: row.id, extra: row.extra }]);
      }
      this.logInfo(
        `Moving ${PARTNER_COLUMN_KEYS.join(', ')} of ${byPartner.size} partner(s) (${rows.length} translations)...`
      );

      for (const [partnerId, translations] of byPartner) {
        try {
          const split = splitPartnerColumns(translations);
          for (const reason of split.kept) {
            this.logWarning(`Partner ${partnerId}: ${reason}, left in extra`);
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would move the columns of partner ${partnerId}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          if (Object.keys(split.partner).length > 0) {
            await this.context.strategy.setPartnerColumns(partnerId, split.partner);
          }
          for (const contact of split.contacts) {
            await this.context.strategy.upsertPartnerContactAsStored({
              id: deterministicUuid(partnerContactUuidName(partnerId, contact.display_order)),
              partnerId,
              displayOrder: contact.display_order,
              fields: contact.fields,
            });
          }
          for (const translation of split.translations) {
            await this.context.strategy.setPartnerTranslationColumnsAsStored(
              translation.id,
              translation.also_known_as ?? null,
              translation.extra === null ? null : JSON.stringify(translation.extra)
            );
          }

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Partner ${partnerId}: ${message}`);
          this.logError(`Partner ${partnerId}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to move the partner columns: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
