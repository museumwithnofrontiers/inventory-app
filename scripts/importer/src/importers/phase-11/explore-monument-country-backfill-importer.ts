/**
 * Explore Monument Country Backfill Importer
 *
 * Standalone, idempotent backfill of `items.country_id` on natively-imported
 * Explore monuments, on a database imported before ExploreMonumentImporter
 * derived the country itself.
 *
 * Why it was missing: `mwnf3_explore.exploremonument` carries no country at
 * all — legacy derives one at query time by following `locationId` into
 * `mwnf3_explore.locations.countryId`, and the live API returns the resolved
 * value. The importer never made that hop and hardcoded `country_id: null`,
 * so all 106 imported monuments landed without a country. Exporters scope
 * `countries.json` by unioning `items.country_id` of the member items, so a
 * country reached only through an Explore monument silently vanished from the
 * package (India, on The Use of Colours in Art).
 *
 * Scope and safety:
 * - Enumerates items whose OWN `backward_compatibility` starts with
 *   `mwnf3_explore:monument:`. That is the whole dedup guard, and it is
 *   structural: a deduplicated monument (e.g. legacy 1419) has no item of its
 *   own — it was folded into a BAR/Travels/Sharing-History item whose
 *   `country_id` is authoritative — and resolving the legacy key through the
 *   tracker would have handed us that foreign item to write on. Enumerating
 *   by the item's own key cannot reach it.
 * - Writes only where `country_id` is still null, via a conditional UPDATE, so
 *   a rerun and a fresh import are both no-ops and nothing is ever clobbered.
 * - An unmappable legacy country code is a per-row warning, never a failure.
 * - Touches `country_id` only. Every other column is left as imported.
 *
 * Run standalone with `--only explore-monument-country-backfill`. It is a
 * no-op after a fresh full import, because ExploreMonumentImporter now derives
 * the country itself. See museumwithnofrontiers/inventory-app#1593.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { mapCountryCode } from '../../utils/code-mappings.js';

/** The keyspace of a natively-created Explore monument item. */
const MONUMENT_BC_PREFIX = 'mwnf3_explore:monument:';

interface LegacyMonumentCountryRow {
  monumentId: number;
  countryId: string | null;
}

export class ExploreMonumentCountryBackfillImporter extends BaseImporter {
  getName(): string {
    return 'ExploreMonumentCountryBackfillImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Backfilling country_id on natively-imported Explore monuments...');

      const items =
        await this.context.strategy.findItemsWithoutCountryByBackwardCompatibilityPrefix(
          MONUMENT_BC_PREFIX
        );
      this.logInfo(`Found ${items.length} Explore monument item(s) without a country`);
      if (items.length === 0) {
        this.showSummary(result.imported, result.skipped, result.errors.length, 0);
        result.success = true;
        return result;
      }

      const countryByMonumentId = await this.loadLegacyCountries();

      for (const item of items) {
        try {
          await this.backfillOne(item, countryByMonumentId, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`${item.backward_compatibility}: ${message}`);
          this.logError(item.backward_compatibility, message);
          this.showError();
        }
      }

      this.showSummary(
        result.imported,
        result.skipped,
        result.errors.length,
        result.warnings.length
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to backfill Explore monument countries: ${message}`);
      this.logError('ExploreMonumentCountryBackfillImporter', message);
      this.showError();
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * The same location → country hop ExploreMonumentImporter now makes, read
   * once for the whole run.
   */
  private async loadLegacyCountries(): Promise<Map<number, string | null>> {
    const rows = await this.context.legacyDb.query<LegacyMonumentCountryRow>(
      `SELECT m.monumentId, l.countryId
       FROM mwnf3_explore.exploremonument m
       LEFT JOIN mwnf3_explore.locations l ON l.locationId = m.locationId
       ORDER BY m.monumentId`
    );

    const countries = new Map<number, string | null>();
    for (const row of rows) {
      countries.set(row.monumentId, row.countryId);
    }
    return countries;
  }

  private async backfillOne(
    item: { id: string; backward_compatibility: string },
    countryByMonumentId: Map<number, string | null>,
    result: ImportResult
  ): Promise<void> {
    const rawMonumentId = item.backward_compatibility.slice(MONUMENT_BC_PREFIX.length);
    const monumentId = Number(rawMonumentId);
    if (!/^\d+$/.test(rawMonumentId) || !Number.isSafeInteger(monumentId)) {
      const warning = `${item.backward_compatibility}: cannot parse a monument id, skipping`;
      this.logWarning(warning);
      result.warnings.push(warning);
      result.skipped++;
      this.showSkipped();
      return;
    }

    if (!countryByMonumentId.has(monumentId)) {
      const warning = `${item.backward_compatibility}: no such monument in mwnf3_explore.exploremonument, skipping`;
      this.logWarning(warning);
      result.warnings.push(warning);
      result.skipped++;
      this.showSkipped();
      return;
    }

    const legacyCode = countryByMonumentId.get(monumentId)?.trim();
    if (!legacyCode) {
      const warning = `${item.backward_compatibility}: location has no country, leaving country_id null`;
      this.logWarning(warning);
      result.warnings.push(warning);
      result.skipped++;
      this.showSkipped();
      return;
    }

    let countryId: string;
    try {
      countryId = mapCountryCode(legacyCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const warning = `${item.backward_compatibility}: country code '${legacyCode}' cannot be mapped: ${message}`;
      this.logWarning(warning);
      result.warnings.push(warning);
      result.skipped++;
      this.showSkipped();
      return;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would set country_id=${countryId} on ${item.backward_compatibility}`
      );
      result.imported++;
      this.showProgress();
      return;
    }

    // Conditional on country_id still being null: another importer may have
    // established one between the enumeration above and this write, and its
    // value wins.
    const updated = await this.context.strategy.setItemCountryIdIfUnset(item.id, countryId);
    if (updated === 0) {
      result.skipped++;
      this.showSkipped();
      return;
    }

    result.imported++;
    this.showProgress();
  }
}
