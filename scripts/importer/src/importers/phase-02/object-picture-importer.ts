/**
 * Object Picture Importer
 *
 * Imports pictures from mwnf3.objects_pictures.
 *
 * Strategy:
 * - First image (type='' AND lowest image_number) → Attach to parent Item as ItemImage
 * - ALL images (including first) → Create child Item (type="picture") with attached ItemImage
 *
 * Each picture Item gets:
 * - ItemTranslations for each language row (caption → name, copyright → extra)
 * - Artist relationships (photographer → Artist)
 * - Legacy type stored in Item.extra if not empty
 */

import { BaseImporter } from '../../core/base-importer.js';
import type {
  ImportResult,
  ItemData,
  ItemTranslationData,
  ItemImageData,
} from '../../core/types.js';
import type { LegacyObjectPicture } from '../../domain/types/index.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { mapLanguageCode, mapCountryCode } from '../../utils/code-mappings.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { pickImageCopyright } from '../../utils/image-copyright.js';
import { TagHelper } from '../../helpers/tag-helper.js';
import path from 'path';

/**
 * Legacy partners that wrote an art-historical description of the image into
 * `objects_pictures.caption` instead of the short label the column normally
 * holds. Their caption belongs solely in the picture translation's
 * `description` — an unbounded, per-language column — and must never be reused
 * as `alt_text`, which is a short alternative-text label.
 *
 * Keyed by project, country and museum: `museum_id` alone is ambiguous, the
 * same id is reused by unrelated institutions in different countries.
 */
const PARTNERS_WHOSE_CAPTIONS_ARE_DESCRIPTIONS: ReadonlySet<string> = new Set(['epm:at:mus24']);

interface PictureGroup {
  project_id: string;
  country: string;
  museum_id: string;
  number: number;
  type: string;
  image_number: number;
  path: string;
  translations: LegacyObjectPicture[];
}

export class ObjectPictureImporter extends BaseImporter {
  private tagHelper!: TagHelper;

