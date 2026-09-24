/**
 * SH Monument Picture Importer
 *
 * Imports pictures from mwnf3_sharing_history.sh_monument_images.
 *
 * Strategy:
 * - First image (type='' AND lowest image_number) → Attach to parent Item as ItemImage
 * - ALL images (including first) → Create child Item (type="picture") with attached ItemImage
 */

import { BaseImporter } from '../../core/base-importer.js';
import type {
  ImportResult,
  ItemData,
  ItemTranslationData,
  ItemImageData,
} from '../../core/types.js';
import type { ShLegacyMonumentImage, ShLegacyMonumentImageText } from '../../domain/types/index.js';
import { formatShBackwardCompatibility } from '../../domain/transformers/index.js';
import { mapCountryCode, mapLanguageCode } from '../../utils/code-mappings.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { pickImageCopyright } from '../../utils/image-copyright.js';
import { TagHelper } from '../../helpers/tag-helper.js';
import path from 'path';

interface ShPictureGroup {
  project_id: string;
  country: string;
  number: number;
  type: string;
  image_number: number;
  path: string;
  translations: ShLegacyMonumentImageText[];
}

export class ShMonumentPictureImporter extends BaseImporter {
  private tagHelper!: TagHelper;

  getName(): string {
    return 'ShMonumentPictureImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    this.tagHelper = new TagHelper(
      this.context.strategy,
      this.context.tracker,
      this.context.logger
    );

    try {
      this.logInfo('Importing Sharing History monument pictures...');

      // Query all pictures
      const pictures = await this.context.legacyDb.query<ShLegacyMonumentImage>(
        `SELECT * FROM mwnf3_sharing_history.sh_monument_images 
         ORDER BY project_id, country, number, 
                  CASE WHEN type = '' THEN 0 ELSE 1 END, 
                  image_number`
      );

      // Query picture texts
      let pictureTexts: ShLegacyMonumentImageText[] = [];
      try {
        pictureTexts = await this.context.legacyDb.query<ShLegacyMonumentImageText>(
          `SELECT * FROM mwnf3_sharing_history.sh_monument_image_texts 
           ORDER BY project_id, country, number, type, image_number, lang`
        );
      } catch {
        this.logWarning('sh_monument_image_texts table not found or empty');
      }

      if (pictures.length === 0) {
        this.logInfo('No SH monument pictures found');
        return result;
      }

      // Group by PK
      const groups = this.groupPictures(pictures, pictureTexts);
      this.logInfo(`Found ${groups.length} unique pictures`);

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
          this.logError(`SH Monument Picture ${backwardCompat}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to query SH monument pictures: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private groupPictures(
    pictures: ShLegacyMonumentImage[],
    pictureTexts: ShLegacyMonumentImageText[]
  ): ShPictureGroup[] {
    // Create text map
    const textMap = new Map<string, ShLegacyMonumentImageText[]>();
    for (const text of pictureTexts) {
      const key = `${text.project_id}:${text.country}:${text.number}:${text.type}:${text.image_number}`;
      if (!textMap.has(key)) {
        textMap.set(key, []);
      }
      textMap.get(key)!.push(text);
    }

    // Group pictures with their texts
    return pictures.map((pic) => {
      const key = `${pic.project_id}:${pic.country}:${pic.number}:${pic.type}:${pic.image_number}`;
      return {
        project_id: pic.project_id,
        country: pic.country,
        number: pic.number,
        type: pic.type,
        image_number: pic.image_number,
        path: pic.path,
        translations: textMap.get(key) || [],
      };
    });
  }

  private getPictureBackwardCompatibility(group: ShPictureGroup): string {
    return formatShBackwardCompatibility(
      'sh_monument_images',
      group.project_id,
      group.country,
      group.number,
      group.type || '_',
      group.image_number
    );
  }

  private async importPicture(group: ShPictureGroup, _result: ImportResult): Promise<boolean> {
    const backwardCompat = this.getPictureBackwardCompatibility(group);
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

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import SH monument picture: ${backwardCompat}`
      );
      this.registerEntity(`sample-image-sh-mon-${backwardCompat}`, imageKey, 'image');
      return true;
    }

    // Find parent Item
    const parentBackwardCompat = formatShBackwardCompatibility(
      'sh_monuments',
      group.project_id,
      group.country,
      group.number
    );
    const parentItemId = await this.getEntityUuidAsync(parentBackwardCompat, 'item');
    if (!parentItemId) {
      throw new Error(`Parent SH monument not found: ${parentBackwardCompat}`);
    }

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

    // Determine if first image
    const isFirstImage = group.type === '' && group.image_number === 1;

    // Calculate display_order
    const parentDisplayOrders = this.context.tracker.getMetadata(`display_order:${parentItemId}`);
    const currentDisplayOrder = parentDisplayOrders ? parseInt(parentDisplayOrders, 10) + 1 : 1;
    this.context.tracker.setMetadata(`display_order:${parentItemId}`, String(currentDisplayOrder));

    // Extract metadata
    const mimeType = this.getMimeType(group.path);
    const originalName = path.basename(group.path);

