/**
 * Partner Hierarchy Importer
 *
 * Imports partner hierarchy levels from legacy tables:
 * - mwnf3.partner_museums (tier 1: partner)
 * - mwnf3.associated_museums (tier 2: associated_partner)
 * - mwnf3.further_associated_museums (tier 3: minor_contributor)
 *
 * These map to collection_partner.level in inventory-app.
 *
 * Beyond the flat per-project tier (still attached to the project's own
 * collection, `collection_type='project'`, as before — this is what
 * partner-exporter.ts's curated-partner filter keys off), each tier-1
 * `partner_museums` row also gets its own dedicated "group" collection
 * (`collection_type='collection'`), and every associated/further-associated
 * museum legacy links to it via `associated_museums.partner_id` /
 * `further_associated_museums.partner_id` is *also* attached to that same
 * group collection. This reproduces legacy's actual nesting — which specific
 * associated museum belongs under which specific top-level museum — which the
 * flat per-project tier alone cannot: two different top-level museums in the
 * same country would otherwise have their associated museums indistinguishably
 * merged into one country-wide bucket. Because the group collection is scoped
 * to this project's context, the same museum can be a parent in one project
 * and a mere sibling (or absent) in another — the hierarchy is per-context,
 * not a global property of the partner itself, matching how legacy itself
 * scopes `partner_museums`/`associated_museums` per `project_id`.
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

export class PartnerHierarchyImporter extends BaseImporter {
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
        const imported = await this.attachPartnerToProject(
          row.project_id,
          row.museum_id,
          row.country_id,
          'partner'
        );
        if (!imported) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Tier-1 museum owns a group collection for this project — create it
        // now (before any tier-2/3 row can need it) and attach the museum
        // itself as the group's 'partner'-level (owner) member. Best-effort:
        // this enriches the flat per-project attachment above but doesn't
        // gate it — a row whose group-collection step fails (e.g. project
        // context not yet resolvable) still counts as imported, since the
        // primary (legacy-equivalent) attachment above already succeeded.
        await this.attachToGroupCollection(
          row.project_id,
          'museums',
          row.partner_id,
          row.museum_id,
          row.country_id,
          'partner'
        );

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

        const imported = await this.attachPartnerToProject(
          projectId,
          row.museum_id,
          row.country_id,
          'associated_partner'
        );
        if (!imported) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Best-effort: nests under the parent's group collection if it has
        // one (row.partner_id !== null and the parent's own tier-1 row
        // resolved). Doesn't gate result.imported — see importPartnerMuseums.
        if (row.partner_id !== null) {
          await this.attachToGroupCollection(
            projectId,
            'museums',
            row.partner_id,
            row.museum_id,
            row.country_id,
            'associated_partner'
          );
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
        const imported = await this.attachPartnerToProject(
          row.project_id,
          row.museum_id,
          row.country_id,
          'minor_contributor'
        );
        if (!imported) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Best-effort — doesn't gate result.imported, see importPartnerMuseums.
        await this.attachToGroupCollection(
          row.project_id,
          'museums',
          row.partner_id,
          row.museum_id,
          row.country_id,
          'minor_contributor'
        );

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
  ): Promise<boolean> {
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
      return false;
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
      return false;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would attach partner ${museumId}:${countryId} to project ${projectId} with level=${level}`
      );
      return true;
    }

    await this.context.strategy.attachPartnerToCollectionWithLevel(
      collectionId,
      partnerId,
      'project',
      level
    );

    return true;
  }

  /**
   * Attaches a partner (identified by museumId/countryId) to the dedicated
   * per-context "group" collection for legacy top-level partner `topPartnerId`
   * (a `partner_museums.partner_id` — globally unique, one project per row),
   * creating that group collection on first use. `entityType` distinguishes
   * museums from institutions in the backward_compatibility key so the two
   * hierarchies never collide.
   */
  private async attachToGroupCollection(
    projectId: string,
    entityType: 'museums' | 'institutions',
    topPartnerId: number,
    museumId: string,
    countryId: string,
    level: string
  ): Promise<boolean> {
    const partnerBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: entityType,
      pkValues: [museumId, countryId],
    });
    const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
    if (!partnerId) {
      // Already warned about by attachPartnerToProject for the same row.
      return false;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would attach partner ${museumId}:${countryId} to group collection for ${entityType}:${topPartnerId} with level=${level}`
      );
      return true;
    }

    const groupCollectionId = await this.getOrCreateGroupCollection(
      projectId,
      entityType,
      topPartnerId
    );
    if (!groupCollectionId) {
      return false;
    }

    await this.context.strategy.attachPartnerToCollectionWithLevel(
      groupCollectionId,
      partnerId,
      'collection',
      level
    );

    return true;
  }

  private async getOrCreateGroupCollection(
    projectId: string,
    entityType: 'museums' | 'institutions',
    topPartnerId: number
  ): Promise<string | null> {
    const groupBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: `partner_${entityType}_group`,
      pkValues: [String(topPartnerId)],
    });

    const existingId = await this.getEntityUuidAsync(groupBackwardCompat, 'collection');
    if (existingId) {
      return existingId;
    }

    const projectBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'projects',
      pkValues: [projectId],
    });
    const parentCollectionId = await this.getEntityUuidAsync(projectBackwardCompat, 'collection');
    const contextId = await this.getEntityUuidAsync(projectBackwardCompat, 'context');
    if (!parentCollectionId || !contextId) {
      this.logWarning(
        `Project collection/context not found for ${projectId}, skipping group collection for ${entityType}:${topPartnerId}`
      );
      return null;
    }

    const defaultLanguageId = await this.getDefaultLanguageIdAsync();
    const internalName = `partner_group:${entityType}:${topPartnerId}`;

    const collectionId = await this.context.strategy.writeCollection({
      internal_name: internalName,
      backward_compatibility: groupBackwardCompat,
      context_id: contextId,
      language_id: defaultLanguageId,
      parent_id: parentCollectionId,
      type: 'collection',
      latitude: null,
      longitude: null,
      map_zoom: null,
      country_id: null,
    });

    this.registerEntity(collectionId, groupBackwardCompat, 'collection');

    return collectionId;
  }
}
