/**
 * Travels Monument Picture Importer
 *
 * Imports pictures from mwnf3_travels.tr_monuments_pictures.
 * Creates a child Item(type='picture') for each picture, with ItemImage
 * attached to the child. If it is the first image for the parent monument,
 * also attaches an ItemImage to the parent monument item.
 *
 * Legacy schema:
 * - mwnf3_travels.tr_monuments_pictures (country, project_id, lang, itinerary_id, location_id, number, trail_id, image_number, path, thumb, caption, photographer, copyright, lastupdate, type)
 *   - PK: (lang, project_id, country, trail_id, itinerary_id, location_id, number, image_number, type)
 *   - Type: usually empty string
 *
 * Dependencies:
 * - TravelsMonumentImporter (must run first to create monument items)
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

/**
 * Legacy monument picture structure
 */
interface LegacyMonumentPicture {
  country: string;
  project_id: string;
  lang: string;
  itinerary_id: string;
  location_id: string;
  number: string; // monument number
  trail_id: number;
  image_number: number;
  path: string;
  thumb: string | null;
  caption: string;
  photographer: string;
  copyright: string;
  lastupdate: string | null;
  type: string;
}

/**
 * Grouped picture (unique by non-lang keys)
 */
interface PictureGroup {
  project_id: string;
  country: string;
  trail_id: number;
  itinerary_id: string;
  location_id: string;
  number: string;
  image_number: number;
  type: string;
  path: string;
  translations: LegacyMonumentPicture[];
}

export class TravelsMonumentPictureImporter extends BaseImporter {
  private tagHelper!: TagHelper;

  getName(): string {
    return 'TravelsMonumentPictureImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing travel monument pictures...');
      this.tagHelper = new TagHelper(
        this.context.strategy,
        this.context.tracker,
        this.context.logger
      );

      // Query all monument pictures
      const pictures = await this.context.legacyDb.query<LegacyMonumentPicture>(
        `SELECT country, project_id, lang, itinerary_id, location_id, number, trail_id, image_number, path, thumb, caption, photographer, copyright, lastupdate, type
        FROM mwnf3_travels.tr_monuments_pictures
         ORDER BY project_id, country, trail_id, itinerary_id, location_id, number, type, image_number, lang`
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
      const key = `${pic.project_id}:${pic.country}:${pic.trail_id}:${pic.itinerary_id}:${pic.location_id}:${pic.number}:${pic.type}:${pic.image_number}`;

      if (!groups.has(key)) {
        groups.set(key, {
          project_id: pic.project_id,
          country: pic.country,
          trail_id: pic.trail_id,
          itinerary_id: pic.itinerary_id,
          location_id: pic.location_id,
          number: pic.number,
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
    return `mwnf3_travels:monument_picture:${group.project_id}:${group.country}:${group.trail_id}:${group.itinerary_id}:${group.location_id}:${group.number}:${group.type || '_'}:${group.image_number}`;
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

    // Find parent monument item
    const monumentBackwardCompat = `mwnf3_travels:monument:${group.project_id}:${group.country}:${group.trail_id}:${group.itinerary_id}:${group.location_id}:${group.number}`;
    const parentItemId = await this.getEntityUuidAsync(monumentBackwardCompat, 'item');
    if (!parentItemId) {
      throw new Error(`Parent monument item not found: ${monumentBackwardCompat}`);
    }

    // Collect sample
    this.collectSample(
      'monument_picture',
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
    const displayOrderKey = `monument_picture_order:${parentItemId}`;
    const currentOrder = this.context.tracker.getMetadata(displayOrderKey);
    const currentDisplayOrder = currentOrder ? parseInt(currentOrder, 10) + 1 : 1;
    this.context.tracker.setMetadata(displayOrderKey, String(currentDisplayOrder));

    // Compute caption text
    const defaultLangId = this.context.tracker.getMetadata('default_language_id');
    const bestCaption = this.pickBestCaption(
      group.translations.map((t) => ({ lang: t.lang, caption: t.caption || null })),
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
      : `Picture ${group.image_number}`;

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
    const description = hasCaption ? convertHtmlToMarkdown(translation.caption) : '';

    const translationExtra: Record<string, unknown> = { ...itemExtra };
    if (hasPhotographer) {
      translationExtra.photographer = convertHtmlToMarkdown(translation.photographer);
    }
    if (hasCopyright) {
      translationExtra.copyright = translation.copyright;
    }

    const translationData: ItemTranslationData = {
      item_id: pictureItemId,
      language_id: languageId,
      context_id: contextId,
      backward_compatibility: `mwnf3_travels:monument_picture:${translation.project_id}:${translation.country}:${translation.trail_id}:${translation.itinerary_id}:${translation.location_id}:${translation.number}:${translation.type || '_'}:${translation.image_number}:${translation.lang}`,
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
