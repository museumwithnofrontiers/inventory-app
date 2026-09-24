/**
 * Partner Picture Importer
 *
 * Imports pictures from mwnf3.museums_pictures and mwnf3.institutions_pictures.
 *
 * Strategy:
 * - Simpler than Item pictures - direct attachment to Partner
 * - No child items created
 * - Each picture becomes a PartnerImage
 * - Caption, photographer, copyright stored as metadata
 * - Copyright also stored burn-ready ("© " + text) on the image row itself
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult, PartnerImageData } from '../../core/types.js';
import type { LegacyMuseumPicture, LegacyInstitutionPicture } from '../../domain/types/index.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { toImageCopyright } from '../../utils/image-copyright.js';
import path from 'path';

export class PartnerPictureImporter extends BaseImporter {
  getName(): string {
    return 'PartnerPictureImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing partner pictures...');

      // Import museum pictures
      const museumResult = await this.importMuseumPictures();
      result.imported += museumResult.imported;
      result.skipped += museumResult.skipped;
      result.errors.push(...museumResult.errors);

      // Import institution pictures
      const institutionResult = await this.importInstitutionPictures();
      result.imported += institutionResult.imported;
      result.skipped += institutionResult.skipped;
      result.errors.push(...institutionResult.errors);

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to import partner pictures: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async importMuseumPictures(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing museum pictures...');

      const pictures = await this.context.legacyDb.query<LegacyMuseumPicture>(
        'SELECT * FROM mwnf3.museums_pictures ORDER BY museum_id, country, image_number'
      );

      if (pictures.length === 0) {
        this.logInfo('No museum pictures found');
        return result;
      }

      this.logInfo(`Found ${pictures.length} museum pictures`);

      // Import each picture
      for (const picture of pictures) {
        try {
          const imported = await this.importMuseumPicture(picture);
          if (imported) {
            result.imported++;
            this.showProgress();
          } else {
            result.skipped++;
            this.showSkipped();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const backwardCompat = formatBackwardCompatibility({
            schema: 'mwnf3',
            table: 'museums_pictures',
            pkValues: [picture.museum_id, picture.country, String(picture.image_number)],
          });
          result.errors.push(`${backwardCompat}: ${message}`);
          this.logError(`Museum picture ${backwardCompat}`, message);
          this.showError();
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to query museum pictures: ${message}`);
    }

    return result;
  }

  private async importMuseumPicture(picture: LegacyMuseumPicture): Promise<boolean> {
    const backwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'museums_pictures',
      pkValues: [picture.museum_id, picture.country, String(picture.image_number)],
    });

    // Find Partner
    const partnerBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'museums',
      pkValues: [picture.museum_id, picture.country],
    });
    const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
    if (!partnerId) {
      throw new Error(`Partner not found: ${partnerBackwardCompat}`);
    }

    // Check if already imported. partner_images has no
    // backward_compatibility column — identity is (owner, legacy path).
    const imageKey = picture.path.toLowerCase();
    if (await this.imageExistsAsync('partner_images', partnerId, picture.path)) {
      return false;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import museum picture: ${backwardCompat}`
      );
      this.registerEntity(`sample-image-${backwardCompat}`, imageKey, 'image');
      return true;
    }

    // Build alt_text from the caption; without one it stays null, since a
    // legacy file path is no alternative text
    let altText = picture.caption?.trim() || null;

    // Truncate alt_text if too long (database limit)
    if (altText && altText.length > 500) {
      altText = altText.substring(0, 497) + '...';
    }

    // Extract metadata
    const mimeType = this.getMimeType(picture.path);
    const originalName = path.basename(picture.path);

    // Build extra JSON for photographer/copyright
    const extra: Record<string, unknown> = {};
    if (picture.photographer && picture.photographer.trim()) {
      extra.photographer = picture.photographer.trim();
    }
    if (picture.copyright && picture.copyright.trim()) {
      extra.copyright = picture.copyright.trim();
    }
    const extraField = Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;

    // Create PartnerImage
    const imageData: PartnerImageData = {
      id: undefined,
      partner_id: partnerId,
      path: picture.path,
      original_name: originalName,
      mime_type: mimeType,
      size: 1, // Fake size as required
      alt_text: altText,
      copyright: toImageCopyright(picture.copyright),
      display_order: picture.image_number,
      extra: extraField,
    };

    await this.context.strategy.writePartnerImage(imageData);
    // Image is tracked by path in writePartnerImage, no need to register here

    return true;
  }

  private async importInstitutionPictures(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing institution pictures...');

      const pictures = await this.context.legacyDb.query<LegacyInstitutionPicture>(
        'SELECT * FROM mwnf3.institutions_pictures ORDER BY institution_id, country, image_number'
      );

      if (pictures.length === 0) {
        this.logInfo('No institution pictures found');
        return result;
      }

      this.logInfo(`Found ${pictures.length} institution pictures`);

      // Import each picture
      for (const picture of pictures) {
        try {
          const imported = await this.importInstitutionPicture(picture);
          if (imported) {
            result.imported++;
            this.showProgress();
          } else {
            result.skipped++;
            this.showSkipped();
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const backwardCompat = formatBackwardCompatibility({
            schema: 'mwnf3',
            table: 'institutions_pictures',
            pkValues: [picture.institution_id, picture.country, String(picture.image_number)],
          });
          result.errors.push(`${backwardCompat}: ${message}`);
          this.logError(`Institution picture ${backwardCompat}`, message);
          this.showError();
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to query institution pictures: ${message}`);
    }

    return result;
  }

  private async importInstitutionPicture(picture: LegacyInstitutionPicture): Promise<boolean> {
    const backwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'institutions_pictures',
      pkValues: [picture.institution_id, picture.country, String(picture.image_number)],
    });

    // Find Partner
    const partnerBackwardCompat = formatBackwardCompatibility({
      schema: 'mwnf3',
      table: 'institutions',
      pkValues: [picture.institution_id, picture.country],
    });
    const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
    if (!partnerId) {
      throw new Error(`Partner not found: ${partnerBackwardCompat}`);
    }

    // Check if already imported. partner_images has no
    // backward_compatibility column — identity is (owner, legacy path).
    const imageKey = picture.path.toLowerCase();
    if (await this.imageExistsAsync('partner_images', partnerId, picture.path)) {
      return false;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import institution picture: ${backwardCompat}`
      );
      this.registerEntity(`sample-image-${backwardCompat}`, imageKey, 'image');
      return true;
    }

    // Build alt_text from the caption; without one it stays null, since a
    // legacy file path is no alternative text
    let altText = picture.caption?.trim() || null;

    // Truncate alt_text if too long (database limit)
    if (altText && altText.length > 500) {
      altText = altText.substring(0, 497) + '...';
    }

    // Extract metadata
    const mimeType = this.getMimeType(picture.path);
    const originalName = path.basename(picture.path);

    // Build extra JSON for photographer/copyright
    const extra: Record<string, unknown> = {};
    if (picture.photographer && picture.photographer.trim()) {
      extra.photographer = picture.photographer.trim();
    }
    if (picture.copyright && picture.copyright.trim()) {
      extra.copyright = picture.copyright.trim();
    }
    const extraField = Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;

    // Create PartnerImage
    const imageData: PartnerImageData = {
      id: undefined,
      partner_id: partnerId,
      path: picture.path,
      original_name: originalName,
      mime_type: mimeType,
      size: 1, // Fake size as required
      alt_text: altText,
      copyright: toImageCopyright(picture.copyright),
      display_order: picture.image_number,
      extra: extraField,
    };

    await this.context.strategy.writePartnerImage(imageData);
    // Image is tracked by path in writePartnerImage, no need to register here

    return true;
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
