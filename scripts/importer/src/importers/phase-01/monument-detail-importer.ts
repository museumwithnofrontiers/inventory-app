/**
 * Monument Detail Importer
 *
 * Imports monument details (items) from legacy database.
 * Monument details are child items of monuments with simpler structure.
 *
 * The artist line stays on each translation as written. The importer makes no
 * Artist record or item-Artist link from it (ADR 006 rule 2, #2734).
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  groupMonumentDetailsByPK,
  isBlankMonumentDetailGroup,
  transformMonumentDetail,
  transformMonumentDetailTranslation,
} from '../../domain/transformers/index.js';
import type { LegacyMonumentDetail, MonumentDetailGroup } from '../../domain/types/index.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { mapLanguageCode } from '../../utils/code-mappings.js';

export class MonumentDetailImporter extends BaseImporter {
  getName(): string {
    return 'MonumentDetailImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing monument details...');

      // Query all monument details (denormalized - multiple rows per detail)
      const details = await this.context.legacyDb.query<LegacyMonumentDetail>(
        'SELECT * FROM mwnf3.monument_details ORDER BY project_id, country_id, institution_id, monument_id, detail_id'
      );

      if (details.length === 0) {
        this.logInfo('No monument details found');
        return result;
      }

      // Group details by non-lang PK columns
      const detailGroups = groupMonumentDetailsByPK(details);
      this.logInfo(
        `Found ${detailGroups.length} unique monument details (${details.length} language rows)`
      );

      // Get default context ID
      const defaultContextId = await this.getDefaultContextIdAsync();

      // Import each detail group
      for (const group of detailGroups) {
        const backwardCompat = formatBackwardCompatibility({
          schema: 'mwnf3',
          table: 'monument_details',
          pkValues: [
            group.project_id,
            group.country_id,
            group.institution_id,
            group.monument_id,
            group.detail_id,
          ],
        });

        // Unused slots of the legacy detail editor: every language version is
        // blank, so there is nothing to build an item from. Expected legacy
        // noise rather than a failure — see isBlankMonumentDetailGroup for why
        // it takes every content column into account and not just the name.
        if (isBlankMonumentDetailGroup(group)) {
          this.logSkip(
            `Monument detail ${backwardCompat}: blank in every language version, skipping`
          );
          result.skipped++;
          continue;
        }

        try {
          const imported = await this.importMonumentDetail(group, defaultContextId, result);
          if (imported) {
            result.imported++;
            this.showProgress();
          } else {
            result.skipped++;
            this.showSkipped();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`${backwardCompat}: ${message}`);
          this.logError(`Monument detail ${backwardCompat}`, message);
          this.showError();
        }
      }

      this.showSummary(
        result.imported,
        result.skipped,
        result.errors.length,
        result.warnings?.length
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to query monument details: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async importMonumentDetail(
    group: MonumentDetailGroup,
    defaultContextId: string,
    result: ImportResult
  ): Promise<boolean> {
    const defaultLanguageId = await this.getDefaultLanguageIdAsync();
    const transformed = transformMonumentDetail(group, defaultLanguageId);

    // Log warning if translation in default language is missing
    if (transformed.warning) {
      this.logWarning(transformed.warning);
    }

    // Check if already imported
    if (await this.entityExistsAsync(transformed.backwardCompatibility, 'item')) {
      return false;
    }

    // Collect sample
    const sampleTranslation = group.translations[0];
    if (sampleTranslation) {
      this.collectSample(
        'monument_detail',
        sampleTranslation as unknown as Record<string, unknown>,
        'success',
        undefined,
        mapLanguageCode(sampleTranslation.lang_id)
      );
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import monument detail: ${group.project_id}:${group.institution_id}:${group.monument_id}:${group.detail_id}`
      );
      this.registerEntity(
        `sample-item-${group.project_id}-${group.institution_id}-${group.monument_id}-${group.detail_id}`,
        transformed.backwardCompatibility,
        'item'
      );
      return true;
    }

    // Resolve parent monument (nullable — detail can exist without parent)
    const parentItemId = await this.getEntityUuidAsync(
      transformed.parentBackwardCompatibility,
      'item'
    );
    if (!parentItemId) {
      this.logWarning(
        `Parent monument not found: ${transformed.parentBackwardCompatibility}. Importing monument detail ${transformed.backwardCompatibility} with parent_id = null.`
      );
    }

    // Resolve project context and collection (same as parent monument)
    const contextBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'projects',
      pkValues: [group.project_id],
    });
    const contextId = await this.getEntityUuidAsync(contextBackwardCompat, 'context');
    if (!contextId) {
      throw new Error(
        `Project context not found: ${contextBackwardCompat}. Monument detail ${transformed.backwardCompatibility} cannot be imported without its project.`
      );
    }

    // Use same backward_compatibility as context - tracker composite key handles uniqueness
    const collectionBackwardCompat = contextBackwardCompat;
    const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
    if (!collectionId) {
      throw new Error(
        `Collection not found: ${collectionBackwardCompat}. Monument detail ${transformed.backwardCompatibility} cannot be imported without its collection.`
      );
    }

    const partnerBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'institutions',
      pkValues: [group.institution_id, group.country_id],
    });
    const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
    if (!partnerId) {
      throw new Error(
        `Institution partner not found: ${partnerBackwardCompat}. Monument detail ${transformed.backwardCompatibility} cannot be imported without its institution.`
      );
    }

    // Use same backward_compatibility as context
    const projectBackwardCompat = contextBackwardCompat;
    const projectId = await this.getEntityUuidAsync(projectBackwardCompat, 'project');
    if (!projectId) {
      this.logWarning(
        `Project not found: ${projectBackwardCompat} for ${transformed.backwardCompatibility}, importing without project`
      );
    }

    // Create Item (detail with optional parent reference)
    const itemData = {
      ...transformed.data,
      collection_id: collectionId,
      partner_id: partnerId,
      project_id: projectId,
      parent_id: parentItemId ?? null, // Link to parent monument if resolved
    };

    const itemId = await this.context.strategy.writeItem(itemData);
    this.registerEntity(itemId, transformed.backwardCompatibility, 'item');

    // Create translations for all language versions
    for (const detail of group.translations) {
      try {
        const translationResult = transformMonumentDetailTranslation(detail);
        if (!translationResult) continue;

        // Add any warnings to result
        if (translationResult.warnings.length > 0) {
          result.warnings?.push(...translationResult.warnings);
        }

        await this.context.strategy.writeItemTranslation({
          ...translationResult.data,
          item_id: itemId,
          context_id: defaultContextId,
          author_id: null,
          text_copy_editor_id: null,
          translator_id: null,
          translation_copy_editor_id: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const warning = `Failed to create translation for detail ${group.detail_id} lang ${detail.lang_id}: ${message}`;
        this.logWarning(warning);
        result.warnings.push(warning);
      }
    }

    return true;
  }
}
