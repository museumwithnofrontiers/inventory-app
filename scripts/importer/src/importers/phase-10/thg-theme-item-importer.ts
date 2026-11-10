/**
 * THG Theme Item Importer
 *
 * Imports theme_item entries, linking selected picture items to theme collections
 * via the collection_item pivot.
 *
 * Each theme_item row references the specific selected image (picture child item),
 * not the parent object/monument/detail. This matches the legacy exhibition page
 * behaviour where a selected image URL is placed under the theme, not the parent
 * database entry.
 *
 * Legacy schema:
 * - mwnf3_thematic_gallery.theme_item (gallery_id, theme_id, item_id, various image reference columns)
 *
 * New schema:
 * - collection_item pivot (collection_id, item_id, display_order) via writeCollectionItem
 *   - collection_id = theme collection (mwnf3_thematic_gallery:theme:{gallery_id}:{theme_id})
 *   - item_id       = picture child item resolved from image-identity columns
 *   - display_order = legacy item_id (row order within the theme)
 *
 * Supported picture families (all resolve to picture child items):
 * - mwnf3 object pictures    → mwnf3:objects_pictures:…
 * - mwnf3 monument pictures  → mwnf3:monuments_pictures:…
 * - mwnf3 detail pictures    → mwnf3:monument_detail_pictures:…
 * - SH object pictures       → mwnf3_sharing_history:sh_object_images:…
 * - SH monument pictures     → mwnf3_sharing_history:sh_monument_images:…
 * - SH detail pictures       → mwnf3_sharing_history:sh_monument_detail_pictures:…
 * - Explore monument pics    → mwnf3_explore:monument_picture:…
 * - Travels monument pics    → mwnf3_travels:monument_picture:…
 *
 * Dependencies:
 * - ThgThemeImporter (must run first to create theme collections)
 * - Picture importers from phase-02/phase-03 (must run first to create picture items)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  resolvePictureItemBackwardCompatibility,
  themeItemSelectColumns,
} from './thg-theme-item-resolver.js';
import type { LegacyThemeItem } from './thg-theme-item-resolver.js';

interface LegacyThemeItemRow extends LegacyThemeItem {
  gallery_id: number;
  theme_id: number;
  item_id: number;
}

export class ThgThemeItemImporter extends BaseImporter {
  getName(): string {
    return 'ThgThemeItemImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing theme-item associations to theme collections...');

      // Query theme_item entries from legacy database
      // Note: The legacy schema may not have this table or may have different columns - handle gracefully
      let themeItems: LegacyThemeItemRow[];
      try {
        themeItems = await this.context.legacyDb.query<LegacyThemeItemRow>(
          `SELECT gallery_id, theme_id, item_id,
                  ${await themeItemSelectColumns(this.context.legacyDb)}
           FROM mwnf3_thematic_gallery.theme_item
           ORDER BY gallery_id, theme_id, item_id`
        );
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

      this.logInfo(`Found ${themeItems.length} theme-item associations to process`);

      let skippedUnresolvable = 0;
      let skippedNoItem = 0;
      let skippedNoTheme = 0;

      for (const legacy of themeItems) {
        try {
          // Resolve to the selected picture item backward-compatibility key
          const pictureBackwardCompat = resolvePictureItemBackwardCompatibility(legacy);

          if (!pictureBackwardCompat) {
            // Every legacy row belongs to a known family, so this means the row
            // carries no usable reference — worth reporting rather than hiding.
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Theme item ${legacy.gallery_id}.${legacy.theme_id}.${legacy.item_id}: no picture reference in any source family`
            );
            skippedUnresolvable++;
            continue;
          }

          // Get the picture item UUID
          const itemId = await this.getEntityUuidAsync(pictureBackwardCompat, 'item');
          if (!itemId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Theme item ${legacy.gallery_id}.${legacy.theme_id}.${legacy.item_id}: Picture item not found (${pictureBackwardCompat})`
            );
            skippedNoItem++;
            continue;
          }

          // Get the theme collection UUID
          const themeBackwardCompat = `mwnf3_thematic_gallery:theme:${legacy.gallery_id}:${legacy.theme_id}`;
          const themeCollectionId = await this.getEntityUuidAsync(
            themeBackwardCompat,
            'collection'
          );
          if (!themeCollectionId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Theme item ${legacy.gallery_id}.${legacy.theme_id}.${legacy.item_id}: Theme collection not found (${themeBackwardCompat})`
            );
            skippedNoTheme++;
            continue;
          }

          // Collect sample
          this.collectSample(
            'thg_theme_item',
            {
              ...legacy,
              resolved_picture_backward_compat: pictureBackwardCompat,
              resolved_theme_collection: themeBackwardCompat,
            } as unknown as Record<string, unknown>,
            'success'
          );

          if (!this.isDryRun && !this.isSampleOnlyMode) {
            // Write the collection-item link with display_order (= legacy item_id)
            await this.context.strategy.writeCollectionItem({
              collection_id: themeCollectionId,
              item_id: itemId,
              display_order: legacy.item_id,
            });
          }

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Theme item ${legacy.gallery_id}.${legacy.theme_id}.${legacy.item_id}: ${message}`
          );
          this.logError(
            `Theme item ${legacy.gallery_id}.${legacy.theme_id}.${legacy.item_id}`,
            message
          );
          this.showError();
        }
      }

      // Log skipped statistics
      if (skippedUnresolvable > 0) {
        this.logWarning(
          `Skipped ${skippedUnresolvable} items with no picture reference in any source family`
        );
      }
      if (skippedNoItem > 0) {
        this.logInfo(`Skipped ${skippedNoItem} items: picture item not found in tracker`);
      }
      if (skippedNoTheme > 0) {
        this.logInfo(`Skipped ${skippedNoTheme} items: theme collection not found`);
      }

      this.showSummary(
        result.imported,
        result.skipped + skippedUnresolvable + skippedNoItem + skippedNoTheme,
        result.errors.length
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ThgThemeItemImporter', message);
    }

    return result;
  }
}
