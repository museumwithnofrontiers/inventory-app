/**
 * SH Exhibition Image Importer
 *
 * Imports the pictures an SH exhibition row names as the exhibition
 * collection's images, and keeps its logos as legacy data:
 * - homeimage, exh_thumb, portal_image: one image each, tagged with its role
 * - logo1..logo3: the partner logos legacy's exhibition home prints, with
 *   their urls. A logo is the site's, not the inventory's (#2463, Pascal
 *   2026-11-03): site configuration (M16 E4b, decision 6), built by
 *   siteConfiguration() for the exhibition's instance file as `extra.logos`.
 *
 * Legacy schema (mwnf3_sharing_history):
 * - sh_exhibitions (exhibition_id, exh_thumb, logo1, url1, logo2, url2, logo3, url3,
 *   homeimage, portal_image)
 *
 * New schema:
 * - collection_images (collection_id, path, original_name, mime_type, size, display_order, extra)
 * - collection_image_tag, with `image-type` tags
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
import type { SiteConfigBuilder, SiteConfigEntry } from '../../site-config/types.js';

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

export class ShExhibitionImageImporter extends BaseImporter implements SiteConfigBuilder {
  private tagHelper: TagHelper | null = null;

  getName(): string {
    return 'ShExhibitionImageImporter';
  }

  /** Each SH exhibition's partner logos, for its instance file (M16 E4b). */
  async siteConfiguration(): Promise<SiteConfigEntry[]> {
    const rows = await this.context.legacyDb.query<ShExhibitionImageRow>(
      `SELECT exhibition_id, exh_thumb, logo1, url1, logo2, url2, logo3, url3,
              homeimage, portal_image
       FROM ${SH_SCHEMA}.sh_exhibitions
       ORDER BY exhibition_id`
    );
    const entries: SiteConfigEntry[] = [];
    for (const row of rows) {
      const logos = exhibitionLogos(row);
      if (logos.length === 0) continue;
      entries.push({
        collection: `${SH_SCHEMA}:sh_exhibitions:${row.exhibition_id}`,
        extra: { logos },
      });
    }
    return entries;
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
        if (images.length === 0) continue;

        const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibitions:${row.exhibition_id}`;
        const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
        if (!collectionId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `Exhibition ${row.exhibition_id}: Collection not found (${collectionBackwardCompat}), images skipped`
          );
          result.skipped += images.length;
          this.showSkipped();
          continue;
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
