/**
 * Explore Itinerary Picture Importer
 *
 * Imports each Explore itinerary's picture (mwnf3_explore.explore_itineraries.path)
 * as a CollectionImage of its itinerary collection: the picture the live site
 * shows for an itinerary. An itinerary has at most one, and only top-level
 * itineraries have one; legacy's API shows a sub-itinerary the first picture of
 * its first location's first monument instead, which a site derives from the
 * package.
 *
 * Legacy schema:
 * - mwnf3_explore.explore_itineraries (itineraries_id, …, path)
 *
 * New schema:
 * - collection_images (collection_id, path, original_name, mime_type, size, alt_text, copyright, display_order)
 *   The file itself is copied by image-sync, which picks up the placeholder size.
 *
 * Dependencies:
 * - ExploreItineraryImporter (must run first to create the itinerary collections)
 */

import path from 'path';
import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

interface LegacyItineraryPicture {
  itineraries_id: number;
  path: string;
}

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export class ExploreItineraryPictureImporter extends BaseImporter {
  getName(): string {
    return 'ExploreItineraryPictureImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      const pictures = await this.context.legacyDb.query<LegacyItineraryPicture>(
        `SELECT itineraries_id, path
         FROM mwnf3_explore.explore_itineraries
         WHERE path IS NOT NULL AND path <> ''
         ORDER BY itineraries_id`
      );
      this.logInfo(`Found ${pictures.length} itinerary pictures`);

      for (const picture of pictures) {
        try {
          const itineraryKey = `mwnf3_explore:itinerary:${picture.itineraries_id}`;
          const collectionId = await this.getEntityUuidAsync(itineraryKey, 'collection');
          if (!collectionId) {
            this.logWarning(`No Explore itinerary collection for ${itineraryKey}, picture skipped`);
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
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import itinerary picture: ${picture.path}`
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
            `mwnf3_explore:itinerary_picture:${picture.itineraries_id}`,
            picture.path.toLowerCase(),
            'image'
          );
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Itinerary picture ${picture.itineraries_id}: ${message}`);
          this.logError('ExploreItineraryPictureImporter', message, {
            itineraryId: picture.itineraries_id,
          });
          this.showError();
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to import itinerary pictures: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
