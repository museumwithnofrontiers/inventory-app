/**
 * SH National Context Importer
 *
 * Imports the Sharing History National Context system — a country-scoped editorial
 * overlay on SH exhibitions. For each participating country, curators select
 * representative images and assign objects/monuments with justification texts.
 *
 * Step 1: Import NC country-exhibition Collections (~62 rows)
 * Step 2: Import NC exhibition images (~130 rows) → collection_item pivot
 * Step 3: Import NC item assignments + justifications (~132 rows)
 *
 * Note: sh_national_context_exhibition_texts contains only 3 dummy rows and is ignored.
 *
 * All theme-level and subtheme-level NC tables are empty and are skipped.
 *
 * Legacy schema: mwnf3_sharing_history
 * Backward compatibility keys:
 * - NC Collection: mwnf3_sharing_history:sh_national_context_exhibitions:{country}:{exhibition_id}
 *
 * Dependencies:
 * - ShExhibitionImporter (SH exhibition collections must exist)
 * - ShObjectImporter, ShMonumentImporter (SH items must exist)
 * - CountryImporter (countries must exist)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import type {
  ShLegacyNCExhibition,
  ShLegacyNCExhibitionImage,
  ShLegacyRelObjectsNCExhibitions,
  ShLegacyRelObjectsNCExhibitionJustification,
  ShLegacyRelMonumentsNCExhibitions,
  ShLegacyRelMonumentsNCExhibitionJustification,
} from '../../domain/types/index.js';
import { keyByLanguageId, mapCountryCode } from '../../utils/code-mappings.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';

const SH_SCHEMA = 'mwnf3_sharing_history';

export class ShNationalContextImporter extends BaseImporter {
  // Cache: exhibition_id → project_id (for context resolution)
  private exhibitionProjectMap: Map<number, string> | null = null;

  getName(): string {
    return 'ShNationalContextImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing SH National Context...');

      // ========================================================================
      // Step 1: Import NC country-exhibition Collections
      // ========================================================================
      await this.importNCCollections(result);

      // ========================================================================
      // Step 2: Import NC exhibition images → collection_item pivot
      // ========================================================================
      await this.importNCImages(result);

      // ========================================================================
      // Step 3: Import NC item assignments + justifications
      // ========================================================================
      await this.importNCItemAssignments(result);

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ShNationalContextImporter', message);
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // Step 1: NC Collections
  // --------------------------------------------------------------------------
  private async importNCCollections(result: ImportResult): Promise<void> {
    const ncExhibitions = await this.context.legacyDb.query<ShLegacyNCExhibition>(
      `SELECT country, exhibition_id
       FROM ${SH_SCHEMA}.sh_national_context_exhibitions
       ORDER BY country, exhibition_id`
    );

    this.logInfo(`Found ${ncExhibitions.length} NC country-exhibition entries`);

    const defaultLanguageId = await this.getDefaultLanguageIdAsync();

    for (const legacy of ncExhibitions) {
      try {
        const backwardCompat = `${SH_SCHEMA}:sh_national_context_exhibitions:${legacy.country.toLowerCase()}:${legacy.exhibition_id}`;

        if (await this.entityExistsAsync(backwardCompat, 'collection')) {
          // Ensure-semantics (#1505): overlays created before the purpose
          // column existed must still end up purposed on a rerun.
          const existingId = await this.getEntityUuidAsync(backwardCompat, 'collection');
          if (existingId && !this.isDryRun && !this.isSampleOnlyMode) {
            const currentPurpose = await this.context.strategy.getCollectionPurpose(existingId);
            if (currentPurpose === null) {
              await this.context.strategy.updateCollectionPurpose(existingId, 'national-context');
              this.logInfo(`Set purpose 'national-context' on ${backwardCompat}`);
              result.imported++;
              this.showProgress();
              continue;
            }
          }
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Resolve parent SH exhibition Collection
        const exhibitionBackwardCompat = `${SH_SCHEMA}:sh_exhibitions:${legacy.exhibition_id}`;
        const parentCollectionId = await this.getEntityUuidAsync(
          exhibitionBackwardCompat,
          'collection'
        );
        if (!parentCollectionId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `NC ${legacy.country}/${legacy.exhibition_id}: SH exhibition not found`
          );
          this.logWarning(
            `NC ${legacy.country}/${legacy.exhibition_id}: SH exhibition not found (${exhibitionBackwardCompat}), skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Resolve country to canonical ISO-3 ID
        let countryId: string | null = null;
        try {
          countryId = mapCountryCode(legacy.country);
        } catch {
          this.logWarning(
            `NC ${legacy.country}/${legacy.exhibition_id}: Unknown country code '${legacy.country}'`
          );
        }

        // Resolve context (from parent SH exhibition → project)
        const contextId = await this.resolveContextForExhibition(legacy.exhibition_id);
        if (!contextId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `NC ${legacy.country}/${legacy.exhibition_id}: Could not resolve context`
          );
          this.logWarning(
            `NC ${legacy.country}/${legacy.exhibition_id}: Could not resolve context, skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const internalName = `sh_nc_${legacy.country.toLowerCase()}_exh_${legacy.exhibition_id}`;

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.registerEntity('', backwardCompat, 'collection');
          result.imported++;
          this.showProgress();
          continue;
        }

        const collectionId = await this.context.strategy.writeCollection({
          internal_name: internalName,
          backward_compatibility: backwardCompat,
          context_id: contextId,
          language_id: defaultLanguageId,
          parent_id: parentCollectionId,
          type: 'collection',
          purpose: 'national-context',
          country_id: countryId,
        });

        this.registerEntity(collectionId, backwardCompat, 'collection');
        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`NC ${legacy.country}/${legacy.exhibition_id}: ${message}`);
        this.logError(`NC ${legacy.country}/${legacy.exhibition_id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Step 2: NC exhibition images → collection_item pivot
  // --------------------------------------------------------------------------
  private async importNCImages(result: ImportResult): Promise<void> {
    const images = await this.context.legacyDb.query<ShLegacyNCExhibitionImage>(
      `SELECT image_id, country, exhibition_id, image_item, item_type, sort_order
       FROM ${SH_SCHEMA}.sh_national_context_exhibition_images
       ORDER BY country, exhibition_id, sort_order`
    );

    this.logInfo(`Found ${images.length} NC exhibition images`);

    for (const legacy of images) {
      try {
        // Reject unknown item_type before any further processing
        if (legacy.item_type !== 'obj' && legacy.item_type !== 'mon') {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `NC image ${legacy.image_id}: Unknown item_type '${legacy.item_type}', skipping`
          );
          this.logWarning(
            `NC image ${legacy.image_id}: Unknown item_type '${legacy.item_type}', skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const collectionBackwardCompat = `${SH_SCHEMA}:sh_national_context_exhibitions:${legacy.country.toLowerCase()}:${legacy.exhibition_id}`;
        const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
        if (!collectionId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `NC image ${legacy.image_id}: Collection not found (${collectionBackwardCompat})`
          );
          this.logWarning(`NC image ${legacy.image_id}: Collection not found, skipping`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const itemBackwardCompat = this.resolveImageItemReference(
          legacy.image_item,
          legacy.item_type
        );
        if (!itemBackwardCompat) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `NC image ${legacy.image_id}: Could not parse image_item '${legacy.image_item}'`
          );
          this.logWarning(
            `NC image ${legacy.image_id}: Could not parse image_item '${legacy.image_item}', skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
        if (!itemId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `NC image ${legacy.image_id}: Item not found (${itemBackwardCompat})`
          );
          this.logWarning(
            `NC image ${legacy.image_id}: Item not found (${itemBackwardCompat}), skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        try {
          await this.context.strategy.writeCollectionItem({
            collection_id: collectionId,
            item_id: itemId,
            display_order: legacy.sort_order,
            extra: {
              source_image_id: legacy.image_id,
              source_image_item: legacy.image_item,
            },
          });
        } catch (writeError) {
          const writeMsg = writeError instanceof Error ? writeError.message : String(writeError);
          if (writeMsg.includes('Duplicate') || writeMsg.includes('duplicate')) {
            this.logSkip(
              `NC image ${legacy.image_id}: Duplicate pivot entry (item already linked), skipping`
            );
            result.skipped++;
            continue;
          }
          throw writeError;
        }

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`NC image ${legacy.image_id}: ${message}`);
        this.logError(`NC image ${legacy.image_id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Step 3: NC item assignments with justifications
  // --------------------------------------------------------------------------
  private async importNCItemAssignments(result: ImportResult): Promise<void> {
    // Step 4a: Object assignments
    const objAssignments = await this.context.legacyDb.query<ShLegacyRelObjectsNCExhibitions>(
      `SELECT id, nc_country, nc_exhibition_id, project_id, country, number
       FROM ${SH_SCHEMA}.rel_objects_nc_exhibitions
       ORDER BY nc_country, nc_exhibition_id, id`
    );

    // Pre-load justifications for objects
    const objJustifications =
      await this.context.legacyDb.query<ShLegacyRelObjectsNCExhibitionJustification>(
        `SELECT relation_id, lang, justification_text
       FROM ${SH_SCHEMA}.rel_objects_nc_exhibition_justifications
       WHERE justification_text IS NOT NULL AND justification_text != ''`
      );
    const objJustMap = this.buildJustificationMap(objJustifications);

    this.logInfo(
      `Found ${objAssignments.length} NC object assignments, ${objJustifications.length} justifications`
    );

    for (const legacy of objAssignments) {
      try {
        await this.writeNCAssignment(
          result,
          legacy.nc_country,
          legacy.nc_exhibition_id,
          `${SH_SCHEMA}:sh_objects:${legacy.project_id.toLowerCase()}:${legacy.country.toLowerCase()}:${legacy.number}`,
          legacy.id,
          objJustMap,
          `NC obj ${legacy.id}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`NC obj ${legacy.id}: ${message}`);
        this.logError(`NC obj ${legacy.id}`, message);
        this.showError();
      }
    }

    // Step 4b: Monument assignments
    const monAssignments = await this.context.legacyDb.query<ShLegacyRelMonumentsNCExhibitions>(
      `SELECT id, nc_country, nc_exhibition_id, project_id, country, number
       FROM ${SH_SCHEMA}.rel_monuments_nc_exhibitions
       ORDER BY nc_country, nc_exhibition_id, id`
    );

    const monJustifications =
      await this.context.legacyDb.query<ShLegacyRelMonumentsNCExhibitionJustification>(
        `SELECT relation_id, lang, justification_text
       FROM ${SH_SCHEMA}.rel_monuments_nc_exhibition_justifications
       WHERE justification_text IS NOT NULL AND justification_text != ''`
      );
    const monJustMap = this.buildJustificationMap(monJustifications);

    this.logInfo(
      `Found ${monAssignments.length} NC monument assignments, ${monJustifications.length} justifications`
    );

    for (const legacy of monAssignments) {
      try {
        await this.writeNCAssignment(
          result,
          legacy.nc_country,
          legacy.nc_exhibition_id,
          `${SH_SCHEMA}:sh_monuments:${legacy.project_id.toLowerCase()}:${legacy.country.toLowerCase()}:${legacy.number}`,
          legacy.id,
          monJustMap,
          `NC mon ${legacy.id}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`NC mon ${legacy.id}: ${message}`);
        this.logError(`NC mon ${legacy.id}`, message);
        this.showError();
      }
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async writeNCAssignment(
    result: ImportResult,
    ncCountry: string,
    ncExhibitionId: number,
    itemBackwardCompat: string,
    relationId: number,
    justMap: Map<number, Record<string, string>>,
    context: string
  ): Promise<void> {
    const collectionBackwardCompat = `${SH_SCHEMA}:sh_national_context_exhibitions:${ncCountry.toLowerCase()}:${ncExhibitionId}`;
    const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
    if (!collectionId) {
      result.warnings = result.warnings || [];
      result.warnings.push(`${context}: NC Collection not found (${collectionBackwardCompat})`);
      this.logWarning(
        `${context}: NC Collection not found (${collectionBackwardCompat}), skipping`
      );
      result.skipped++;
      this.showSkipped();
      return;
    }

    const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
    if (!itemId) {
      result.warnings = result.warnings || [];
      result.warnings.push(`${context}: Item not found (${itemBackwardCompat})`);
      this.logWarning(`${context}: Item not found (${itemBackwardCompat}), skipping`);
      result.skipped++;
      this.showSkipped();
      return;
    }

    const extra: Record<string, unknown> = {};
    const justifications = justMap.get(relationId);
    if (justifications) {
      // Keyed by language id in `extra` (#2394).
      extra.justifications = keyByLanguageId(justifications, (code) =>
        this.logWarning(`${context}: justification in unknown language '${code}', skipped`)
      );
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      result.imported++;
      this.showProgress();
      return;
    }

    try {
      await this.context.strategy.writeCollectionItem({
        collection_id: collectionId,
        item_id: itemId,
        extra: Object.keys(extra).length > 0 ? extra : null,
      });
    } catch (writeError) {
      const writeMsg = writeError instanceof Error ? writeError.message : String(writeError);
      if (writeMsg.includes('Duplicate') || writeMsg.includes('duplicate')) {
        this.logSkip(`${context}: Duplicate pivot entry (item already linked), skipping`);
        result.skipped++;
        return;
      }
      throw writeError;
    }

    result.imported++;
    this.showProgress();
  }

  /**
   * Build justification map: relation_id → { lang: text } (with HTML→MD conversion).
   */
  private buildJustificationMap(
    rows: Array<{ relation_id: number; lang: string; justification_text: string }>
  ): Map<number, Record<string, string>> {
    const map = new Map<number, Record<string, string>>();
    for (const row of rows) {
      if (!map.has(row.relation_id)) {
        map.set(row.relation_id, {});
      }
      map.get(row.relation_id)![row.lang] = convertHtmlToMarkdown(row.justification_text);
    }
    return map;
  }

  /**
   * Resolve an image_item reference (SH format: 'project_id;country;number') to a backward_compatibility key.
   */
  private resolveImageItemReference(imageItem: string, itemType: string): string | null {
    if (!imageItem || !imageItem.trim()) return null;

    const parts = imageItem.split(';').map((s) => s.trim());
    if (parts.length < 3) return null;

    const [projectId, country, numberStr] = parts;
    const number = parseInt(numberStr!, 10);
    if (isNaN(number)) return null;

    const table = itemType === 'mon' ? 'sh_monuments' : 'sh_objects';
    return `${SH_SCHEMA}:${table}:${projectId!.toLowerCase()}:${country!.toLowerCase()}:${number}`;
  }

  /**
   * Resolve context ID for a given SH exhibition_id by looking up its project.
   */
  private async resolveContextForExhibition(exhibitionId: number): Promise<string | null> {
    if (!this.exhibitionProjectMap) {
      const rows = await this.context.legacyDb.query<{ exhibition_id: number; project_id: string }>(
        `SELECT exhibition_id, project_id FROM ${SH_SCHEMA}.sh_exhibitions`
      );
      this.exhibitionProjectMap = new Map(rows.map((r) => [r.exhibition_id, r.project_id]));
    }

    const projectId = this.exhibitionProjectMap.get(exhibitionId);
    if (!projectId) return null;

    const projectBackwardCompat = `${SH_SCHEMA}:sh_projects:${projectId.toLowerCase()}`;
    return this.getEntityUuidAsync(projectBackwardCompat, 'context');
  }
}
