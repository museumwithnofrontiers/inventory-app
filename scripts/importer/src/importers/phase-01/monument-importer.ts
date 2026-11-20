/**
 * Monument Importer
 *
 * Imports monuments (items) from legacy database.
 * Similar to ObjectImporter but for monuments.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  groupMonumentsByPK,
  transformMonument,
  transformMonumentTranslation,
  extractMonumentTags,
  planMonumentTranslations,
} from '../../domain/transformers/index.js';
import type { LegacyMonument, MonumentGroup } from '../../domain/types/index.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { mapLanguageCode } from '../../utils/code-mappings.js';
import { sanitizeJsonField } from '../../utils/html-to-markdown.js';
import { jsonValuesEqual } from '../../utils/json-equal.js';
import { TagHelper } from '../../helpers/tag-helper.js';
import { AuthorHelper } from '../../helpers/author-helper.js';

export class MonumentImporter extends BaseImporter {
  private tagHelper!: TagHelper;
  private authorHelper!: AuthorHelper;

  getName(): string {
    return 'MonumentImporter';
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
      this.logInfo('Importing monuments...');

      // Query all monuments (denormalized - multiple rows per monument)
      const monuments = await this.context.legacyDb.query<LegacyMonument>(
        'SELECT * FROM mwnf3.monuments ORDER BY project_id, country, institution_id, number'
      );

      if (monuments.length === 0) {
        this.logInfo('No monuments found');
        return result;
      }

      // Group monuments by non-lang PK columns
      const monumentGroups = groupMonumentsByPK(monuments);
      this.logInfo(
        `Found ${monumentGroups.length} unique monuments (${monuments.length} language rows)`
      );

      // Check if EPM context exists
      const epmContextBackwardCompat = formatBackwardCompatibility({
        schema: 'mwnf3',
        table: 'projects',
        pkValues: ['EPM'],
      });
      const epmContextId = await this.getEntityUuidAsync(epmContextBackwardCompat, 'context');
      const hasEpmContext = !!epmContextId;

      // Import each monument group
      for (const group of monumentGroups) {
        try {
          const imported = await this.importMonument(group, hasEpmContext, epmContextId, result);
          if (imported) {
            result.imported++;
            this.showProgress();
          } else {
            result.skipped++;
            this.showSkipped();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const backwardCompat = `mwnf3:monuments:${group.project_id}:${group.country}:${group.institution_id}:${group.number}`;
          result.errors.push(`${backwardCompat}: ${message}`);
          this.logError(`Monument ${backwardCompat}`, message);
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
      result.errors.push(`Failed to query monuments: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async importMonument(
    group: MonumentGroup,
    hasEpmContext: boolean,
    epmContextId: string | null,
    result: ImportResult
  ): Promise<boolean> {
    const defaultLanguageId = await this.getDefaultLanguageIdAsync();
    const transformed = transformMonument(group, defaultLanguageId);

    // Log warning if translation in default language is missing
    if (transformed.warning) {
      this.logWarning(transformed.warning);
    }

    // Check if already imported. The item itself is never recreated — but its
    // translations' extra is still refreshed below: writeItemTranslation is a
    // plain INSERT with no upsert, so a re-run could never otherwise revisit
    // a row already written, even one whose extra still held legacy HTML that
    // the conversion pipeline has since learned to handle.
    const existingItemId = await this.getEntityUuidAsync(
      transformed.backwardCompatibility,
      'item'
    );
    if (existingItemId) {
      if (this.isDryRun || this.isSampleOnlyMode) {
        return false;
      }
      return this.refreshExistingMonumentTranslations(
        group,
        hasEpmContext,
        epmContextId,
        existingItemId
      );
    }

    // Collect sample
    const sampleTranslation = group.translations[0];
    if (sampleTranslation) {
      this.collectSample(
        'monument',
        sampleTranslation as unknown as Record<string, unknown>,
        'success',
        undefined,
        mapLanguageCode(sampleTranslation.lang)
      );
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import monument: ${group.project_id}:${group.institution_id}:${group.number}`
      );
      this.registerEntity(
        `sample-item-${group.project_id}-${group.institution_id}-${group.number}`,
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
        `Project context not found: ${contextBackwardCompat}. Monument ${transformed.backwardCompatibility} cannot be imported without its project.`
      );
    }

    // Use same backward_compatibility as context - tracker composite key handles uniqueness
    const collectionBackwardCompat = contextBackwardCompat;
    const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
    if (!collectionId) {
      throw new Error(
        `Collection not found: ${collectionBackwardCompat}. Monument ${transformed.backwardCompatibility} cannot be imported without its collection.`
      );
    }

    const partnerBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'institutions',
      pkValues: [group.institution_id, group.country],
    });
    const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
    if (!partnerId) {
      throw new Error(
        `Institution partner not found: ${partnerBackwardCompat}. Monument ${transformed.backwardCompatibility} cannot be imported without its institution.`
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
    const translationPlans = planMonumentTranslations(group, hasEpmContext);
    for (const plan of translationPlans) {
      try {
        // Cast to LegacyMonument since planMonumentTranslations works with the type
        const translation = plan.translation as unknown as LegacyMonument;
        const translationResult = transformMonumentTranslation(translation, plan.descriptionField);
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
      const extractedTags = extractMonumentTags(translation);

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

  /**
   * An already-imported monument's translations, refreshed in place — the
   * item, its tags and its collection/partner attachments are left alone.
   * Only `extra` can change here: name/description/bibliography/etc. are
   * columns transformMonumentTranslation already produces from the same
   * `convertHtmlToMarkdown` pipeline used for a first-time write, so a
   * second run has nothing new to say about them; `extra` is a single JSON
   * blob assembled from several legacy fields and is exactly what an earlier
   * version of this importer, or an earlier version of the sanitiser, could
   * have gotten wrong.
   *
   * Scoped by context (own vs EPM), not just item + language: a monument
   * can carry both in the same language, and the unscoped
   * setItemTranslationExtra would silently overwrite one context's row with
   * the other's content.
   *
   * setItemTranslationExtraByContext sanitises its own `extra` argument —
   * every set*Extra* strategy method does, as a safety net for callers that
   * don't. wouldBeExtra sanitises too, but only to know what the write will
   * actually persist, so it can be compared against what's already there;
   * the *unsanitised* JSON is what gets passed to the write itself. Sanitising
   * before the call as well double-converts on every write — invisible for
   * a plain flag, but progressively mangles prose containing `[`, `_` or
   * `<br/>` a little further each run, and neither wouldBeExtra nor the
   * database ever converges, since wouldBeExtra is always the single-pass
   * value and what got stored was always one pass ahead of it.
   */
  private async refreshExistingMonumentTranslations(
    group: MonumentGroup,
    hasEpmContext: boolean,
    epmContextId: string | null,
    itemId: string
  ): Promise<boolean> {
    const contextBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'projects',
      pkValues: [group.project_id],
    });
    const contextId = await this.getEntityUuidAsync(contextBackwardCompat, 'context');
    if (!contextId) {
      return false;
    }

    let changed = false;
    const translationPlans = planMonumentTranslations(group, hasEpmContext);
    for (const plan of translationPlans) {
      const translation = plan.translation as unknown as LegacyMonument;
      const translationResult = transformMonumentTranslation(translation, plan.descriptionField);
      if (!translationResult) continue;

      const languageId = translationResult.data.language_id;
      const translationContextId = plan.contextType === 'epm' ? epmContextId! : contextId;

      const rawExtra = translationResult.data.extra ?? '{}';
      const wouldBeExtra = sanitizeJsonField(JSON.parse(rawExtra) as Record<string, unknown>);
      const existingExtra =
        (await this.context.strategy.getItemTranslationExtraByContext(
          itemId,
          languageId,
          translationContextId
        )) ?? {};

      if (jsonValuesEqual(existingExtra, wouldBeExtra)) continue;

      await this.context.strategy.setItemTranslationExtraByContext(
        itemId,
        languageId,
        translationContextId,
        rawExtra
      );
      changed = true;
    }

    return changed;
  }
}
