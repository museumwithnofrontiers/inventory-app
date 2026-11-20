/**
 * Sharing History Partner Project Linker
 *
 * Attaches every Sharing History partner to its project collection via
 * `collection_partner` rows (`collection_type='project'`), with the flat
 * legacy tier mapped to `level`:
 *
 * - default                              → 'partner'
 * - in sh_partner_associated             → 'associated_partner'
 * - in sh_partner_further_associated     → 'minor_contributor'
 *
 * Why: SH partners were imported as Partner entities but nothing wrote the
 * project↔partner link rows, so partner exporters (which select through
 * `collection_partner` with `level IS NOT NULL`) find no SH partners at all.
 * Legacy lists ALL sh_partners on its Partners page grouped by country
 * (`modules/pm_partner_list.php:26`), with the associated tiers as flat
 * per-project flags — there is no parent↔child grouping, so no
 * `parent_partner_id` is set (unlike the mwnf3 hierarchy).
 *
 * Only projects legacy actually renders are linked (`show='Y' AND
 * category='SP'` — `libs/class.project.inc.php:48`): in practice AWE.
 *
 * Standalone (`--only sh-partner-project-linker`) and idempotent
 * (attachPartnerToCollectionWithLevel upserts on duplicate); also safe at
 * the end of a full fresh import.
 *
 * Dependencies:
 * - ShProjectImporter (project collections must exist)
 * - ShPartnerImporter (partners must exist)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

const SH_SCHEMA = 'mwnf3_sharing_history';

const LEVEL_PARTNER = 'partner';
const LEVEL_ASSOCIATED = 'associated_partner';
const LEVEL_FURTHER = 'minor_contributor';

interface ShLegacyProjectRow {
  project_id: string;
}

interface ShLegacyPartnerRow {
  partners_id: string;
}

interface ShLegacyTierRow {
  partners_id: string;
  project_id: string;
}

export class ShPartnerProjectLinkerImporter extends BaseImporter {
  getName(): string {
    return 'ShPartnerProjectLinkerImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Linking SH partners to their project collections (collection_partner)...');

      // Only projects legacy renders: show='Y' AND category='SP' (AWE).
      const projects = await this.context.legacyDb.query<ShLegacyProjectRow>(
        `SELECT project_id FROM ${SH_SCHEMA}.sh_projects WHERE \`show\` = 'Y' AND category = 'SP' ORDER BY project_id`
      );

      const partners = await this.context.legacyDb.query<ShLegacyPartnerRow>(
        `SELECT partners_id FROM ${SH_SCHEMA}.sh_partners ORDER BY partners_id`
      );

      const associated = await this.context.legacyDb.query<ShLegacyTierRow>(
        `SELECT partners_id, project_id FROM ${SH_SCHEMA}.sh_partner_associated`
      );

      const furtherAssociated = await this.context.legacyDb.query<ShLegacyTierRow>(
        `SELECT partners_id, project_id FROM ${SH_SCHEMA}.sh_partner_further_associated`
      );

      this.logInfo(
        `Found ${projects.length} public SH project(s), ${partners.length} partners, ` +
          `${associated.length} associated + ${furtherAssociated.length} further-associated tier rows`
      );

      for (const project of projects) {
        const projectKey = project.project_id;
        const associatedSet = new Set(
          associated.filter((t) => t.project_id === projectKey).map((t) => t.partners_id)
        );
        const furtherSet = new Set(
          furtherAssociated.filter((t) => t.project_id === projectKey).map((t) => t.partners_id)
        );

        try {
          await this.linkProject(projectKey, partners, associatedSet, furtherSet, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`SH project ${projectKey}: ${message}`);
          this.logError(`SH project ${projectKey}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to link SH partners: ${message}`);
      this.logError('ShPartnerProjectLinkerImporter', message);
      this.showError();
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async linkProject(
    projectKey: string,
    partners: ShLegacyPartnerRow[],
    associatedSet: Set<string>,
    furtherSet: Set<string>,
    result: ImportResult
  ): Promise<void> {
    const projectBackwardCompat = `${SH_SCHEMA}:sh_projects:${projectKey.toLowerCase()}`;
    const collectionId = await this.getEntityUuidAsync(projectBackwardCompat, 'collection');

    if (!collectionId) {
      this.logWarning(
        `SH project collection not found (${projectBackwardCompat}), skipping ${projectKey} — run ShProjectImporter first`
      );
      result.skipped++;
      this.showSkipped();
      return;
    }

    for (const partner of partners) {
      const level = furtherSet.has(partner.partners_id)
        ? LEVEL_FURTHER
        : associatedSet.has(partner.partners_id)
          ? LEVEL_ASSOCIATED
          : LEVEL_PARTNER;

      const partnerBackwardCompat = `${SH_SCHEMA}:sh_partners:${partner.partners_id.toLowerCase()}`;
      const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');

      if (!partnerId) {
        this.logWarning(`SH partner not found (${partnerBackwardCompat}), skipping`);
        result.skipped++;
        this.showSkipped();
        continue;
      }

      if (this.isDryRun || this.isSampleOnlyMode) {
        this.logInfo(
          `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would attach ${partnerBackwardCompat} to ${projectBackwardCompat} with level=${level}`
        );
        result.imported++;
        this.showProgress();
        continue;
      }

      await this.context.strategy.attachPartnerToCollectionWithLevel(
        collectionId,
        partnerId,
        'project',
        level
      );
      result.imported++;
      this.showProgress();
    }
  }
}
