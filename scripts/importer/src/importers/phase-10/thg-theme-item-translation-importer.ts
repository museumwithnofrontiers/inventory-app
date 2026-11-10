/**
 * THG Theme Item Translation Importer
 *
 * Stores theme_item_i18n contextual descriptions and image captions on the collection_item
 * pivot extra field, grouped by language. Does NOT write item_translations — this text is
 * written for the exhibition and describes the selected picture within that one theme, not
 * the item itself.
 *
 * Legacy schema:
 * - mwnf3_thematic_gallery.theme_item_i18n (gallery_id, theme_id, item_id, language_id,
 *                                           contextual_description, image_caption)
 *
 * New schema:
 * - collection_item.extra (JSON) — merged fields:
 *     { "contextual_descriptions": { "eng": "...", "fra": "..." },
 *       "image_captions":          { "eng": "...", "fra": "..." } }
 *
 * Context: Uses the theme collection (ThgThemeImporter BC) for the collection_item lookup.
 * The item is resolved to the selected picture child item via the shared resolver.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  resolvePictureItemBackwardCompatibility,
  themeItemSelectColumns,
} from './thg-theme-item-resolver.js';
import type { LegacyThemeItem } from './thg-theme-item-resolver.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';

/**
 * Legacy theme_item_i18n structure
 */
interface LegacyThemeItemI18n {
  gallery_id: number;
  theme_id: number;
  item_id: number;
  language_id: string; // 2-letter code
  contextual_description: string | null;
  image_caption: string | null;
}

interface LegacyThemeItemRow extends LegacyThemeItem {
  gallery_id: number;
  theme_id: number;
  item_id: number;
}

export class ThgThemeItemTranslationImporter extends BaseImporter {
  // Cache theme_item data for item resolution
  private themeItemCache: Map<string, LegacyThemeItemRow> = new Map();

  getName(): string {
    return 'ThgThemeItemTranslationImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Loading theme_item data for item resolution...');

      // Load theme_item data to resolve item references
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

      this.logInfo(
        'Importing contextual item descriptions and image captions from theme_item_i18n into collection_item.extra...'
      );

      // Query translations from legacy database
      const translations = await this.context.legacyDb.query<LegacyThemeItemI18n>(
        `SELECT gallery_id, theme_id, item_id, language_id, contextual_description, image_caption
         FROM mwnf3_thematic_gallery.theme_item_i18n
         WHERE (contextual_description IS NOT NULL AND contextual_description != '')
            OR (image_caption IS NOT NULL AND image_caption != '')
         ORDER BY gallery_id, theme_id, item_id, language_id`
      );

      this.logInfo(`Found ${translations.length} contextual item descriptions to import`);

      // Group by (gallery_id, theme_id, item_id) to process all languages at once
      type GroupKey = string;
      const grouped = new Map<GroupKey, LegacyThemeItemI18n[]>();
      for (const row of translations) {
        const key = `${row.gallery_id}.${row.theme_id}.${row.item_id}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.push(row);
        } else {
          grouped.set(key, [row]);
        }
      }

      for (const [groupKey, rows] of grouped) {
        const first = rows[0];
        try {
          const themeItem = this.themeItemCache.get(groupKey);
          if (!themeItem) {
            result.warnings = result.warnings || [];
            result.warnings.push(`Theme item ${groupKey}: theme_item record not found, skipping`);
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Resolve the theme collection BC
          const themeBC = `mwnf3_thematic_gallery:theme:${first.gallery_id}:${first.theme_id}`;
          const collectionId = await this.getEntityUuidAsync(themeBC, 'collection');
          if (!collectionId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Theme item ${groupKey}: theme collection not found (${themeBC}), skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Resolve to the selected picture item backward-compatibility key
          const itemBackwardCompat = resolvePictureItemBackwardCompatibility(themeItem);
          if (!itemBackwardCompat) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Theme item ${groupKey}: no picture reference in any source family, skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
          if (!itemId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Theme item ${groupKey}: picture item not found (${itemBackwardCompat}), skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Build the contextual_descriptions, image_captions and source_bc_by_language
          // maps keyed by ISO-3 language ID
          const contextualDescriptions: Record<string, string> = {};
          const imageCaptions: Record<string, string> = {};
          const sourceBcByLanguage: Record<string, string> = {};
          let validLanguageCount = 0;
          for (const row of rows) {
            if (!row.language_id) {
              result.warnings = result.warnings || [];
              result.warnings.push(
                `Theme item ${groupKey}: translation row has no language value (table: theme_item_i18n, pk: gallery_id=${row.gallery_id}, theme_id=${row.theme_id}, item_id=${row.item_id}, language_id=${row.language_id}), skipping language`
              );
              continue;
            }
            const languageId = await this.getLanguageIdByLegacyCodeAsync(row.language_id);
            if (!languageId) {
              result.warnings = result.warnings || [];
              result.warnings.push(
                `Theme item ${groupKey}: unknown language '${row.language_id}', skipping language`
              );
              continue;
            }
            if (!row.contextual_description && !row.image_caption) {
              continue;
            }
            if (row.contextual_description) {
              contextualDescriptions[languageId] = convertHtmlToMarkdown(row.contextual_description);
            }
            if (row.image_caption) {
              imageCaptions[languageId] = convertHtmlToMarkdown(row.image_caption);
            }
            sourceBcByLanguage[languageId] = `mwnf3_thematic_gallery:theme_item_i18n:${row.gallery_id}:${row.theme_id}:${row.item_id}:${row.language_id}`;
            validLanguageCount++;
          }

          if (validLanguageCount === 0) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          this.collectSample(
            'thg_theme_item_translation',
            {
              ...first,
              resolved_item_backward_compat: itemBackwardCompat,
              resolved_collection_id: collectionId,
            } as unknown as Record<string, unknown>,
            'success'
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would update collection_item.extra: collection=${collectionId} item=${itemId} (${validLanguageCount} languages)`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          // Read existing extra and merge contextual_descriptions and source_bc_by_language into it
          const existingExtra =
            await this.context.strategy.getCollectionItemExtra(collectionId, itemId);
          const mergedExtra: Record<string, unknown> = existingExtra ?? {};
          if (Object.keys(contextualDescriptions).length > 0) {
            mergedExtra.contextual_descriptions = contextualDescriptions;
          }
          if (Object.keys(imageCaptions).length > 0) {
            mergedExtra.image_captions = imageCaptions;
          }
          mergedExtra.source_bc_by_language = sourceBcByLanguage;

          await this.context.strategy.setCollectionItemExtra(
            collectionId,
            itemId,
            JSON.stringify(mergedExtra)
          );

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Theme item ${groupKey}: ${message}`);
          this.logError(`Theme item ${groupKey}`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ThgThemeItemTranslationImporter', message);
    }

    return result;
  }
}
