/**
 * Explore Monument Cross-Reference Importer (Story 13.2)
 *
 * Imports cross-schema item_item_links:
 * 1. exploremonument_vm (656 rows) → links to mwnf3 monument Items
 * 2. exploremonument_tr (1,046 rows) → links to Travels monument Items
 * 3. exploremonument_sh (194 rows) → links to SH monument Items
 *
 * The monuments' museums (exploremonument_museums) are kept by
 * ExploreMonumentImporter on the placement rows (M16 C4); this step no longer
 * checks them (M16 G2 #2697).
 *
 * Dependencies:
 * - All Item importers across all schemas must have run
 * - ExploreContextImporter
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { ExploreMonumentResolver } from './explore-monument-resolver.js';

interface LegacyMonumentVM {
  monumentId: number;
  REF_monuments_project_id: string;
  REF_monuments_country: string;
  REF_monuments_institution_id: string;
  REF_monuments_number: number;
}

interface LegacyMonumentTR {
  monumentId: number;
  REF_tr_monuments_project_id: string;
  REF_tr_monuments_country: string;
  REF_tr_monuments_itinerary_id: string;
  REF_tr_monuments_location_id: string;
  REF_tr_monuments_number: string;
  REF_tr_monuments_trail_id: number;
}

interface LegacyMonumentSH {
  monumentId: number;
  project_id: string;
  country: string;
  number: number;
}

export class ExploreMonumentCrossRefImporter extends BaseImporter {
  private exploreContextId!: string;
  private monumentResolver!: ExploreMonumentResolver;

  getName(): string {
    return 'ExploreMonumentCrossRefImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      // Resolve Explore context
      const exploreContextBC = 'mwnf3_explore:context';
      const exploreContextId = await this.getEntityUuidAsync(exploreContextBC, 'context');
      if (!exploreContextId) {
        throw new Error(`Explore context not found (${exploreContextBC}).`);
      }
      this.exploreContextId = exploreContextId;
      this.monumentResolver = new ExploreMonumentResolver({
        legacyDb: this.context.legacyDb,
        tracker: this.context.tracker,
        getEntityUuid: (backwardCompatibility, entityType) =>
          this.getEntityUuidAsync(backwardCompatibility, entityType),
      });

      // 1. exploremonument_vm → mwnf3 monuments
      this.logInfo('Importing Explore → mwnf3 monument cross-references...');
      const vmLinks = await this.context.legacyDb.query<LegacyMonumentVM>(
        `SELECT monumentId, REF_monuments_project_id, REF_monuments_country,
                REF_monuments_institution_id, REF_monuments_number
         FROM mwnf3_explore.exploremonument_vm`
      );
      this.logInfo(`Found ${vmLinks.length} VM cross-references`);

      for (const vm of vmLinks) {
        try {
          const sourceResolution = await this.monumentResolver.resolveForSource(vm.monumentId, 'vm');
          if (!sourceResolution.itemId || !sourceResolution.itemBackwardCompatibility) {
            this.logWarning(
              `${sourceResolution.message ?? `Explore monument mwnf3_explore:monument:${vm.monumentId} did not resolve to a vm item`}, skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // mwnf3 monument BC format: mwnf3:monuments:{project_id}:{country}:{institution_id}:{number}
          const targetBC = `mwnf3:monuments:${vm.REF_monuments_project_id}:${vm.REF_monuments_country}:${vm.REF_monuments_institution_id}:${vm.REF_monuments_number}`;
          const targetId = await this.getEntityUuidAsync(targetBC, 'item');
          if (!targetId) {
            this.logWarning(`mwnf3 monument not found: ${targetBC}, skipping`);
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (sourceResolution.itemId === targetId) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            this.showProgress();
            continue;
          }

          const linkBC = `mwnf3_explore:monument_vm:${vm.monumentId}:${vm.REF_monuments_project_id}:${vm.REF_monuments_country}:${vm.REF_monuments_institution_id}:${vm.REF_monuments_number}`;
          await this.context.strategy.writeItemItemLink({
            source_id: sourceResolution.itemId,
            target_id: targetId,
            context_id: this.exploreContextId,
            backward_compatibility: linkBC,
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logWarning(`Failed VM link monument ${vm.monumentId}: ${message}`);
        }
      }

      // 2. exploremonument_tr → Travels monuments
      // DDL columns: monumentId, REF_tr_monuments_project_id, REF_tr_monuments_country,
      //   REF_tr_monuments_itinerary_id, REF_tr_monuments_location_id,
      //   REF_tr_monuments_number, REF_tr_monuments_lang, REF_tr_monuments_trail_id
      this.logInfo('Importing Explore → Travels monument cross-references...');
      const trLinks = await this.context.legacyDb.query<LegacyMonumentTR>(
        `SELECT monumentId, REF_tr_monuments_project_id, REF_tr_monuments_country,
                REF_tr_monuments_itinerary_id, REF_tr_monuments_location_id,
                REF_tr_monuments_number, REF_tr_monuments_trail_id
         FROM mwnf3_explore.exploremonument_tr`
      );
      this.logInfo(`Found ${trLinks.length} Travels cross-references`);

      for (const tr of trLinks) {
        try {
          const sourceResolution = await this.monumentResolver.resolveForSource(tr.monumentId, 'travels');
          if (!sourceResolution.itemId || !sourceResolution.itemBackwardCompatibility) {
            this.logWarning(
              `${sourceResolution.message ?? `Explore monument mwnf3_explore:monument:${tr.monumentId} did not resolve to a travels item`}, skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Travels monument BC: mwnf3_travels:monument:{project_id}:{country}:{trail_id}:{itinerary_id}:{location_id}:{number}
          const targetBC = `mwnf3_travels:monument:${tr.REF_tr_monuments_project_id}:${tr.REF_tr_monuments_country}:${tr.REF_tr_monuments_trail_id}:${tr.REF_tr_monuments_itinerary_id}:${tr.REF_tr_monuments_location_id}:${tr.REF_tr_monuments_number}`;
          const targetId = await this.getEntityUuidAsync(targetBC, 'item');
          if (!targetId) {
            this.logWarning(`Travels monument not found: ${targetBC}, skipping`);
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (sourceResolution.itemId === targetId) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            this.showProgress();
            continue;
          }

          const linkBC = `mwnf3_explore:monument_tr:${tr.monumentId}:${tr.REF_tr_monuments_project_id}:${tr.REF_tr_monuments_country}:${tr.REF_tr_monuments_trail_id}:${tr.REF_tr_monuments_itinerary_id}:${tr.REF_tr_monuments_location_id}:${tr.REF_tr_monuments_number}`;
          await this.context.strategy.writeItemItemLink({
            source_id: sourceResolution.itemId,
            target_id: targetId,
            context_id: this.exploreContextId,
            backward_compatibility: linkBC,
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logWarning(`Failed TR link monument ${tr.monumentId}: ${message}`);
        }
      }

      // 3. exploremonument_sh → SH monuments
      this.logInfo('Importing Explore → SH monument cross-references...');
      const shLinks = await this.context.legacyDb.query<LegacyMonumentSH>(
        `SELECT monumentId, project_id, country, number FROM mwnf3_explore.exploremonument_sh`
      );
      this.logInfo(`Found ${shLinks.length} SH cross-references`);

      for (const sh of shLinks) {
        try {
          const sourceResolution = await this.monumentResolver.resolveForSource(sh.monumentId, 'sharing-history');
          if (!sourceResolution.itemId || !sourceResolution.itemBackwardCompatibility) {
            this.logWarning(
              `${sourceResolution.message ?? `Explore monument mwnf3_explore:monument:${sh.monumentId} did not resolve to a sharing-history item`}, skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // SH monument BC: mwnf3_sharing_history:sh_monuments:{project}:{country}:{monument_id}
          const targetBC = `mwnf3_sharing_history:sh_monuments:${sh.project_id.toLowerCase()}:${sh.country.toLowerCase()}:${sh.number}`;
          const targetId = await this.getEntityUuidAsync(targetBC, 'item');
          if (!targetId) {
            this.logWarning(`SH monument not found: ${targetBC}, skipping`);
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (sourceResolution.itemId === targetId) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            this.showProgress();
            continue;
          }

          const linkBC = `mwnf3_explore:monument_sh:${sh.monumentId}:${sh.project_id.toLowerCase()}:${sh.country.toLowerCase()}:${sh.number}`;
          await this.context.strategy.writeItemItemLink({
            source_id: sourceResolution.itemId,
            target_id: targetId,
            context_id: this.exploreContextId,
            backward_compatibility: linkBC,
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logWarning(`Failed SH link monument ${sh.monumentId}: ${message}`);
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in monument cross-reference import: ${errorMessage}`);
      this.logError('ExploreMonumentCrossRefImporter', errorMessage);
      this.showError();
    }

    return result;
  }
}