  getName(): string {
    return 'ObjectPictureImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    // Initialize helper
    this.tagHelper = new TagHelper(
      this.context.strategy,
      this.context.tracker,
      this.context.logger
    );

    try {
      this.logInfo('Importing object pictures...');

      // Query all pictures ordered by type (empty first) then image_number
      const pictures = await this.context.legacyDb.query<LegacyObjectPicture>(
        `SELECT * FROM mwnf3.objects_pictures 
         ORDER BY project_id, country, museum_id, number, 
                  CASE WHEN type = '' THEN 0 ELSE 1 END, 
                  image_number`
      );

      if (pictures.length === 0) {
        this.logInfo('No object pictures found');
        return result;
      }

      // Group by PK excluding lang and type
      const groups = this.groupPictures(pictures);
      this.logInfo(`Found ${groups.length} unique pictures (${pictures.length} language rows)`);

      // Import each picture group
      for (const group of groups) {
        try {
          const imported = await this.importPicture(group, result);
          if (imported) {
            result.imported++;
            this.showProgress();
          } else {
            result.skipped++;
            this.showSkipped();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const backwardCompat = this.getPictureBackwardCompatibility(group);
          result.errors.push(`${backwardCompat}: ${message}`);
          this.logError(`Picture ${backwardCompat}`, message);
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
      result.errors.push(`Failed to query object pictures: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private groupPictures(pictures: LegacyObjectPicture[]): PictureGroup[] {
    const groups = new Map<string, PictureGroup>();

    for (const pic of pictures) {
      const key = `${pic.project_id}:${pic.country}:${pic.museum_id}:${pic.number}:${pic.type}:${pic.image_number}`;

      if (!groups.has(key)) {
        groups.set(key, {
          project_id: pic.project_id,
          country: pic.country,
          museum_id: pic.museum_id,
          number: pic.number,
          type: pic.type,
          image_number: pic.image_number,
          path: pic.path,
          translations: [],
        });
      }

      groups.get(key)!.translations.push(pic);
    }

    return Array.from(groups.values());
  }

  private getPictureBackwardCompatibility(group: PictureGroup): string {
    // `type` is only appended when non-empty, so the identity of default-type
    // pictures is unchanged (matches MonumentPictureImporter's fix — see
    // Epic 10 in the islamicart parity backlog). Without this, a typed
    // picture sharing the same image_number as the default photo would
    // collide with it and be silently skipped as a duplicate.
    const pkValues: (string | number)[] = [
      group.project_id,
      group.country,
      group.museum_id,
      group.number,
      group.image_number,
    ];
    if (group.type && group.type.trim() !== '') {
      pkValues.push(group.type);
    }
    return formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'objects_pictures',
      pkValues,
    });
  }

  private async importPicture(group: PictureGroup, result: ImportResult): Promise<boolean> {
    const backwardCompat = this.getPictureBackwardCompatibility(group);
    const imageKey = group.path.toLowerCase();

    // Check if this picture (its own Item, plus the ItemImage(s) it owns)
    // was already imported. We gate on the picture Item's own
    // backward_compatibility rather than the image path: item_images has no
    // backward_compatibility column, so entityExistsAsync(imageKey, 'image')
    // can only ever consult the in-memory tracker — it can never detect an
    // already-imported picture from a previous process run. `items` does
    // have a working backward_compatibility column, so this check survives
    // process restarts and lets a rerun (without wiping the DB) cleanly skip
    // already-imported pictures instead of erroring on a duplicate key.
    if (await this.entityExistsAsync(backwardCompat, 'item')) {
      return false;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import picture: ${backwardCompat}`
      );
      this.registerEntity(`sample-image-${backwardCompat}`, imageKey, 'image');
      return true;
    }

    // Find parent Item
    const parentBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'objects',
      pkValues: [group.project_id, group.country, group.museum_id, group.number],
    });
    const parentItemId = await this.getEntityUuidAsync(parentBackwardCompat, 'item');
    if (!parentItemId) {
      throw new Error(`Parent item not found: ${parentBackwardCompat}`);
    }

    // Compute caption text
    const defaultLangId = this.context.tracker.getMetadata('default_language_id');
    const bestCaption = this.pickBestCaption(
      group.translations.map((t) => ({ lang: t.lang, caption: t.caption })),
      defaultLangId
    );
    const captionText = bestCaption ? convertHtmlToMarkdown(bestCaption) : null;

    // Where the caption is really a description, leave `alt_text` empty rather
    // than restating prose the translation's `description` already carries in
    // every language.
    const altText = this.captionIsDescription(group) ? null : captionText;

    // The image rows carry one burn-ready copyright; each language's own text
    // still goes to its picture translation's extra.copyright below.
    const copyright = pickImageCopyright(
      group.translations.map((t) => ({ lang: t.lang, copyright: t.copyright }))
    );

    // Determine if this is the first image
    const isFirstImage = group.type === '' && group.image_number === 1;

    // Calculate display_order for this parent item (increment sequence per parent)
    const parentDisplayOrders = this.context.tracker.getMetadata(`display_order:${parentItemId}`);
    const currentDisplayOrder = parentDisplayOrders ? parseInt(parentDisplayOrders, 10) + 1 : 1;
    this.context.tracker.setMetadata(`display_order:${parentItemId}`, String(currentDisplayOrder));

    // Extract metadata
    const mimeType = this.getMimeType(group.path);
    const originalName = path.basename(group.path);

    // Create child Item (type="picture")
    const pictureItemId = await this.createPictureItem(group, parentItemId, result);

    // Create ItemImage for child Item (use currentDisplayOrder for proper sequencing)
    const itemImageData: ItemImageData = {
      item_id: pictureItemId,
      path: group.path,
      original_name: originalName,
      mime_type: mimeType,
      size: 1, // Fake size as required
      alt_text: altText,
      copyright,
      display_order: currentDisplayOrder,
    };
    await this.context.strategy.writeItemImage(itemImageData);

    // If this is the first image, also attach to parent
    if (isFirstImage) {
      const parentImageData: ItemImageData = {
        item_id: parentItemId,
        path: group.path,
        original_name: originalName,
        mime_type: mimeType,
        size: 1,
        alt_text: altText,
        copyright,
        display_order: currentDisplayOrder,
      };
      await this.context.strategy.writeItemImage(parentImageData);
    }

    // Register in tracker using lowercase path (images tracked by path, Items by backward_compatibility)
    this.registerEntity(pictureItemId, backwardCompat, 'item');

    return true;
  }

  private async createPictureItem(
    group: PictureGroup,
    parentItemId: string,
    result: ImportResult
  ): Promise<string> {
    // Get parent item's collection and context
    const contextBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'projects',
      pkValues: [group.project_id],
    });
    const contextId = await this.getEntityUuidAsync(contextBackwardCompat, 'context');
    if (!contextId) {
      throw new Error(`Context not found: ${contextBackwardCompat}`);
    }