    // Create child Item
    const pictureItemId = await this.createPictureItem(group, parentItemId);

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

    // If first image, also attach to parent
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

  private async createPictureItem(group: ShPictureGroup, parentItemId: string): Promise<string> {
    // Get SH project context and collection
    const contextBackwardCompat = formatShBackwardCompatibility('sh_projects', group.project_id);
    const contextId = await this.getEntityUuidAsync(contextBackwardCompat, 'context');
    if (!contextId) {
      throw new Error(`SH Context not found: ${contextBackwardCompat}`);
    }

    const collectionId = await this.getEntityUuidAsync(contextBackwardCompat, 'collection');
    if (!collectionId) {
      throw new Error(`SH Collection not found: ${contextBackwardCompat}`);
    }

    const projectId = await this.getEntityUuidAsync(contextBackwardCompat, 'project');
    if (!projectId) {
      this.logWarning(
        `Project not found: ${contextBackwardCompat} for monument picture ${group.image_number}, importing without project`
      );
    }

    // Build internal name
    const internalName = group.translations[0]?.caption
      ? convertHtmlToMarkdown(group.translations[0].caption)
      : `Picture ${group.image_number}`;

    // Build extra
    const extra: Record<string, unknown> = {};
    if (group.type && group.type.trim() !== '') {
      extra.legacy_type = group.type;
    }

    // Create picture Item - partner_id is nullable for SH items
    const itemData: ItemData = {
      internal_name: internalName,
      type: 'picture',
      backward_compatibility: this.getPictureBackwardCompatibility(group),
      country_id: mapCountryCode(group.country),
      parent_id: parentItemId,
      collection_id: collectionId,
      partner_id: null,
      project_id: projectId,
      owner_reference: null,
      mwnf_reference: null,
      display_order: group.image_number,
    };

    const itemId = await this.context.strategy.writeItem(itemData);

    // Create translations
    for (const text of group.translations) {
      const hasCaption = !!(text.caption && text.caption.trim());
      const hasPhotographer = !!(text.photographer && text.photographer.trim());
      const hasCopyright = !!(text.copyright && text.copyright.trim());

      // Skip translation rows that carry no text or metadata content.
      if (!hasCaption && !hasPhotographer && !hasCopyright) {
        continue;
      }

      const languageId = mapLanguageCode(text.lang);

      // `name` is always a short label derived from the parent monument's title —
      // never the caption, which is long-form HTML and belongs in `description`
      // (an unbounded text column) rather than the 255-char `name` column.
      const parentName = await this.getCachedParentMonumentName(
        group.project_id,
        group.country,
        group.number,
        text.lang
      );
      const parentTitle = parentName ? convertHtmlToMarkdown(parentName) : null;
      let name = parentTitle ? `${parentTitle} (${group.image_number})` : `Picture ${group.image_number}`;

      const MAX_NAME_LENGTH = 255;
      if (name.length > MAX_NAME_LENGTH) {
        this.logWarning(
          `sh_monument_images translation name truncated (${name.length} → ${MAX_NAME_LENGTH} chars) for image ${group.image_number} lang ${text.lang}`
        );
        name = name.substring(0, MAX_NAME_LENGTH);
      }

      const description = hasCaption ? convertHtmlToMarkdown(text.caption!) : '';

      const translationExtra: Record<string, unknown> = { ...extra };
      if (hasPhotographer) {
        translationExtra.photographer = convertHtmlToMarkdown(text.photographer!);
      }
      if (hasCopyright) {
        translationExtra.copyright = text.copyright!;
      }

      const translationData: ItemTranslationData = {
        item_id: itemId,
        language_id: languageId,
        context_id: contextId,
        backward_compatibility: this.getPictureBackwardCompatibility(group),
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

    if (group.type) {
      const defaultLangId = this.context.tracker.getMetadata('default_language_id');
      const tagIds = await this.tagHelper.findOrCreateList(
        group.type,
        'image-type',
        defaultLangId ?? 'eng'
      );
      if (tagIds.length > 0) {
        await this.tagHelper.attachToItem(itemId, tagIds);
      }
    }

    return itemId;
  }

  private parentNameCache = new Map<string, string | null>();

  private async getCachedParentMonumentName(
    projectId: string,
    country: string,
    number: number,
    lang: string
  ): Promise<string | null> {
    const key = `${projectId}:${country}:${number}:${lang}`;
    if (!this.parentNameCache.has(key)) {
      this.parentNameCache.set(key, await this.getParentMonumentName(projectId, country, number, lang));
    }
    return this.parentNameCache.get(key)!;
  }

  private async getParentMonumentName(
    projectId: string,
    country: string,
    number: number,
    lang: string
  ): Promise<string | null> {
    const result = await this.context.legacyDb.query<{ name: string }>(
      'SELECT name FROM mwnf3_sharing_history.sh_monuments_texts WHERE project_id = ? AND country = ? AND number = ? AND lang = ?',
      [projectId, country, number, lang]
    );
    return result.length > 0 ? result[0]!.name : null;
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
