/**
 * Explore Monument Picture Importer
 *
 * Imports pictures from mwnf3_explore.exploremonument_pictures.
 * Creates a child Item(type='picture') for each picture, with ItemImage
 * attached to the child. If it is the first image for the parent monument,
 * also attaches an ItemImage to the parent monument item.
 *
 * Legacy schema:
 * - mwnf3_explore.exploremonument_pictures (monumentId, lang, image_number, path, thumb, caption, photographer, copyright, lastupdate, type)
 *   - PK: (monumentId, lang, type, image_number)
 *
 * Dependencies:
 * - ExploreMonumentImporter (must run first to create monument items)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type {
  ImportResult,
  ItemData,
  ItemTranslationData,
  ItemImageData,
} from '../../core/types.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { pickImageCopyright } from '../../utils/image-copyright.js';
import { mapLanguageCode } from '../../utils/code-mappings.js';
import { TagHelper } from '../../helpers/tag-helper.js';
import path from 'path';
import { ExploreMonumentResolver } from './explore-monument-resolver.js';

/**
 * Legacy monument picture structure
 */
interface LegacyMonumentPicture {
  monumentId: number;
  lang: string;
  image_number: number;
  path: string;
  thumb: string | null;
  caption: string | null;
  photographer: string | null;
  copyright: string | null;
  lastupdate: string | null;
  type: string;
}

/**
 * Grouped picture (unique by non-lang keys)
 */
interface PictureGroup {
  monumentId: number;
  image_number: number;
  type: string;
  path: string;
  translations: LegacyMonumentPicture[];
}

export class ExploreMonumentPictureImporter extends BaseImporter {
  private monumentResolver!: ExploreMonumentResolver;
  private tagHelper!: TagHelper;

  getName(): string {
    return 'ExploreMonumentPictureImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing explore monument pictures...');
      this.monumentResolver = new ExploreMonumentResolver({
        legacyDb: this.context.legacyDb,
        tracker: this.context.tracker,
        getEntityUuid: (backwardCompatibility, entityType) =>
          this.getEntityUuidAsync(backwardCompatibility, entityType),
      });
      this.tagHelper = new TagHelper(
        this.context.strategy,
        this.context.tracker,
        this.context.logger
      );

      // Query all monument pictures
      const pictures = await this.context.legacyDb.query<LegacyMonumentPicture>(
        `SELECT monumentId, lang, image_number, path, thumb, caption, photographer, copyright, lastupdate, type
         FROM mwnf3_explore.exploremonument_pictures
         ORDER BY monumentId, type, image_number, lang`
      );

      if (pictures.length === 0) {
        this.logInfo('No monument pictures found');
        return result;
      }

