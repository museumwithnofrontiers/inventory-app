/**
 * Sharing History Exhibition Show-Flag Importer
 *
 * Sets `collections.visible` from the legacy `sh_exhibitions.show` publication
 * flag (`y` shown, `n` not) on every SH exhibition collection, as
 * Mwnf3ExhibitionTranslationImporter does for mwnf3 exhibitions (M16 E4a).
 * Exporters leave an unpublished exhibition out of a package by that flag
 * (computeUnpublishedExhibitionSubtree), so hidden SH exhibitions (e.g. AWE
 * exhibition 2 "Political Context") never leak into a data-package.
 *
 * The rest of the exhibition's list metadata (`project_id`, `new_status`) is
 * site configuration (M16 E4b, decision 6): `siteConfiguration()` builds it
 * for the `site-config` command, which keeps it in the exhibition's instance
 * file as `translation_extra.legacy_exhibition`, the same on every text.
 *
 * Standalone (`--only sh-exhibition-show-flag`) and idempotent.
 *
 * Dependencies:
 * - ShExhibitionImporter (exhibition collections must exist)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import type { SiteConfigBuilder, SiteConfigEntry } from '../../site-config/types.js';

const SH_SCHEMA = 'mwnf3_sharing_history';

interface ShLegacyExhibitionFlagRow {
  exhibition_id: number;
  project_id: string;
  show: string | null;
  new_status: string | null;
}

export class ShExhibitionShowFlagImporter extends BaseImporter implements SiteConfigBuilder {
  getName(): string {
    return 'ShExhibitionShowFlagImporter';
  }

  private async exhibitions(): Promise<ShLegacyExhibitionFlagRow[]> {
    return this.context.legacyDb.query<ShLegacyExhibitionFlagRow>(
      `SELECT exhibition_id, project_id, \`show\`, new_status
       FROM ${SH_SCHEMA}.sh_exhibitions
       ORDER BY project_id, exhibition_id`
    );
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Setting the SH exhibitions visible from their legacy show flag...');
      const exhibitions = await this.exhibitions();
      this.logInfo(`Found ${exhibitions.length} SH exhibitions`);

      for (const legacy of exhibitions) {
        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibitions:${legacy.exhibition_id}`;
        try {
          const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
          if (!collectionId) {
            this.logWarning(
              `SH exhibition collection not found (${collectionBackwardCompat}), skipping — run ShExhibitionImporter first`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }
          if (legacy.show !== 'y' && legacy.show !== 'n') {
            result.skipped++;
            this.showSkipped();
            continue;
          }
          if (!this.isDryRun && !this.isSampleOnlyMode) {
            await this.context.strategy.setCollectionFlags(collectionId, { visible: legacy.show === 'y' });
          }
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`SH exhibition ${legacy.exhibition_id}: ${message}`);
          this.logError(`SH exhibition ${legacy.exhibition_id}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to set the SH exhibitions visible: ${message}`);
      this.logError('ShExhibitionShowFlagImporter', message);
      this.showError();
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Each SH exhibition's list metadata, the same on every one of its texts:
   * for an exhibition that has a text (a row in sh_exhibitionnames).
   */
  async siteConfiguration(): Promise<SiteConfigEntry[]> {
    const named = new Set(
      (
        await this.context.legacyDb.query<{ exhibition_id: number }>(
          `SELECT DISTINCT exhibition_id FROM ${SH_SCHEMA}.sh_exhibitionnames`
        )
      ).map((row) => row.exhibition_id)
    );
    const entries: SiteConfigEntry[] = [];
    for (const legacy of await this.exhibitions()) {
      if (!named.has(legacy.exhibition_id)) continue;
      const legacyExhibition: Record<string, unknown> = {};
      if (legacy.project_id) legacyExhibition.project_id = legacy.project_id;
      if (legacy.new_status) legacyExhibition.new_status = legacy.new_status;
      if (Object.keys(legacyExhibition).length === 0) continue;
      entries.push({
        collection: `${SH_SCHEMA}:sh_exhibitions:${legacy.exhibition_id}`,
        translationExtra: { legacy_exhibition: legacyExhibition },
      });
    }
    return entries;
  }
}
