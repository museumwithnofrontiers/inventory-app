/**
 * THG Item Related Importer
 *
 * Imports theme_item_related entries as ItemItemLink records.
 * Creates links between selected picture items within a gallery context.
 *
 * Legacy schema:
 * - mwnf3_thematic_gallery.theme_item_related (gallery_id, theme_id, item_id,
 *                                              related_gallery_id, related_theme_id, related_item_id)
 *
 * New schema:
 * - item_item_links (id, source_id, target_id, context_id)
 *
 * Context: Uses the SOURCE gallery's context (created by ThgGalleryContextImporter) —
 * the link is authored in the source exhibition even when it points at a picture in
 * another one.
 * Source and target items are resolved to selected picture child items via the shared resolver.
 *
 * The backward-compatibility key stays (gallery, theme, item, related_item): that
 * combination is unique across the legacy table, so keys of already-imported links
 * — and the translations that look them up — are unaffected.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  resolvePictureItemBackwardCompatibility,
  themeItemSelectColumns,
} from './thg-theme-item-resolver.js';
import type { LegacyThemeItem } from './thg-theme-item-resolver.js';

/**
 * Legacy theme_item_related structure
 *
 * The target is addressed by its own (related_gallery_id, related_theme_id,
 * related_item_id) triple — a related picture may live in another theme, and in
 * three rows even in another exhibition.
 */
interface LegacyThemeItemRelated {
  gallery_id: number;
  theme_id: number;
  item_id: number;
  related_gallery_id: number | null;
  related_theme_id: number | null;
  related_item_id: number;
}

interface LegacyThemeItemRow extends LegacyThemeItem {
  gallery_id: number;
  theme_id: number;
  item_id: number;
}

export class ThgItemRelatedImporter extends BaseImporter {
  // Cache theme_item data for item resolution
  private themeItemCache: Map<string, LegacyThemeItemRow> = new Map();

  getName(): string {
    return 'ThgItemRelatedImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Loading theme_item data for item resolution...');

      // Load theme_item data to resolve item references
      // Note: The legacy schema may not have this table - handle gracefully
      try {
        const themeItems = await this.context.legacyDb.query<LegacyThemeItemRow>(
          `SELECT gallery_id, theme_id, item_id,
                  ${await themeItemSelectColumns(this.context.legacyDb)}
           FROM mwnf3_thematic_gallery.theme_item`
        );

        for (const item of themeItems) {
          const key = `${item.gallery_id}.${item.theme_id}.${item.item_id}`;
          this.themeItemCache.set(key, item);
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

      this.logInfo('Importing item-item links from theme_item_related...');

      // Query related items from legacy database
      const relatedItems = await this.context.legacyDb.query<LegacyThemeItemRelated>(
        `SELECT gallery_id, theme_id, item_id,
                related_gallery_id, related_theme_id, related_item_id
         FROM mwnf3_thematic_gallery.theme_item_related
         ORDER BY gallery_id, theme_id, item_id, related_item_id`
      );

      this.logInfo(`Found ${relatedItems.length} item-item relations to import`);

      for (const legacy of relatedItems) {
        try {
          // Get theme_item for source item resolution
          const sourceKey = `${legacy.gallery_id}.${legacy.theme_id}.${legacy.item_id}`;
          const sourceThemeItem = this.themeItemCache.get(sourceKey);
          if (!sourceThemeItem) {
            result.warnings = result.warnings || [];
            result.warnings.push(`Item relation ${sourceKey}: source theme_item not found`);
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Get theme_item for target (related) item resolution.
          // The target is addressed by the related row's own gallery/theme, which
          // is not always the source's — 8 rows point at another theme, 3 of them
          // at another exhibition.
          const targetGalleryId = legacy.related_gallery_id ?? legacy.gallery_id;
          const targetThemeId = legacy.related_theme_id ?? legacy.theme_id;
          const targetKey = `${targetGalleryId}.${targetThemeId}.${legacy.related_item_id}`;
          const targetThemeItem = this.themeItemCache.get(targetKey);
          if (!targetThemeItem) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Item relation ${sourceKey}: target theme_item not found (${targetKey})`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Resolve source picture item reference
          const sourceBackwardCompat = resolvePictureItemBackwardCompatibility(sourceThemeItem);
          if (!sourceBackwardCompat) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Item relation ${sourceKey}: source theme_item has no picture reference in any source family`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Resolve target picture item reference
          const targetBackwardCompat = resolvePictureItemBackwardCompatibility(targetThemeItem);
          if (!targetBackwardCompat) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Item relation ${sourceKey}: target theme_item has no picture reference in any source family`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Get the source picture item ID from tracker or database
          const sourceId = await this.getEntityUuidAsync(sourceBackwardCompat, 'item');
          if (!sourceId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Item relation ${sourceKey}: Source picture item not found (${sourceBackwardCompat})`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Get the target picture item ID from tracker or database
          const targetId = await this.getEntityUuidAsync(targetBackwardCompat, 'item');
          if (!targetId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Item relation ${sourceKey}: Target picture item not found (${targetBackwardCompat})`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Get the context ID for this gallery (Phase 10 internal, but use async for consistency)
          const galleryBackwardCompat = `mwnf3_thematic_gallery:thg_gallery:${legacy.gallery_id}`;
          const contextId = await this.getEntityUuidAsync(galleryBackwardCompat, 'context');
          if (!contextId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Item relation ${sourceKey}: Context not found for gallery ${legacy.gallery_id}`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Create backward compatibility key for the link
          const backwardCompat = `mwnf3_thematic_gallery:theme_item_related:${legacy.gallery_id}:${legacy.theme_id}:${legacy.item_id}:${legacy.related_item_id}`;

          // Check if already exists (use async for database fallback)
          if (await this.entityExistsAsync(backwardCompat, 'item_item_link')) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Collect sample
          this.collectSample(
            'thg_item_related',
            {
              ...legacy,
              source_backward_compat: sourceBackwardCompat,
              target_backward_compat: targetBackwardCompat,
            } as unknown as Record<string, unknown>,
            'success'
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create item link: ${backwardCompat}`
            );
            this.registerEntity('', backwardCompat, 'item_item_link');
            result.imported++;
            this.showProgress();
            continue;
          }

          // Write item-item link using strategy
          // Handle potential duplicates gracefully (skip if already exists due to unique constraint)
          try {
            const linkId = await this.context.strategy.writeItemItemLink({
              source_id: sourceId,
              target_id: targetId,
              context_id: contextId,
              backward_compatibility: backwardCompat,
            });

            this.registerEntity(linkId, backwardCompat, 'item_item_link');

            result.imported++;
            this.showProgress();
          } catch (writeError) {
            const errMsg = writeError instanceof Error ? writeError.message : String(writeError);
            // Check for duplicate entry error (unique constraint violation)
            if (errMsg.includes('Duplicate entry') || errMsg.includes('unique')) {
              this.logSkip(`Duplicate item-item link, skipping`);
              result.skipped++;
            } else {
              // Re-throw other errors
              throw writeError;
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Item relation ${legacy.gallery_id}.${legacy.theme_id}.${legacy.item_id}->${legacy.related_item_id}: ${message}`
          );
          this.logError(
            `Item relation ${legacy.gallery_id}.${legacy.theme_id}.${legacy.item_id}->${legacy.related_item_id}`,
            message
          );
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ThgItemRelatedImporter', message);
    }

    return result;
  }
}