      // Group pictures by non-lang keys
      const groups = this.groupPictures(pictures);
      this.logInfo(`Found ${groups.length} unique pictures (${pictures.length} language rows)`);

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
          const backwardCompat = this.getBackwardCompatibility(group);
          result.errors.push(`${backwardCompat}: ${message}`);
          this.logError(`Monument Picture ${backwardCompat}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to query monument pictures: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private groupPictures(pictures: LegacyMonumentPicture[]): PictureGroup[] {
    const groups = new Map<string, PictureGroup>();

    for (const pic of pictures) {
      const key = `${pic.monumentId}:${pic.type || '_'}:${pic.image_number}`;

      if (!groups.has(key)) {
        groups.set(key, {
          monumentId: pic.monumentId,
          image_number: pic.image_number,
          type: pic.type,
          path: pic.path,
          translations: [],
        });
      }

      groups.get(key)!.translations.push(pic);
    }

    return Array.from(groups.values());
  }

  private getBackwardCompatibility(group: PictureGroup): string {
    return `mwnf3_explore:monument_picture:${group.monumentId}:${group.type || '_'}:${group.image_number}`;
  }

  private async importPicture(group: PictureGroup, result: ImportResult): Promise<boolean> {
    const backwardCompat = this.getBackwardCompatibility(group);
    const imageKey = group.path.toLowerCase();

    // Check if this picture (its own Item, plus the ItemImage(s) it owns)
    // was already imported. Gate on the picture Item's own
    // backward_compatibility rather than the image path: item_images has no
    // backward_compatibility column, so entityExistsAsync(imageKey, 'image')
    // can only ever consult the in-memory tracker and never detects an
    // already-imported picture from a previous process run.
    if (await this.entityExistsAsync(backwardCompat, 'item')) {
      return false;
    }

    // Find parent monument item.
    //
    // This is the one Explore call site that cannot follow the pipeline's
    // fan-out rule for ambiguous monuments: a picture is an Item, and its key
    // (mwnf3_explore:monument_picture:{monument}:{type}:{image}) carries no
    // source discriminator, so one picture per candidate parent would collide.
    // Raising is safe today — none of the 259 ambiguous monuments has a picture
    // row — and giving that case a real answer means adding a discriminator to
    // the key first, not choosing a parent here.
    const monumentResolution = await this.monumentResolver.resolve(group.monumentId);
    if (!monumentResolution.itemId || !monumentResolution.itemBackwardCompatibility) {
      throw new Error(
        monumentResolution.message ??
          `Explore monument mwnf3_explore:monument:${group.monumentId} did not resolve to an item`
      );
    }
    const parentItemId = monumentResolution.itemId;

    // Collect sample
    this.collectSample(
      'explore_monument_picture',
      group.translations[0] as unknown as Record<string, unknown>,
      'success'
    );

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import monument picture: ${backwardCompat}`
      );
      this.registerEntity(`sample-${backwardCompat}`, imageKey, 'image');
      return true;
    }

    // Tracker-based isFirstImage
    const firstImageKey = `first_image_attached:${parentItemId}`;
    const firstImageAlreadyAttached = !!this.context.tracker.getMetadata(firstImageKey);
    const isFirstImage = group.image_number === 1 && !firstImageAlreadyAttached;
    if (isFirstImage) {
      this.context.tracker.setMetadata(firstImageKey, '1');
    }

    // Calculate display_order for this parent
    const displayOrderKey = `explore_monument_picture_order:${parentItemId}`;
    const currentOrder = this.context.tracker.getMetadata(displayOrderKey);
    const currentDisplayOrder = currentOrder ? parseInt(currentOrder, 10) + 1 : 1;
    this.context.tracker.setMetadata(displayOrderKey, String(currentDisplayOrder));

    // Compute caption text
    const defaultLangId = this.context.tracker.getMetadata('default_language_id');
    const bestCaption = this.pickBestCaption(
      group.translations.map((t) => ({ lang: t.lang, caption: t.caption })),
      defaultLangId
    );
    const captionText = bestCaption ? convertHtmlToMarkdown(bestCaption) : null;

    // The image rows carry one burn-ready copyright; each language's own text
    // still goes to its picture translation's extra.copyright.
    const copyright = pickImageCopyright(
      group.translations.map((t) => ({ lang: t.lang, copyright: t.copyright }))
    );

    const mimeType = this.getMimeType(group.path);
    const originalName = path.basename(group.path);

    // Create child Item (type='picture')
    const pictureItemId = await this.createPictureItem(group, parentItemId, defaultLangId, result);

    // Create ItemImage for child Item
    const itemImageData: ItemImageData = {
      item_id: pictureItemId,
      path: group.path,
      original_name: originalName,
      mime_type: mimeType,
      size: 1,
      alt_text: captionText,
      copyright,
      display_order: currentDisplayOrder,
    };
    await this.context.strategy.writeItemImage(itemImageData);

    // If first image, also attach to parent monument
    if (isFirstImage) {
      const parentImageData: ItemImageData = {
        item_id: parentItemId,
        path: group.path,
        original_name: originalName,
        mime_type: mimeType,
        size: 1,
        alt_text: captionText,
        copyright,
        display_order: currentDisplayOrder,
      };
      await this.context.strategy.writeItemImage(parentImageData);
    }

    // Register in tracker
    this.registerEntity(pictureItemId, backwardCompat, 'item');

    return true;
  }

  private async createPictureItem(
    group: PictureGroup,
    parentItemId: string,
    defaultLangId: string | null,
    result: ImportResult
  ): Promise<string> {
    const contextId = await this.getDefaultContextIdAsync();
    const collectionId = this.context.tracker.getMetadata('default_collection_id');

    const extra: Record<string, unknown> = {};
    if (group.type && group.type.trim() !== '') {
      extra.legacy_type = group.type;
    }

    const internalName = group.translations[0]?.caption
      ? convertHtmlToMarkdown(group.translations[0].caption)
      : `Picture ${group.image_number} for monument ${group.monumentId}`;

    const itemData: ItemData = {
      type: 'picture',
      internal_name: internalName,
      collection_id: collectionId ?? null,
      partner_id: null,
      parent_id: parentItemId,
      country_id: null,
      project_id: null,
      owner_reference: null,
      mwnf_reference: null,
      display_order: group.image_number,
      backward_compatibility: this.getBackwardCompatibility(group),
    };

    const pictureItemId = await this.context.strategy.writeItem(itemData);

    for (const translation of group.translations) {
      try {
        await this.createPictureTranslation(translation, pictureItemId, contextId, extra);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const translationBC = `${this.getBackwardCompatibility(group)}:${translation.lang}`;
        this.logWarning(`Failed to create translation ${translationBC}: ${message}`);
        result.warnings.push(`Failed to create translation ${translationBC}: ${message}`);
      }
    }

    if (group.type) {
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
    translation: LegacyMonumentPicture,
    pictureItemId: string,
    contextId: string,
    itemExtra: Record<string, unknown>
  ): Promise<void> {
    const hasCaption = !!(translation.caption && translation.caption.trim());
    const hasPhotographer = !!(translation.photographer && translation.photographer.trim());
    const hasCopyright = !!(translation.copyright && translation.copyright.trim());

    if (!hasCaption && !hasPhotographer && !hasCopyright) {
      return;
    }

    const languageId = mapLanguageCode(translation.lang);

    // `name` is always a short label; the caption (long-form HTML) belongs in
    // `description` rather than the 255-char `name` column.
    const name = `Picture ${translation.image_number}`;
    const description = hasCaption ? convertHtmlToMarkdown(translation.caption ?? '') : '';

    const translationExtra: Record<string, unknown> = { ...itemExtra };
    if (hasPhotographer) {
      translationExtra.photographer = convertHtmlToMarkdown(translation.photographer ?? '');
    }
    if (hasCopyright) {
      translationExtra.copyright = translation.copyright ?? '';
    }

    const translationData: ItemTranslationData = {
      item_id: pictureItemId,
      language_id: languageId,
      context_id: contextId,
      backward_compatibility: `${this.getBackwardCompatibility({ monumentId: translation.monumentId, image_number: translation.image_number, type: translation.type, path: translation.path, translations: [] })}:${translation.lang}`,
      name,
      description,
      alternate_name: null,
      type: null,
      holder: null,
      owner: null,
      initial_owner: null,
      dates: null,
      location: null,
      bibliography: null,
      extra: Object.keys(translationExtra).length > 0 ? JSON.stringify(translationExtra) : null,
    };

    await this.context.strategy.writeItemTranslation(translationData);
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