    const collectionId = await this.getEntityUuidAsync(contextBackwardCompat, 'collection');
    if (!collectionId) {
      throw new Error(`Collection not found: ${contextBackwardCompat}`);
    }

    const partnerBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'museums',
      pkValues: [group.museum_id, group.country],
    });
    const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
    if (!partnerId) {
      throw new Error(`Partner not found: ${partnerBackwardCompat}`);
    }

    // Get project_id using same backward_compatibility as context
    const projectId = await this.getEntityUuidAsync(contextBackwardCompat, 'project');
    if (!projectId) {
      this.logWarning(
        `Project not found: ${contextBackwardCompat} for picture ${group.project_id}:${group.museum_id}:${group.number}:${group.image_number}, importing without project`
      );
    }

    // Map country code from legacy 2-char to ISO 3-char
    const countryId = mapCountryCode(group.country);

    // Build extra with legacy type if not empty
    const extra: Record<string, unknown> = {};
    if (group.type && group.type.trim() !== '') {
      extra.legacy_type = group.type;
    }

    // Create Item
    const itemData: ItemData = {
      type: 'picture',
      internal_name: `Picture ${group.image_number} for ${group.project_id}:${group.museum_id}:${group.number}`,
      collection_id: collectionId,
      partner_id: partnerId,
      parent_id: parentItemId,
      country_id: countryId,
      project_id: projectId,
      owner_reference: null,
      mwnf_reference: null,
      display_order: group.image_number,
      backward_compatibility: this.getPictureBackwardCompatibility(group),
    };

    const pictureItemId = await this.context.strategy.writeItem(itemData);

    // Create translations for each language
    for (const translation of group.translations) {
      try {
        await this.createPictureTranslation(translation, pictureItemId, contextId, extra);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const translationBC = formatBackwardCompatibility({
          schema: 'mwnf3',
          table: 'objects_pictures',
          pkValues: [
            translation.project_id,
            translation.country,
            translation.museum_id,
            String(translation.number),
            translation.type,
            String(translation.image_number),
            translation.lang,
          ],
        });
        this.logWarning(`Failed to create translation ${translationBC}: ${message}`);
        result.warnings.push(`Failed to create translation ${translationBC}: ${message}`);
      }
    }

    if (group.type) {
      const defaultLangId = this.context.tracker.getMetadata('default_language_id');
      const tagIds = await this.tagHelper.findOrCreateList(
        group.type,
        'image-type',
        defaultLangId ?? 'eng'
      );
      if (tagIds.length > 0) {
        await this.tagHelper.attachToItem(pictureItemId, tagIds);
      }
    }

    return pictureItemId;
  }

  private async createPictureTranslation(
    translation: LegacyObjectPicture,
    pictureItemId: string,
    contextId: string,
    itemExtra: Record<string, unknown>
  ): Promise<void> {
    const hasCaption = !!(translation.caption && translation.caption.trim());
    const hasPhotographer = !!(translation.photographer && translation.photographer.trim());
    const hasCopyright = !!(translation.copyright && translation.copyright.trim());

    // Skip translation rows that carry no text or metadata content.
    if (!hasCaption && !hasPhotographer && !hasCopyright) {
      return;
    }

    const languageId = mapLanguageCode(translation.lang);

    // `name` is always a short label derived from the parent object's title —
    // never the caption, which is long-form HTML and belongs in `description`
    // (an unbounded text column) rather than the 255-char `name` column.
    const parentName = await this.getCachedParentItemName(
      translation.project_id,
      translation.country,
      translation.museum_id,
      translation.number,
      translation.lang
    );
    const parentTitle = parentName ? convertHtmlToMarkdown(parentName) : null;
    let name = parentTitle
      ? translation.image_number != null
        ? `${parentTitle} (${translation.image_number})`
        : parentTitle
      : `Picture ${translation.image_number}`;

    const MAX_NAME_LENGTH = 255;
    if (name.length > MAX_NAME_LENGTH) {
      this.logWarning(
        `objects_pictures translation name truncated (${name.length} → ${MAX_NAME_LENGTH} chars) for image ${translation.image_number} lang ${translation.lang}`
      );
      name = name.substring(0, MAX_NAME_LENGTH);
    }

    const description = hasCaption ? convertHtmlToMarkdown(translation.caption!) : '';

    // Build extra with copyright if present
    const translationExtra: Record<string, unknown> = { ...itemExtra };
    if (hasPhotographer) {
      translationExtra.photographer = convertHtmlToMarkdown(translation.photographer ?? '');
    }
    if (hasCopyright) {
      translationExtra.copyright = translation.copyright!;
    }

    const translationData: ItemTranslationData = {
      item_id: pictureItemId,
      language_id: languageId,
      context_id: contextId,
      name,
      description,
      alternate_name: null,
      type: null,
      holder: null,
      owner: null,
      initial_owner: null,
      dates: null,
      location: null,
      dimensions: null,
      place_of_production: null,
      method_for_datation: null,
      method_for_provenance: null,
      obtention: null,
      bibliography: null,
      author_id: null,
      text_copy_editor_id: null,
      translator_id: null,
      translation_copy_editor_id: null,
      extra: Object.keys(translationExtra).length > 0 ? JSON.stringify(translationExtra) : null,
      backward_compatibility: this.getPictureBackwardCompatibility({
        project_id: translation.project_id,
        country: translation.country,
        museum_id: translation.museum_id,
        number: translation.number,
        type: translation.type,
        image_number: translation.image_number,
        path: translation.path,
        translations: [],
      }),
    };

    await this.context.strategy.writeItemTranslation(translationData);
  }

  private parentNameCache = new Map<string, string | null>();

  private async getCachedParentItemName(
    projectId: string,
    country: string,
    museumId: string,
    number: number,
    lang: string
  ): Promise<string | null> {
    const key = `${projectId}:${country}:${museumId}:${number}:${lang}`;
    if (!this.parentNameCache.has(key)) {
      this.parentNameCache.set(
        key,
        await this.getParentItemName(projectId, country, museumId, number, lang)
      );
    }
    return this.parentNameCache.get(key)!;
  }

  private async getParentItemName(
    projectId: string,
    country: string,
    museumId: string,
    number: number,
    lang: string
  ): Promise<string | null> {
    const result = await this.context.legacyDb.query<{ name: string }>(
      'SELECT name FROM mwnf3.objects WHERE project_id = ? AND country = ? AND museum_id = ? AND number = ? AND lang = ?',
      [projectId, country, museumId, number, lang]
    );
    return result.length > 0 ? result[0]!.name : null;
  }

  private captionIsDescription(group: PictureGroup): boolean {
    const partner = `${group.project_id}:${group.country}:${group.museum_id}`.toLowerCase();
    return PARTNERS_WHOSE_CAPTIONS_ARE_DESCRIPTIONS.has(partner);
  }

  private pickBestCaption(
    translations: Array<{ lang: string; caption: string | null | undefined }>,
    defaultLangId: string | null
  ): string | null {
    if (translations.length === 0) return null;
    const defaultLang = defaultLangId ? defaultLangId.slice(0, 2).toLowerCase() : 'en';
    const found =
      translations.find((t) => t.lang === defaultLang && t.caption) ??
      translations.find((t) => t.caption);
    return found?.caption ?? null;
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    return mimeTypes[ext] || 'image/jpeg';
  }
}
