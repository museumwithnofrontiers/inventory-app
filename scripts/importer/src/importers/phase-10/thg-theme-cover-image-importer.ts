/**
 * THG Theme Cover Image Importer
 *
 * Marks which of a theme's selected pictures is its cover — the image the
 * exhibition's theme landing and theme-gallery pages lead with.
 *
 * Legacy schema:
 * - mwnf3_thematic_gallery.theme_cover_image (gallery_id, theme_id, item_id)
 *   - the triple references a theme_item row, i.e. a selected picture
 *
 * New schema:
 * - collections.extra.thg_theme.cover_picture on the theme collection:
 *     { "backward_compatibility": "mwnf3:objects_pictures:…", "item_id": "<uuid>" }
 *
 * The cover is stored as a reference to the already-imported picture item rather
 * than as a collection image: the picture is an Item in its own right (that is
 * how theme items are modelled), and attaching a second copy of the file would
 * mean pushing an image through the upload pipeline for no gain.
 *
 * Dependencies:
 * - ThgThemeImporter (theme collections)
 * - ThgThemeItemImporter (not strictly required — the picture items come from
 *   phase-02/03 — but the cover is only meaningful once the theme's items exist)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  resolvePictureItemBackwardCompatibility,
  themeItemSelectColumns,
} from './thg-theme-item-resolver.js';
import type { LegacyThemeItem } from './thg-theme-item-resolver.js';

interface LegacyThemeCoverImage {
  gallery_id: number;
  theme_id: number;
  item_id: number;
}

interface LegacyThemeItemRow extends LegacyThemeItem {
  gallery_id: number;
  theme_id: number;
  item_id: number;
}

export class ThgThemeCoverImageImporter extends BaseImporter {
  /** "{gallery}.{theme}.{item}" -> theme_item row */
  private themeItemCache: Map<string, LegacyThemeItemRow> = new Map();

  getName(): string {
    return 'ThgThemeCoverImageImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Loading theme_item data for cover image resolution...');

      try {
        const themeItems = await this.context.legacyDb.query<LegacyThemeItemRow>(
          `SELECT gallery_id, theme_id, item_id,
                  ${await themeItemSelectColumns(this.context.legacyDb)}
           FROM mwnf3_thematic_gallery.theme_item`
        );
        for (const item of themeItems) {
          this.themeItemCache.set(
            `${item.gallery_id}.${item.theme_id}.${item.item_id}`,
            item
          );
        }
        this.logInfo(`Loaded ${this.themeItemCache.size} theme_item records`);
      } catch (queryError) {
        const message = queryError instanceof Error ? queryError.message : String(queryError);
        if (message.includes("doesn't exist") || message.includes('Unknown column')) {
          this.logInfo(`⚠️ Skipping: Legacy theme_item table not available (${message})`);
          result.warnings = result.warnings || [];
          result.warnings.push(`Legacy theme_item table not available: ${message}`);
          return result;
        }
        throw queryError;
      }

      this.logInfo('Importing theme cover images...');

      let covers: LegacyThemeCoverImage[];
      try {
        covers = await this.context.legacyDb.query<LegacyThemeCoverImage>(
          `SELECT gallery_id, theme_id, item_id
           FROM mwnf3_thematic_gallery.theme_cover_image
           ORDER BY gallery_id, theme_id`
        );
      } catch (queryError) {
        const message = queryError instanceof Error ? queryError.message : String(queryError);
        if (message.includes("doesn't exist") || message.includes('Unknown column')) {
          this.logInfo(`⚠️ Skipping: Legacy theme_cover_image table not available (${message})`);
          result.warnings = result.warnings || [];
          result.warnings.push(`Legacy theme_cover_image table not available: ${message}`);
          return result;
        }
        throw queryError;
      }

      this.logInfo(`Found ${covers.length} theme cover images to process`);

      for (const legacy of covers) {
        const coverKey = `${legacy.gallery_id}.${legacy.theme_id}.${legacy.item_id}`;

        try {
          const themeItem = this.themeItemCache.get(coverKey);
          if (!themeItem) {
            result.warnings = result.warnings || [];
            result.warnings.push(`Theme cover ${coverKey}: theme_item record not found, skipping`);
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const pictureBackwardCompat = resolvePictureItemBackwardCompatibility(themeItem);
          if (!pictureBackwardCompat) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Theme cover ${coverKey}: no picture reference in any source family, skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const itemId = await this.getEntityUuidAsync(pictureBackwardCompat, 'item');
          if (!itemId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Theme cover ${coverKey}: picture item not found (${pictureBackwardCompat}), skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const themeBackwardCompat = `mwnf3_thematic_gallery:theme:${legacy.gallery_id}:${legacy.theme_id}`;
          const collectionId = await this.getEntityUuidAsync(themeBackwardCompat, 'collection');
          if (!collectionId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Theme cover ${coverKey}: theme collection not found (${themeBackwardCompat}), skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          this.collectSample(
            'thg_theme_cover_image',
            {
              ...legacy,
              resolved_picture_backward_compat: pictureBackwardCompat,
              resolved_theme_collection: themeBackwardCompat,
            },
            'success'
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would set cover picture of ${themeBackwardCompat} to ${pictureBackwardCompat}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          const existingExtra =
            (await this.context.strategy.getCollectionExtra(collectionId)) ?? {};
          const themeExtra = {
            ...((existingExtra.thg_theme as Record<string, unknown> | undefined) ?? {}),
            cover_picture: {
              backward_compatibility: pictureBackwardCompat,
              item_id: itemId,
            },
          };

          await this.context.strategy.setCollectionExtra(
            collectionId,
            JSON.stringify({ ...existingExtra, thg_theme: themeExtra })
          );

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Theme cover ${coverKey}: ${message}`);
          this.logError(`Theme cover ${coverKey}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ThgThemeCoverImageImporter', message);
    }

    return result;
  }
}
