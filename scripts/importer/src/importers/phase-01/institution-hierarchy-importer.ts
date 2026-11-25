/**
 * Institution Hierarchy Importer
 *
 * Imports institution hierarchy levels from legacy tables:
 * - mwnf3.partner_institutions (tier 1: partner)
 * - mwnf3.associated_institutions (tier 2: associated_partner)
 *
 * Unlike museums, legacy has no `further_associated_institutions` table, so
 * there is no `minor_contributor` tier for institutions.
 *
 * These map to collection_partner.level in inventory-app, on the project's
 * own collection (`collection_type='project'`).
 *
 * This is the curated "Partner Institutions" list shown on the legacy
 * Partners page — a much narrower set than "every institution that owns an
 * item in this project" (which is how institutions were included in the
 * exporter before this importer existed: most institutions own monuments as
 * the country's generic administrative authority, e.g. a Ministry of
 * Culture, without being a listed project partner).
 *
 * An associated institution legacy nests under a tier-1 institution of the
 * same project (`associated_institutions.partner_id`) gets that owner as
 * `parent_partner_id` on its project-tier row (M16 J2, #2709) — see
 * partner-hierarchy-importer.ts. Until J2 this lived in one
 * `partner_group:institutions:N` collection per tier-1 institution.
 *
 * Dependencies:
 * - ProjectImporter (creates collections from projects)
 * - PartnerImporter (creates partners from institutions)
 */

import type { PartnerLevel } from '../../domain/partner-link-vocabulary.js';
import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';

const DEFAULT_ASSOCIATED_INSTITUTION_PROJECT_ID = 'ISL';

interface LegacyPartnerInstitution {
  partner_id: number;
  project_id: string;
  institution_id: string;
  country_id: string;
}

interface LegacyAssociatedInstitution {
  associated_id: number;
  partner_id: number | null;
  project_id: string | null;
  institution_id: string;
  country_id: string;
}

/** A partner's project-tier row: the project's collection and the partner. */
interface ProjectLink {
  collectionId: string;
  partnerId: string;
}

export class InstitutionHierarchyImporter extends BaseImporter {
  /** `partner_institutions.partner_id` → the tier-1 institution's project and partner. */
  private readonly owners = new Map<number, { projectId: string; partnerId: string }>();

  getName(): string {
    return 'InstitutionHierarchyImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing institution hierarchy levels...');

      // Import tier 1: partner_institutions → level = 'partner'
      await this.importPartnerInstitutions(result);

      // Import tier 2: associated_institutions → level = 'associated_partner'
      await this.importAssociatedInstitutions(result);

      this.showSummary(
        result.imported,
        result.skipped,
        result.errors.length,
        result.warnings?.length
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to import institution hierarchy: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async importPartnerInstitutions(result: ImportResult): Promise<void> {
    this.logInfo('Importing tier 1: partner_institutions...');

    const rows = await this.context.legacyDb.query<LegacyPartnerInstitution>(
      'SELECT partner_id, project_id, institution_id, country_id FROM mwnf3.partner_institutions ORDER BY partner_id'
    );

    this.logInfo(`Found ${rows.length} partner_institutions rows`);

    for (const row of rows) {
      try {
        const link = await this.attachInstitutionToProject(
          row.project_id,
          row.institution_id,
          row.country_id,
          'partner'
        );
        if (!link) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        this.owners.set(row.partner_id, { projectId: row.project_id, partnerId: link.partnerId });

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const bc = `partner_institutions:${row.partner_id}`;
        result.errors.push(`${bc}: ${message}`);
        this.logError(`PartnerInstitution ${bc}`, message);
        this.showError();
      }
    }
  }

  private async importAssociatedInstitutions(result: ImportResult): Promise<void> {
    this.logInfo('Importing tier 2: associated_institutions...');

    const rows = await this.context.legacyDb.query<LegacyAssociatedInstitution>(
      'SELECT associated_id, partner_id, project_id, institution_id, country_id FROM mwnf3.associated_institutions ORDER BY associated_id'
    );

    this.logInfo(`Found ${rows.length} associated_institutions rows`);

    for (const row of rows) {
      try {
        const projectId = this.resolveAssociatedInstitutionProjectId(row, result);

        const link = await this.attachInstitutionToProject(
          projectId,
          row.institution_id,
          row.country_id,
          'associated_partner'
        );
        if (!link) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (row.partner_id !== null) {
          await this.recordParent(link, projectId, row.partner_id, result);
        }

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const bc = `associated_institutions:${row.associated_id}`;
        result.errors.push(`${bc}: ${message}`);
        this.logError(`AssociatedInstitution ${bc}`, message);
        this.showError();
      }
    }
  }

  private resolveAssociatedInstitutionProjectId(
    row: LegacyAssociatedInstitution,
    result: ImportResult
  ): string {
    if (row.project_id) {
      return row.project_id;
    }

    const warning =
      `associated_institutions id=${row.associated_id} has no project_id, ` +
      `assigning default legacy project ${DEFAULT_ASSOCIATED_INSTITUTION_PROJECT_ID}`;
    this.logWarning(warning);
    result.warnings.push(warning);

    return DEFAULT_ASSOCIATED_INSTITUTION_PROJECT_ID;
  }

  private async attachInstitutionToProject(
    projectId: string,
    institutionId: string,
    countryId: string,
    level: PartnerLevel
  ): Promise<ProjectLink | null> {
    // Resolve collection from project
    const collectionBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'projects',
      pkValues: [projectId],
    });
    const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
    if (!collectionId) {
      this.logWarning(
        `Collection not found for project ${projectId}, skipping institution hierarchy entry`
      );
      return null;
    }

    // Resolve partner from institution
    const partnerBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'institutions',
      pkValues: [institutionId, countryId],
    });
    const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
    if (!partnerId) {
      this.logWarning(
        `Partner not found for institution ${institutionId}:${countryId}, skipping institution hierarchy entry`
      );
      return null;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would attach institution ${institutionId}:${countryId} to project ${projectId} with level=${level}`
      );
      return { collectionId, partnerId };
    }

    await this.context.strategy.attachPartnerToCollectionWithLevel(
      collectionId,
      partnerId,
      'project',
      level
    );

    return { collectionId, partnerId };
  }

  /**
   * Puts the tier-1 institution `topPartnerId` (a
   * `partner_institutions.partner_id`) on the member's project-tier row. An
   * owner legacy doesn't resolve, or one in another project, gives no parent;
   * the second is reported (legacy has none).
   */
  private async recordParent(
    link: ProjectLink,
    projectId: string,
    topPartnerId: number,
    result: ImportResult
  ): Promise<void> {
    const owner = this.owners.get(topPartnerId);
    if (!owner) {
      this.logInfo(
        `partner_institutions id=${topPartnerId} was not imported; partner ${link.partnerId} gets no parent`
      );
      return;
    }
    if (owner.projectId !== projectId) {
      const warning = `partner_institutions id=${topPartnerId} is in project ${owner.projectId}, not ${projectId}; partner ${link.partnerId} gets no parent`;
      this.logWarning(warning);
      result.warnings.push(warning);
      return;
    }
    if (owner.partnerId === link.partnerId) {
      return;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would give partner ${link.partnerId} the parent ${owner.partnerId} in project ${projectId}`
      );
      return;
    }

    await this.context.strategy.setProjectPartnerParent(
      link.collectionId,
      link.partnerId,
      owner.partnerId
    );
  }
}
