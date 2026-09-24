/**
 * Travels Itinerary Picture Importer
 *
 * Imports pictures from mwnf3_travels.tr_itineraries_pictures as CollectionImages.
 *
 * Legacy schema:
 * - mwnf3_travels.tr_itineraries_pictures (lang, country, project_id, number, trail_id, image_number, path, thumb, caption, photographer, copyright, lastupdate, type)
 *   - PK: (lang, project_id, country, trail_id, number, image_number, type)
 *   - Types: sketch, or empty
 *
 * New schema:
 * - collection_images (collection_id, path, original_name, mime_type, size, alt_text, copyright, display_order)
 *
 * Dependencies:
 * - TravelsItineraryImporter (must run first to create itinerary collections)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult, CollectionImageData } from '../../core/types.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import { pickImageCopyright } from '../../utils/image-copyright.js';
import path from 'path';

/**
 * Legacy itinerary picture structure
 */
interface LegacyItineraryPicture {
  lang: string;
  country: string;
  project_id: string;
  number: string; // itinerary number (e.g., 'i', 'ii', 'iii')
  trail_id: number;
  image_number: number;
  path: string;
  thumb: string | null;
  caption: string;
  photographer: string;
  copyright: string;
  lastupdate: string | null;
  type: string; // sketch, or empty
}

/**
 * Grouped picture (unique by non-lang keys)
 */
interface PictureGroup {
  project_id: string;
  country: string;
  trail_id: number;
  number: string;
  image_number: number;
  type: string;
  path: string;
  translations: LegacyItineraryPicture[];
}

export class TravelsItineraryPictureImporter extends BaseImporter {
  getName(): string {
    return 'TravelsItineraryPictureImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing travel itinerary pictures...');

      // Query all itinerary pictures
      const pictures = await this.context.legacyDb.query<LegacyItineraryPicture>(
        `SELECT lang, country, project_id, number, trail_id, image_number, path, thumb, caption, photographer, copyright, lastupdate, type
        FROM mwnf3_travels.tr_itineraries_pictures
         ORDER BY project_id, country, trail_id, number, type, image_number, lang`
      );

      if (pictures.length === 0) {
        this.logInfo('No itinerary pictures found');
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
          this.logError(`Itinerary Picture ${backwardCompat}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to query itinerary pictures: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private groupPictures(pictures: LegacyItineraryPicture[]): PictureGroup[] {
    const groups = new Map<string, PictureGroup>();

    for (const pic of pictures) {
      const key = `${pic.project_id}:${pic.country}:${pic.trail_id}:${pic.number}:${pic.type}:${pic.image_number}`;

      if (!groups.has(key)) {
        groups.set(key, {
          project_id: pic.project_id,
          country: pic.country,
          trail_id: pic.trail_id,
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
    return `mwnf3_travels:itinerary_picture:${group.project_id}:${group.country}:${group.trail_id}:${group.number}:${group.type || '_'}:${group.image_number}`;
  }

  private async importPicture(group: PictureGroup, _result: ImportResult): Promise<boolean> {
    const backwardCompat = this.getBackwardCompatibility(group);

    // Find parent itinerary collection
    const itineraryBackwardCompat = `mwnf3_travels:itinerary:${group.project_id}:${group.country}:${group.trail_id}:${group.number}`;
    const collectionId = await this.getEntityUuidAsync(itineraryBackwardCompat, 'collection');
    if (!collectionId) {
      throw new Error(`Parent itinerary collection not found: ${itineraryBackwardCompat}`);
    }

    // Check if already imported. collection_images has no
    // backward_compatibility column — identity is (owner, legacy path).
    const imageKey = group.path.toLowerCase();
    if (await this.imageExistsAsync('collection_images', collectionId, group.path)) {
      return false;
    }

    // Collect sample
    this.collectSample(
      'itinerary_picture',
      group.translations[0] as unknown as Record<string, unknown>,
      'success'
    );

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import itinerary picture: ${backwardCompat}`
      );
      this.registerEntity(`sample-${backwardCompat}`, imageKey, 'image');
      return true;
    }

    // Calculate display_order for this collection
    const displayOrderKey = `itinerary_picture_order:${collectionId}`;
    const currentOrder = this.context.tracker.getMetadata(displayOrderKey);
    const displayOrder = currentOrder ? parseInt(currentOrder, 10) + 1 : 1;
    this.context.tracker.setMetadata(displayOrderKey, String(displayOrder));

    // Get best caption
    const bestCaption = this.pickBestCaption(
      group.translations.map((t) => ({ lang: t.lang, caption: t.caption })),
      this.context.tracker.getMetadata('default_language_id')
    );
    const captionText = bestCaption ? convertHtmlToMarkdown(bestCaption) : null;

    // The legacy rows carry the copyright per language; the image keeps one,
    // burn-ready (English, else the first filled)
    const copyright = pickImageCopyright(
      group.translations.map((t) => ({ lang: t.lang, copyright: t.copyright }))
    );

    const mimeType = this.getMimeType(group.path);
    const originalName = path.basename(group.path);

    // Create CollectionImage
    const imageData: CollectionImageData = {
      collection_id: collectionId,
      path: group.path,
      original_name: originalName,
      mime_type: mimeType,
      size: 1, // Placeholder size
      alt_text: captionText,
      copyright,
      display_order: displayOrder,
    };

    await this.context.strategy.writeCollectionImage(imageData);

    // Register in tracker
    this.registerEntity(backwardCompat, imageKey, 'image');

    return true;
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
