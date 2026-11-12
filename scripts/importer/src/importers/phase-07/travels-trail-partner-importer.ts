/**
 * Travels Trail Partner Importer
 *
 * Links each exhibition trail to its "Starting point" museum: legacy's trail page
 * prints "Starting point: <museum>" and links to that Islamic Art partner
 * (travel_et_trailDetail.php).
 *
 * Legacy schema:
 * - mwnf3_travels.trails.museum_id (one value per trail, repeated on its language rows;
 *   Mus01 per country, Mus01_C "Further Associated Museums" for GPA)
 *
 * New schema:
 * - collection_partner (collection_id = the trail, collection_type 'collection',
 *   partner_id = mwnf3:museums:{museum_id}:{country}, level 'partner')
 *
 * Dependencies:
 * - partners (phase 01)
 * - travels-trail
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

interface LegacyTrailMuseum {
  project_id: string;
  country: string;
  number: number;
  museum_id: string | null;
}

/** One starting-point museum per trail: the first non-empty museum_id of its language rows. */
export function trailStartingPoints(
  rows: LegacyTrailMuseum[]
): Array<{ trailBackwardCompat: string; partnerBackwardCompat: string }> {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const museum = row.museum_id?.trim();
    if (!museum) continue;
    const trail = `mwnf3_travels:trail:${row.project_id}:${row.country}:${row.number}`;
    if (!seen.has(trail)) seen.set(trail, `mwnf3:museums:${museum}:${row.country}`);
  }
  return [...seen].map(([trailBackwardCompat, partnerBackwardCompat]) => ({
    trailBackwardCompat,
    partnerBackwardCompat,
  }));
}

export class TravelsTrailPartnerImporter extends BaseImporter {
  getName(): string {
    return 'TravelsTrailPartnerImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      const rows = await this.context.legacyDb.query<LegacyTrailMuseum>(
        `SELECT project_id, country, number, museum_id
           FROM mwnf3_travels.trails
          ORDER BY project_id, country, number, lang`
      );
      const links = trailStartingPoints(rows);
      this.logInfo(`Found ${links.length} trail starting points`);

      for (const link of links) {
        try {
          const trailId = await this.getEntityUuidAsync(link.trailBackwardCompat, 'collection');
          const partnerId = await this.getEntityUuidAsync(link.partnerBackwardCompat, 'partner');
          if (!trailId || !partnerId) {
            this.logWarning(`Starting point not linked: ${link.trailBackwardCompat}`, {
              trail: trailId ? 'found' : 'missing',
              partner: partnerId ? 'found' : `missing ${link.partnerBackwardCompat}`,
            });
            result.skipped++;
            this.showSkipped();
            continue;
          }
          if (!this.isDryRun && !this.isSampleOnlyMode) {
            await this.context.strategy.attachPartnerToCollectionWithLevel(
              trailId,
              partnerId,
              'collection',
              'partner'
            );
          }
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`${link.trailBackwardCompat}: ${message}`);
          this.logError('TravelsTrailPartnerImporter', message, { ...link });
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in trail partner import: ${message}`);
      this.logError('TravelsTrailPartnerImporter', message);
      this.showError();
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
