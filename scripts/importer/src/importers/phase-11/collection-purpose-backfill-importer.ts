/**
 * Collection Purpose Backfill Importer
 *
 * #1505: standalone, idempotent backfill of `collections.purpose` on an
 * already-populated database, so no full re-import is needed to purpose the
 * marker/root collections created before the column existed. Safe (and a
 * near-no-op) after a fresh full import, because every marker-creation step
 * now sets purpose itself.
 *
 * The step maps known marker backward_compatibility keyspaces to purpose
 * values and updates only rows whose purpose is still NULL — it never
 * overwrites an existing purpose. It reads nothing from the legacy database.
 *
 * Run standalone with `--only collection-purpose-backfill`.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

/** Escape LIKE wildcards in the literal part of a backward_compatibility key. */
function escapeLike(literal: string): string {
  return literal.replace(/[\\_%]/g, (m) => `\\${m}`);
}

interface PurposeBackfillRule {
  /** Literal backward_compatibility prefix (or full key when exact). */
  literal: string;
  /** When false, any suffix is matched (prefix rule). */
  exact: boolean;
  purpose: string;
}

const BACKFILL_RULES: PurposeBackfillRule[] = [
  // Sharing History (per-project lowercase keys)
  { literal: 'mwnf3_sharing_history:sh_exhibitions:root:', exact: false, purpose: 'exhibitions-root' },
  { literal: 'mwnf3_sharing_history:sh_project_about_historical_background:root:', exact: false, purpose: 'historical-background-root' },
  { literal: 'mwnf3_sharing_history:sh_project_about_topics:root:', exact: false, purpose: 'topics-root' },
  { literal: 'mwnf3_sharing_history:sh_countries_historicalbackground:root:', exact: false, purpose: 'historical-profiles-root' },
  { literal: 'mwnf3_sharing_history:sh_national_context_exhibitions:', exact: false, purpose: 'national-context' },
  // mwnf3 shared + per-project exhibition roots
  { literal: 'mwnf3:exhibitions:root', exact: true, purpose: 'exhibitions-root' },
  { literal: 'mwnf3:exhibitions:root:', exact: false, purpose: 'exhibitions-root' },
  { literal: 'mwnf3:artintro:root', exact: true, purpose: 'artistic-introduction-root' },
  // Thematic galleries
  { literal: 'mwnf3_thematic_gallery:galleries_root', exact: true, purpose: 'galleries-root' },
  { literal: 'mwnf3_thematic_gallery:exhibitions_root', exact: true, purpose: 'exhibitions-root' },
  // Travels
  { literal: 'mwnf3_travels:root', exact: true, purpose: 'travels-root' },
  // Explore
  { literal: 'mwnf3_explore:root', exact: true, purpose: 'explore-root' },
  { literal: 'mwnf3_explore:root:explore_by_theme', exact: true, purpose: 'explore-themes-root' },
  { literal: 'mwnf3_explore:root:explore_by_country', exact: true, purpose: 'explore-countries-root' },
  { literal: 'mwnf3_explore:root:explore_by_itinerary', exact: true, purpose: 'explore-itineraries-root' },
];

export class CollectionPurposeBackfillImporter extends BaseImporter {
  getName(): string {
    return 'CollectionPurposeBackfillImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Backfilling collections.purpose from marker backward_compatibility keys...');

      for (const rule of BACKFILL_RULES) {
        const pattern = escapeLike(rule.literal) + (rule.exact ? '' : '%');

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.logInfo(
            `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would backfill purpose '${rule.purpose}' where backward_compatibility LIKE '${pattern}' and purpose is NULL`
          );
          continue;
        }

        try {
          const updated =
            await this.context.strategy.backfillCollectionPurposeByBackwardCompatibility(
              pattern,
              rule.purpose
            );
          if (updated > 0) {
            this.logInfo(`${rule.literal}${rule.exact ? '' : '*'} → '${rule.purpose}': ${updated} collection(s) updated`);
            result.imported += updated;
            this.showProgress();
          } else {
            result.skipped++;
            this.showSkipped();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Backfill '${rule.purpose}' (${rule.literal}): ${message}`);
          this.logError(`Backfill '${rule.purpose}'`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to backfill collection purposes: ${message}`);
      this.logError('CollectionPurposeBackfillImporter', message);
      this.showError();
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
