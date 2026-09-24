/**
 * SH Partner Picture Importer
 *
 * Imports profile/gallery pictures from mwnf3_sharing_history.sh_partner_pictures.
 *
 * Legacy source table: mwnf3_sharing_history.sh_partner_pictures
 * Columns: image_number, partners_id, path, thumb, lastupdate, caption, photographer, copyright
 *
 * Strategy:
 * - Each row becomes a PartnerImage record
 * - Partner is resolved by SH backward_compatibility key (already imported by ShPartnerImporter)
 * - path is required; rows with null/empty path are skipped with a warning
 * - alt_text: trimmed caption when present and non-empty; otherwise null
 * - extra: JSON containing photographer and copyright when present
 * - copyright: the same copyright, burn-ready ("© " + text), on the image row
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult, PartnerImageData } from '../../core/types.js';
import { formatShBackwardCompatibility } from '../../domain/transformers/index.js';
import { toImageCopyright } from '../../utils/image-copyright.js';
import path from 'path';

const SH_PARTNERS_TABLE = 'sh_partners';
const SH_PARTNER_PICTURES_TABLE = 'sh_partner_pictures';

interface ShPartnerPicture {
  image_number: number;
  partners_id: string;
  path: string | null;
  thumb: string | null;
  lastupdate: string | null;
  caption: string | null;
  photographer: string | null;
  copyright: string | null;
}

export class ShPartnerPictureImporter extends BaseImporter {
  getName(): string {
    return 'ShPartnerPictureImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing Sharing History partner pictures...');

      const pictures = await this.context.legacyDb.query<ShPartnerPicture>(`
        SELECT image_number, partners_id, path, thumb, lastupdate, caption, photographer, copyright
        FROM mwnf3_sharing_history.sh_partner_pictures
        ORDER BY partners_id, image_number
      `);

      if (pictures.length === 0) {
        this.logInfo('No SH partner pictures found');
        return result;
      }

      this.logInfo(`Found ${pictures.length} SH partner pictures`);

      for (const picture of pictures) {
        const backwardCompat = formatShBackwardCompatibility(
          SH_PARTNER_PICTURES_TABLE,
          picture.partners_id,
          picture.image_number
        );

        try {
          // Skip rows with null or empty path
          if (!picture.path || picture.path.trim() === '') {
            this.logWarning(`${backwardCompat}: path is null or empty, skipping`);
            result.errors.push(`${backwardCompat}: path is null or empty`);
            this.showError();
            continue;
          }

          // Resolve parent partner
          const partnerBackwardCompat = formatShBackwardCompatibility(
            SH_PARTNERS_TABLE,
            picture.partners_id
          );
          const partnerId = await this.getEntityUuidAsync(partnerBackwardCompat, 'partner');
          if (!partnerId) {
            this.logWarning(
              `${backwardCompat}: Partner not found for BC key ${partnerBackwardCompat}`
            );
            result.errors.push(`${backwardCompat}: Partner not found: ${partnerBackwardCompat}`);
            this.showError();
            continue;
          }

          // Check if already imported. partner_images has no
          // backward_compatibility column — identity is (owner, legacy path).
          const imageKey = picture.path.toLowerCase();
          if (await this.imageExistsAsync('partner_images', partnerId, picture.path)) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import SH partner picture: ${backwardCompat}`
            );
            this.registerEntity(`sample-image-${backwardCompat}`, imageKey, 'image');
            result.imported++;
            this.showProgress();
            continue;
          }

          // Build metadata
          const mimeType = this.getMimeType(picture.path);
          const originalName = path.basename(picture.path);

          // Build alt_text: trimmed caption when present and non-empty, otherwise null
          const altText = picture.caption && picture.caption.trim() ? picture.caption.trim() : null;

          // Build extra for photographer/copyright
          const extra: Record<string, string> = {};
          if (picture.photographer && picture.photographer.trim()) {
            extra.photographer = picture.photographer.trim();
          }
          if (picture.copyright && picture.copyright.trim()) {
            extra.copyright = picture.copyright.trim();
          }

          const imageData: PartnerImageData = {
            id: undefined,
            partner_id: partnerId,
            path: picture.path,
            original_name: originalName,
            mime_type: mimeType,
            size: 1, // Placeholder for ImageSyncTool
            alt_text: altText,
            copyright: toImageCopyright(picture.copyright),
            display_order: picture.image_number,
            extra: Object.keys(extra).length > 0 ? JSON.stringify(extra) : null,
          };

          await this.context.strategy.writePartnerImage(imageData);

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`${backwardCompat}: ${message}`);
          this.logError(`SH partner picture ${backwardCompat}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to import SH partner pictures: ${message}`);
      result.success = false;
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.bmp': 'image/bmp',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
