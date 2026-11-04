/**
 * SH Exhibition Image Importer
 *
 * Imports the pictures an SH exhibition row names as the exhibition
 * collection's images, and keeps its logos as legacy data:
 * - homeimage, exh_thumb, portal_image: one image each, tagged with its role
 * - logo1..logo3: the partner logos legacy's exhibition home prints, with
 *   their urls, in the collection's `extra.logos`. A logo is the site's, not
 *   the inventory's (#2463, Pascal 2026-11-03): each website keeps the logos
 *   it shows in its own assets.
 *
 * Legacy schema (mwnf3_sharing_history):
 * - sh_exhibitions (exhibition_id, exh_thumb, logo1, url1, logo2, url2, logo3, url3,
 *   homeimage, portal_image)
 *
 * New schema:
 * - collection_images (collection_id, path, original_name, mime_type, size, display_order, extra)
 * - collection_image_tag, with `image-type` tags
 * - collections.extra.logos ([{ file, link?, display_order }])
 *
 * The files are copied later by image-sync (size 1 marks a row to sync).
 *
 * Dependencies:
 * - ShExhibitionImporter (creates the exhibition collections)
 */

import path from 'path';
import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import type { ShLegacyExhibition } from '../../domain/types/index.js';
import { TagHelper } from '../../helpers/tag-helper.js';

const SH_SCHEMA = 'mwnf3_sharing_history';
const IMAGE_TYPE_TAG_CATEGORY = 'image-type';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** One picture an exhibition row names: its legacy path and role tag. */
export interface ShExhibitionImage {
  path: string;
  tag: string;
}

/** One entry of an exhibition collection's `extra.logos`. */
export interface ShExhibitionLogo {
  file: string;
  link?: string;
  display_order: number;
}

type ShExhibitionImageRow = Pick<
  ShLegacyExhibition,
  | 'exhibition_id'
  | 'exh_thumb'
  | 'logo1'
  | 'url1'
  | 'logo2'
  | 'url2'
  | 'logo3'
  | 'url3'
  | 'homeimage'
  | 'portal_image'
>;

const trimToNull = (value: string | null | undefined): string | null => value?.trim() || null;

/** The pictures a legacy exhibition row names, in the order legacy's columns give them. */
export function exhibitionImages(row: ShExhibitionImageRow): ShExhibitionImage[] {
  const images: ShExhibitionImage[] = [];
  const pictures: [string | null, string][] = [
    [row.homeimage, 'home image'],
    [row.exh_thumb, 'thumbnail'],
    [row.portal_image, 'portal image'],
  ];
  for (const [legacyPath, tag] of pictures) {
    const imagePath = trimToNull(legacyPath);
    if (imagePath) images.push({ path: imagePath, tag });
  }
  return images;
}

/** The logos a legacy exhibition row names (logo1..3), each with its url, in their order. */
export function exhibitionLogos(row: ShExhibitionImageRow): ShExhibitionLogo[] {
  const logos: ShExhibitionLogo[] = [];
  const columns: [string | null, string | null][] = [
    [row.logo1, row.url1],
    [row.logo2, row.url2],
    [row.logo3, row.url3],
  ];
  columns.forEach(([legacyPath, url], index) => {
    const file = trimToNull(legacyPath);
    if (!file) return;
    const link = trimToNull(url);
    logos.push({ file, ...(link ? { link } : {}), display_order: index + 1 });
  });
  return logos;
}

export class ShExhibitionImageImporter extends BaseImporter {
  private tagHelper: TagHelper | null = null;

  getName(): string {
    return 'ShExhibitionImageImporter';
  }

  private getTagHelper(): TagHelper {
    this.tagHelper ??= new TagHelper(
      this.context.strategy,
      this.context.tracker,
      this.context.logger
    );
    return this.tagHelper;
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing SH exhibition images...');

      const rows = await this.context.legacyDb.query<ShExhibitionImageRow>(
        `SELECT exhibition_id, exh_thumb, logo1, url1, logo2, url2, logo3, url3,
                homeimage, portal_image
         FROM ${SH_SCHEMA}.sh_exhibitions
         ORDER BY exhibition_id`
      );
      const defaultLanguageId = await this.getDefaultLanguageIdAsync();
      const tagIds = new Map<string, string | null>();

      for (const row of rows) {
        const images = exhibitionImages(row);
        const logos = exhibitionLogos(row);
        if (images.length === 0 && logos.length === 0) continue;

        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibitions:${row.exhibition_id}`;
        const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
        if (!collectionId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `Exhibition ${row.exhibition_id}: Collection not found (${collectionBackwardCompat}), images skipped`
          );
          result.skipped += images.length + logos.length;
          this.showSkipped();
          continue;
        }

        if (logos.length > 0) {
          try {
            if (this.isDryRun || this.isSampleOnlyMode) {
              this.logInfo(
                `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would write ${logos.length} logo(s) to exhibition ${row.exhibition_id}`
              );
            } else {
              // Read-modify-write, beside whatever else the exhibition keeps in
              // `extra`; written whole, so a rerun leaves the same list.
              const existing = (await this.context.strategy.getCollectionExtra(collectionId)) ?? {};
              await this.context.strategy.setCollectionExtra(
                collectionId,
                JSON.stringify({ ...existing, logos })
              );
            }
            result.imported += logos.length;
            this.showProgress();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`Exhibition ${row.exhibition_id} logos: ${message}`);
            this.logError(`Exhibition ${row.exhibition_id} logos`, message);
            this.showError();
          }
        }

        for (const image of images) {
          try {
            // collection_images has no backward_compatibility column: identity is (owner, legacy path).
            if (await this.imageExistsAsync('collection_images', collectionId, image.path)) {
              result.skipped++;
              this.showSkipped();
              continue;
            }

            if (this.isDryRun || this.isSampleOnlyMode) {
              this.logInfo(
                `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would import exhibition ${image.tag}: ${image.path}`
              );
              result.imported++;
              this.showProgress();
              continue;
            }

            const imageId = await this.context.strategy.writeCollectionImage({
              collection_id: collectionId,
              path: image.path,
              original_name: path.basename(image.path),
              mime_type: MIME_TYPES[path.extname(image.path).toLowerCase()] ?? 'image/jpeg',
              size: 1,
              alt_text: null,
              display_order: 0,
              extra: null,
            });

            if (!tagIds.has(image.tag)) {
              tagIds.set(
                image.tag,
                await this.getTagHelper().findOrCreate(
                  image.tag,
                  IMAGE_TYPE_TAG_CATEGORY,
                  defaultLanguageId
                )
              );
            }
            const tagId = tagIds.get(image.tag);
            if (tagId) {
              await this.getTagHelper().attachToCollectionImage(imageId, [tagId]);
            } else {
              result.warnings = result.warnings || [];
              result.warnings.push(`image-type:${image.tag} tag could not be resolved`);
            }

            result.imported++;
            this.showProgress();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`Exhibition ${row.exhibition_id} image ${image.path}: ${message}`);
            this.logError(`Exhibition ${row.exhibition_id} image ${image.path}`, message);
            this.showError();
          }
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ShExhibitionImageImporter', message);
    }

    return result;
  }
}
