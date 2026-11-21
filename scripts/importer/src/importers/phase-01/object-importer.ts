/**
 * Object Importer
 *
 * Imports objects (items) from legacy database.
 * Handles:
 * - Denormalized data (multiple language rows per object)
 * - EPM description2 handling
 * - Tags and authors
 *
 * The artist line stays on each translation as written. The importer makes no
 * Artist record or item-Artist link from it (ADR 006 rule 2, #2734): Artists
 * are editorial records, linked in the panel.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  groupObjectsByPK,
  transformObject,
  transformObjectTranslation,
  extractObjectTags,
  planTranslations,
} from '../../domain/transformers/index.js';
import type { LegacyObject, ObjectGroup } from '../../domain/types/index.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { mapLanguageCode } from '../../utils/code-mappings.js';
import { TagHelper } from '../../helpers/tag-helper.js';
import { AuthorHelper } from '../../helpers/author-helper.js';

export class ObjectImporter extends BaseImporter {
  private tagHelper!: TagHelper;
  private authorHelper!: AuthorHelper;

  getName(): string {
    return 'ObjectImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    // Initialize helpers
    this.tagHelper = new TagHelper(
      this.context.strategy,
      this.context.tracker,
      this.context.logger
    );
    this.authorHelper = new AuthorHelper(
      this.context.strategy,
      this.context.tracker,
      this.context.logger
    );
    try {
      this.logInfo('Importing objects...');

      // Query all objects (denormalized - multiple rows per object)
      const objects = await this.context.legacyDb.query<LegacyObject>(
        'SELECT * FROM mwnf3.objects ORDER BY project_id, country, museum_id, number'
      );

      if (objects.length === 0) {
        this.logInfo('No objects found');
        return result;
      }

      // Group objects by non-lang PK columns
      const objectGroups = groupObjectsByPK(objects);
      this.logInfo(`Found ${objectGroups.length} unique objects (${objects.length} language rows)`);

      // Check if EPM context exists
      const epmContextBackwardCompat = formatBackwardCompatibility({
        schema: 'mwnf3',
        table: 'projects',
        pkValues: ['EPM'],
      });
      const epmContextId = await this.getEntityUuidAsync(epmContextBackwardCompat, 'context');
      const hasEpmContext = !!epmContextId;

      // Import each object group
      for (const group of objectGroups) {
        try {
          const imported = await this.importObject(group, hasEpmContext, epmContextId, result);
          if (imported) {
            result.imported++;
            this.showProgress();
          } else {
            result.skipped++;
            this.showSkipped();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const backwardCompat = `mwnf3:objects:${group.project_id}:${group.country}:${group.museum_id}:${group.number}`;
          result.errors.push(`${backwardCompat}: ${message}`);
          this.logError(`Object ${backwardCompat}`, message);
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
      result.errors.push(`Failed to query objects: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async importObject(
    group: ObjectGroup,
    hasEpmContext: boolean,
    epmContextId: string | null,
    result: ImportResult
  ): Promise<boolean> {
    const defaultLanguageId = await this.getDefaultLanguageIdAsync();
    const transformed = transformObject(group, defaultLanguageId);

    // Log warning if translation in default language is missing
    for (const w of transformed.warnings) {
      this.logWarning(w);
    }

    // Check if already imported
    if (await this.entityExistsAsync(transformed.backwardCompatibility, 'item')) {
      return false;
    }

    // Collect sample
    const sampleTranslation = group.translations[0];
    if (sampleTranslation) {
      this.collectSample(
        'object',
        sampleTranslation as unknown as Record<string, unknown>,
        'success',
        undefined,
        mapLanguageCode(sampleTranslation.lang)
      );
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import object: ${group.project_id}:${group.museum_id}:${group.number}`
      );
      this.registerEntity(
        `sample-item-${group.project_id}-${group.museum_id}-${group.number}`,
        transformed.backwardCompatibility,
        'item'
      );
      return true;
    }

    // Resolve dependencies
    const contextBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'projects',
      pkValues: [group.project_id],
    });
    const contextId = await this.getEntityUuidAsync(contextBackwardCompat, 'context');
    if (!contextId) {
      throw new Error(
        `Project context not found: ${contextBackwardCompat}. Object ${transformed.backwardCompatibility} cannot be imported without its project.`
      );
    }

    // Use same backward_compatibility as context - tracker composite key handles uniqueness
    const collectionBackwardCompat = contextBackwardCompat;
    const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
    if (!collectionId) {
      throw new Error(
        `Collection not found: ${collectionBackwardCompat}. Object ${transformed.backwardCompatibility} cannot be imported without its collection.`
      );
    }

    const partnerBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'museums',
      pkValues: [group.museum_id, group.country],
    });
    const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
    if (!partnerId) {
      throw new Error(
        `Museum partner not found: ${partnerBackwardCompat}. Object ${transformed.backwardCompatibility} cannot be imported without its museum.`
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

    // Create Item
    const itemData = {
      ...transformed.data,
      collection_id: collectionId,
      partner_id: partnerId,
      project_id: projectId,
    };

    const itemId = await this.context.strategy.writeItem(itemData);
    this.registerEntity(itemId, transformed.backwardCompatibility, 'item');

    // Create translations
    const translationPlans = planTranslations(group, hasEpmContext);
    for (const plan of translationPlans) {
      try {
        const translationResult = transformObjectTranslation(
          plan.translation,
          plan.descriptionField
        );
        if (!translationResult) continue;

        // Add any warnings to result
        if (translationResult.warnings.length > 0) {
          result.warnings?.push(...translationResult.warnings);
        }

        // Resolve authors
        const authorId = translationResult.authorName
          ? await this.authorHelper.findOrCreate(translationResult.authorName)
          : null;
        const textCopyEditorId = translationResult.textCopyEditorName
          ? await this.authorHelper.findOrCreate(translationResult.textCopyEditorName)
          : null;
        const translatorId = translationResult.translatorName
          ? await this.authorHelper.findOrCreate(translationResult.translatorName)
          : null;
        const translationCopyEditorId = translationResult.translationCopyEditorName
          ? await this.authorHelper.findOrCreate(translationResult.translationCopyEditorName)
          : null;

        // Determine context for translation
        const translationContextId = plan.contextType === 'epm' ? epmContextId! : contextId;

        await this.context.strategy.writeItemTranslation({
          ...translationResult.data,
          item_id: itemId,
          context_id: translationContextId,
          author_id: authorId,
          text_copy_editor_id: textCopyEditorId,
          translator_id: translatorId,
          translation_copy_editor_id: translationCopyEditorId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const warning = `Failed to create translation: ${message}`;
        this.logWarning(warning);
        result.warnings.push(warning);
      }
    }

    // Create tags from all translations (tags are language-scoped)
    const allTagIds: string[] = [];
    for (const translation of group.translations) {
      const extractedTags = extractObjectTags(translation);

      for (const material of extractedTags.materials) {
        const tagId = await this.tagHelper.findOrCreate(
          material,
          'material',
          extractedTags.languageId
        );
        if (tagId) allTagIds.push(tagId);
      }

      // Dynasty tags no longer extracted here — structured item_dynasty links
      // are created by DynastyImporter from objects_dynasties/monuments_dynasties tables

      for (const keyword of extractedTags.keywords) {
        const tagId = await this.tagHelper.findOrCreate(
          keyword,
          'keyword',
          extractedTags.languageId
        );
        if (tagId) allTagIds.push(tagId);
      }
    }

    if (allTagIds.length > 0) {
      await this.tagHelper.attachToItem(itemId, allTagIds);
    }

    // The item's home is items.collection_id; no collection_item row repeats
    // it on the project's root collection (M16 J3, #2710).

    // Attach partner to collection (gracefully handles duplicates)
    await this.context.strategy.attachPartnersToCollection(collectionId, [partnerId], 'project');

    return true;
  }
}
