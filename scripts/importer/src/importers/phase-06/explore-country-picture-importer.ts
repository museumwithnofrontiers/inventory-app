/**
 * Explore Country Picture Importer
 *
 * Imports each Explore country's picture (mwnf3_explore.countries.path) as a
 * CollectionImage of its country collection: the picture the live site shows
 * on a country's page. A country has at most one.
 *
 * Legacy schema:
 * - mwnf3_explore.countries (countryId, geoCoordinates, zoom, path)
 *
 * New schema:
 * - collection_images (collection_id, path, original_name, mime_type, size, alt_text, copyright, display_order)
 *   The file itself is copied by image-sync, which picks up the placeholder size.
 *
 * Dependencies:
 * - ExploreCountryImporter (must run first to create the country collections)
 */

import path from 'path';
import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

interface LegacyCountryPicture {
  countryId: string;
  path: string;
}

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export class ExploreCountryPictureImporter extends BaseImporter {
  getName(): string {
    return 'ExploreCountryPictureImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      const pictures = await this.context.legacyDb.query<LegacyCountryPicture>(
        `SELECT countryId, path
         FROM mwnf3_explore.countries
         WHERE path IS NOT NULL AND path <> ''
         ORDER BY countryId`
      );
      this.logInfo(`Found ${pictures.length} country pictures`);

      for (const picture of pictures) {
        try {
          const countryKey = `mwnf3_explore:country:${picture.countryId}`;
          const collectionId = await this.getEntityUuidAsync(countryKey, 'collection');
          // Legacy keeps countries Explore does not show; they have no collection.
          if (!collectionId) {
            this.logWarning(`No Explore country collection for ${countryKey}, picture skipped`);
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // collection_images has no backward_compatibility column: identity is (owner, legacy path).
          if (await this.imageExistsAsync('collection_images', collectionId, picture.path)) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import country picture: ${picture.path}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeCollectionImage({
            collection_id: collectionId,
            path: picture.path,
            original_name: path.basename(picture.path),
            mime_type: MIME_TYPES[path.extname(picture.path).toLowerCase()] ?? 'image/jpeg',
            size: 1, // Placeholder: image-sync copies the file and sets the real size.
            alt_text: null,
            copyright: null,
            display_order: 1,
          });
          this.registerEntity(
            `mwnf3_explore:country_picture:${picture.countryId}`,
            picture.path.toLowerCase(),
            'image'
          );
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Country picture ${picture.countryId}: ${message}`);
          this.logError('ExploreCountryPictureImporter', message, { countryId: picture.countryId });
          this.showError();
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to import country pictures: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
