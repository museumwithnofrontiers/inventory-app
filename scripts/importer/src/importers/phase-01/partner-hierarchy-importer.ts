/**
 * Partner Hierarchy Importer
 *
 * Imports partner hierarchy levels from legacy tables:
 * - mwnf3.partner_museums (tier 1: partner)
 * - mwnf3.associated_museums (tier 2: associated_partner)
 * - mwnf3.further_associated_museums (tier 3: minor_contributor)
 *
 * These map to collection_partner.level in inventory-app, on the project's
 * own collection (`collection_type='project'`) — what partner-exporter.ts's
 * curated-partner filter keys off.
 *
 * Legacy also nests an associated (or further associated) museum under one
 * tier-1 museum of the same project, through `associated_museums.partner_id`
 * / `further_associated_museums.partner_id` (a `partner_museums.partner_id`).
 * That owner goes on the member's project-tier row as `parent_partner_id`
 * (M16 J2, #2709): two top-level museums in the same country keep their own
 * associated museums apart, and the same museum can be a parent in one
 * project and not in another, as in legacy. Until J2 this lived in one
 * `partner_group:museums:N` collection per tier-1 museum.
 *
 * Dependencies:
 * - ProjectImporter (creates collections from projects)
 * - PartnerImporter (creates partners from museums)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';

interface LegacyPartnerMuseum {
  partner_id: number;
  project_id: string;
  museum_id: string;
  country_id: string;
}

interface LegacyAssociatedMuseum {
  associated_id: number;
  partner_id: number | null;
  project_id: string | null;
  museum_id: string;
  country_id: string;
  /** The museum's own project (`museums.project_id`), joined in. */
  museum_project_id: string | null;
}

interface LegacyFurtherAssociatedMuseum {
  fur_associated_id: number;
  partner_id: number;
  project_id: string;
  museum_id: string;
  country_id: string;
}

/** A partner's project-tier row: the project's collection and the partner. */
interface ProjectLink {
  collectionId: string;
  partnerId: string;
}

export class PartnerHierarchyImporter extends BaseImporter {
  /** `partner_museums.partner_id` → the tier-1 museum's project and partner. */
  private readonly owners = new Map<number, { projectId: string; partnerId: string }>();

  getName(): string {
    return 'PartnerHierarchyImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing partner hierarchy levels...');

      // Import tier 1: partner_museums → level = 'partner'
      await this.importPartnerMuseums(result);

      // Import tier 2: associated_museums → level = 'associated_partner'
      await this.importAssociatedMuseums(result);

      // Import tier 3: further_associated_museums → level = 'minor_contributor'
      await this.importFurtherAssociatedMuseums(result);

      this.showSummary(
        result.imported,
        result.skipped,
        result.errors.length,
        result.warnings?.length
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to import partner hierarchy: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async importPartnerMuseums(result: ImportResult): Promise<void> {
    this.logInfo('Importing tier 1: partner_museums...');

    const rows = await this.context.legacyDb.query<LegacyPartnerMuseum>(
      'SELECT partner_id, project_id, museum_id, country_id FROM mwnf3.partner_museums ORDER BY partner_id'
    );

    this.logInfo(`Found ${rows.length} partner_museums rows`);

    for (const row of rows) {
      try {
        const link = await this.attachPartnerToProject(
          row.project_id,
          row.museum_id,
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
        const bc = `partner_museums:${row.partner_id}`;
        result.errors.push(`${bc}: ${message}`);
        this.logError(`PartnerMuseum ${bc}`, message);
        this.showError();
      }
    }
  }

  private async importAssociatedMuseums(result: ImportResult): Promise<void> {
    this.logInfo('Importing tier 2: associated_museums...');

    const rows = await this.context.legacyDb.query<LegacyAssociatedMuseum>(
      `SELECT a.associated_id, a.partner_id, a.project_id, a.museum_id, a.country_id,
              m.project_id AS museum_project_id
       FROM mwnf3.associated_museums a
       LEFT JOIN mwnf3.museums m ON m.museum_id = a.museum_id AND m.country = a.country_id
       ORDER BY a.associated_id`
    );

    this.logInfo(`Found ${rows.length} associated_museums rows`);

    for (const row of rows) {
      try {
        const projectId = this.resolveAssociatedMuseumProjectId(row, result);
        if (!projectId) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const link = await this.attachPartnerToProject(
          projectId,
          row.museum_id,
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
        const bc = `associated_museums:${row.associated_id}`;
        result.errors.push(`${bc}: ${message}`);
        this.logError(`AssociatedMuseum ${bc}`, message);
        this.showError();
      }
    }
  }

  /**
   * The row's project, else the museum's own (`museums.project_id`): five rows
   * have none, all "Further Associated Museums" whose museum row is ISL
   * (M16 G3 #2699). With neither, the row is skipped, reported; no project is
   * assumed.
   */
  private resolveAssociatedMuseumProjectId(
    row: LegacyAssociatedMuseum,
    result: ImportResult
  ): string | null {
    const ownProject = row.project_id?.trim();
    if (ownProject) {
      return ownProject;
    }

    const museumProject = row.museum_project_id?.trim();
    if (museumProject) {
      this.logInfo(
        `associated_museums id=${row.associated_id} has no project_id; using its museum's project ${museumProject}`
      );
      return museumProject;
    }

    const warning =
      `associated_museums id=${row.associated_id} has no project_id, ` +
      `and museum ${row.museum_id}:${row.country_id} has none either; skipped`;
    this.logWarning(warning);
    result.warnings.push(warning);
    return null;
  }

  private async importFurtherAssociatedMuseums(result: ImportResult): Promise<void> {
    this.logInfo('Importing tier 3: further_associated_museums...');

    const rows = await this.context.legacyDb.query<LegacyFurtherAssociatedMuseum>(
      'SELECT fur_associated_id, partner_id, project_id, museum_id, country_id FROM mwnf3.further_associated_museums ORDER BY fur_associated_id'
    );

    this.logInfo(`Found ${rows.length} further_associated_museums rows`);

    for (const row of rows) {
      try {
        const link = await this.attachPartnerToProject(
          row.project_id,
          row.museum_id,
          row.country_id,
          'minor_contributor'
        );
        if (!link) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        await this.recordParent(link, row.project_id, row.partner_id, result);

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const bc = `further_associated_museums:${row.fur_associated_id}`;
        result.errors.push(`${bc}: ${message}`);
        this.logError(`FurtherAssociatedMuseum ${bc}`, message);
        this.showError();
      }
    }
  }

  private async attachPartnerToProject(
    projectId: string,
    museumId: string,
    countryId: string,
    level: string
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
        `Collection not found for project ${projectId}, skipping partner hierarchy entry`
      );
      return null;
    }

    // Resolve partner from museum
    const partnerBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'museums',
      pkValues: [museumId, countryId],
    });
    const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
    if (!partnerId) {
      this.logWarning(
        `Partner not found for museum ${museumId}:${countryId}, skipping partner hierarchy entry`
      );
      return null;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would attach partner ${museumId}:${countryId} to project ${projectId} with level=${level}`
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
   * Puts the tier-1 museum `topPartnerId` (a `partner_museums.partner_id`) on
   * the member's project-tier row. An owner legacy doesn't resolve, or one in
   * another project, gives no parent; the second is reported (legacy has none).
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
        `partner_museums id=${topPartnerId} was not imported; partner ${link.partnerId} gets no parent`
      );
      return;
    }
    if (owner.projectId !== projectId) {
      const warning = `partner_museums id=${topPartnerId} is in project ${owner.projectId}, not ${projectId}; partner ${link.partnerId} gets no parent`;
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
