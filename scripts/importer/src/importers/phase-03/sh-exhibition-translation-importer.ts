/**
 * SH Exhibition Translation Importer
 *
 * Imports translations for all 3 levels of the SH exhibition hierarchy:
 * - sh_exhibitionnames → CollectionTranslation for exhibitions
 * - sh_exhibition_themenames → CollectionTranslation for themes
 * - sh_exhibition_subthemenames → CollectionTranslation for subthemes
 *
 * Legacy schema (mwnf3_sharing_history):
 * - sh_exhibitionnames (exhibition_id, lang, title, subtitle, introduction, see_also_links,
 *   further_reading, curated_by, cover_images)
 * - sh_exhibition_themenames (theme_id, lang, title, introduction, see_also_links, further_reading)
 * - sh_exhibition_subthemenames (subtheme_id, lang, title, introduction, quotation,
 *   see_also_links, further_reading)
 *
 * New schema:
 * - collection_translations (collection_id, language_id, context_id, title, description, quote,
 *   extra, backward_compatibility)
 *
 * Each legacy column stays its own field: the introduction is the description,
 * a subtheme's quotation its quote, and the columns the model has no field for
 * keep their legacy names in `extra` (registered in scripts/importer/EXTRA.md).
 *
 * Dependencies:
 * - ShExhibitionImporter (must run first to create exhibition/theme/subtheme collections)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import type {
  ShLegacyExhibitionName,
  ShLegacyExhibitionThemeName,
  ShLegacyExhibitionSubthemeName,
} from '../../domain/types/index.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';

const SH_SCHEMA = 'mwnf3_sharing_history';

function markdownOrNull(html: string | null | undefined): string | null {
  return html && html.trim() ? convertHtmlToMarkdown(html) : null;
}

/** The legacy columns given, as Markdown under their own names; null when all are empty. */
export function extraOf(columns: Record<string, string | null | undefined>): string | null {
  const extra: Record<string, string> = {};
  for (const [name, html] of Object.entries(columns)) {
    const markdown = markdownOrNull(html);
    if (markdown) extra[name] = markdown;
  }
  return Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;
}

export class ShExhibitionTranslationImporter extends BaseImporter {
  getName(): string {
    return 'ShExhibitionTranslationImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing SH exhibition translations...');

      // ========================================================================
      // Pass 1: Exhibition translations
      // ========================================================================
      const exhibitionNames = await this.context.legacyDb.query<ShLegacyExhibitionName>(
        `SELECT exhibition_id, lang, title, subtitle, introduction,
                see_also_links, further_reading, curated_by, cover_images
         FROM ${SH_SCHEMA}.sh_exhibitionnames
         ORDER BY exhibition_id, lang`
      );

      this.logInfo(`Found ${exhibitionNames.length} exhibition translations`);

      for (const legacy of exhibitionNames) {
        try {
          const languageId = await this.getLanguageIdByLegacyCodeAsync(legacy.lang);
          if (!languageId) {
            this.logWarning(
              `Exhibition ${legacy.exhibition_id}: Unknown language code '${legacy.lang}', skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibitions:${legacy.exhibition_id}`;
          const backwardCompat = `${SH_SCHEMA}:sh_exhibitionnames:${legacy.exhibition_id}:${legacy.lang}`;

          if (await this.entityExistsAsync(backwardCompat, 'collection_translation')) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const collectionId = await this.getEntityUuidAsync(
            collectionBackwardCompat,
            'collection'
          );
          if (!collectionId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Exhibition translation ${legacy.exhibition_id}/${legacy.lang}: Collection not found`
            );
            this.logWarning(
              `Exhibition translation ${legacy.exhibition_id}/${legacy.lang}: Collection not found (${collectionBackwardCompat}), skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const contextId = await this.resolveContextForExhibition(legacy.exhibition_id);
          if (!contextId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Exhibition translation ${legacy.exhibition_id}/${legacy.lang}: Context not found`
            );
            this.logWarning(
              `Exhibition translation ${legacy.exhibition_id}/${legacy.lang}: Context not found, skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const title = legacy.title || `Exhibition ${legacy.exhibition_id}`;
          const description = markdownOrNull(legacy.introduction);
          const extra = extraOf({
            subtitle: legacy.subtitle,
            curated_by: legacy.curated_by,
            cover_images: legacy.cover_images,
            further_reading: legacy.further_reading,
            see_also_links: legacy.see_also_links,
          });

          this.collectSample(
            'sh_exhibition_translation',
            legacy as unknown as Record<string, unknown>,
            'success',
            undefined,
            languageId
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create exhibition translation: ${title} (${backwardCompat})`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeCollectionTranslation({
            collection_id: collectionId,
            language_id: languageId,
            context_id: contextId,
            title,
            description,
            extra,
            backward_compatibility: backwardCompat,
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Exhibition translation ${legacy.exhibition_id}/${legacy.lang}: ${message}`
          );
          this.logError(`Exhibition translation ${legacy.exhibition_id}/${legacy.lang}`, message);
          this.showError();
        }
      }

      this.logInfo(`Exhibition translations done: ${result.imported} imported`);

      // ========================================================================
      // Pass 2: Theme translations
      // ========================================================================
      const themeNames = await this.context.legacyDb.query<ShLegacyExhibitionThemeName>(
        `SELECT theme_id, lang, title, introduction, see_also_links, further_reading
         FROM ${SH_SCHEMA}.sh_exhibition_themenames
         ORDER BY theme_id, lang`
      );

      this.logInfo(`Found ${themeNames.length} theme translations`);
      let themesImported = 0;

      for (const legacy of themeNames) {
        try {
          const languageId = await this.getLanguageIdByLegacyCodeAsync(legacy.lang);
          if (!languageId) {
            this.logWarning(
              `Theme ${legacy.theme_id}: Unknown language code '${legacy.lang}', skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibition_themes:${legacy.theme_id}`;
          const backwardCompat = `${SH_SCHEMA}:sh_exhibition_themenames:${legacy.theme_id}:${legacy.lang}`;

          if (await this.entityExistsAsync(backwardCompat, 'collection_translation')) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const collectionId = await this.getEntityUuidAsync(
            collectionBackwardCompat,
            'collection'
          );
          if (!collectionId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Theme translation ${legacy.theme_id}/${legacy.lang}: Collection not found`
            );
            this.logWarning(
              `Theme translation ${legacy.theme_id}/${legacy.lang}: Collection not found (${collectionBackwardCompat}), skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const contextId = await this.resolveContextForTheme(legacy.theme_id);
          if (!contextId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Theme translation ${legacy.theme_id}/${legacy.lang}: Context not found`
            );
            this.logWarning(
              `Theme translation ${legacy.theme_id}/${legacy.lang}: Context not found, skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const title = legacy.title || `Theme ${legacy.theme_id}`;
          const description = markdownOrNull(legacy.introduction);
          const extra = extraOf({
            further_reading: legacy.further_reading,
            see_also_links: legacy.see_also_links,
          });

          this.collectSample(
            'sh_exhibition_theme_translation',
            legacy as unknown as Record<string, unknown>,
            'success',
            undefined,
            languageId
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create theme translation: ${title} (${backwardCompat})`
            );
            themesImported++;
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeCollectionTranslation({
            collection_id: collectionId,
            language_id: languageId,
            context_id: contextId,
            title,
            description,
            extra,
            backward_compatibility: backwardCompat,
          });

          themesImported++;
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Theme translation ${legacy.theme_id}/${legacy.lang}: ${message}`);
          this.logError(`Theme translation ${legacy.theme_id}/${legacy.lang}`, message);
          this.showError();
        }
      }

      this.logInfo(`Theme translations done: ${themesImported} imported`);

      // ========================================================================
      // Pass 3: Subtheme translations
      // ========================================================================
      const subthemeNames = await this.context.legacyDb.query<ShLegacyExhibitionSubthemeName>(
        `SELECT subtheme_id, lang, title, introduction, quotation, see_also_links, further_reading
         FROM ${SH_SCHEMA}.sh_exhibition_subthemenames
         ORDER BY subtheme_id, lang`
      );

      this.logInfo(`Found ${subthemeNames.length} subtheme translations`);
      let subthemesImported = 0;

      for (const legacy of subthemeNames) {
        try {
          const languageId = await this.getLanguageIdByLegacyCodeAsync(legacy.lang);
          if (!languageId) {
            this.logWarning(
              `Subtheme ${legacy.subtheme_id}: Unknown language code '${legacy.lang}', skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const collectionBackwardCompat = `${SH_SCHEMA}:sh_exhibition_subthemes:${legacy.subtheme_id}`;
          const backwardCompat = `${SH_SCHEMA}:sh_exhibition_subthemenames:${legacy.subtheme_id}:${legacy.lang}`;

          if (await this.entityExistsAsync(backwardCompat, 'collection_translation')) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const collectionId = await this.getEntityUuidAsync(
            collectionBackwardCompat,
            'collection'
          );
          if (!collectionId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Subtheme translation ${legacy.subtheme_id}/${legacy.lang}: Collection not found`
            );
            this.logWarning(
              `Subtheme translation ${legacy.subtheme_id}/${legacy.lang}: Collection not found (${collectionBackwardCompat}), skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const contextId = await this.resolveContextForSubtheme(legacy.subtheme_id);
          if (!contextId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Subtheme translation ${legacy.subtheme_id}/${legacy.lang}: Context not found`
            );
            this.logWarning(
              `Subtheme translation ${legacy.subtheme_id}/${legacy.lang}: Context not found, skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const title = legacy.title || `Subtheme ${legacy.subtheme_id}`;
          const description = markdownOrNull(legacy.introduction);
          const quote = markdownOrNull(legacy.quotation);
          const extra = extraOf({
            further_reading: legacy.further_reading,
            see_also_links: legacy.see_also_links,
          });

          this.collectSample(
            'sh_exhibition_subtheme_translation',
            legacy as unknown as Record<string, unknown>,
            'success',
            undefined,
            languageId
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create subtheme translation: ${title} (${backwardCompat})`
            );
            subthemesImported++;
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeCollectionTranslation({
            collection_id: collectionId,
            language_id: languageId,
            context_id: contextId,
            title,
            description,
            quote,
            extra,
            backward_compatibility: backwardCompat,
          });

          subthemesImported++;
          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Subtheme translation ${legacy.subtheme_id}/${legacy.lang}: ${message}`
          );
          this.logError(`Subtheme translation ${legacy.subtheme_id}/${legacy.lang}`, message);
          this.showError();
        }
      }

      this.logInfo(`Subtheme translations done: ${subthemesImported} imported`);

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ShExhibitionTranslationImporter', message);
    }

    return result;
  }

  // In-memory caches for context resolution (populated lazily)
  private exhibitionProjectMap: Map<number, string> | null = null;
  private themeExhibitionMap: Map<number, number> | null = null;
  private subthemeThemeMap: Map<number, number> | null = null;

  /**
   * Resolve context ID for a given exhibition_id via its SH project.
   */
  private async resolveContextForExhibition(exhibitionId: number): Promise<string | null> {
    if (!this.exhibitionProjectMap) {
      const rows = await this.context.legacyDb.query<{ exhibition_id: number; project_id: string }>(
        `SELECT exhibition_id, project_id FROM ${SH_SCHEMA}.sh_exhibitions`
      );
      this.exhibitionProjectMap = new Map(rows.map((r) => [r.exhibition_id, r.project_id]));
    }

    const projectId = this.exhibitionProjectMap.get(exhibitionId);
    if (!projectId) return null;

    const projectBackwardCompat = `${SH_SCHEMA}:sh_projects:${projectId.toLowerCase()}`;
    return this.getEntityUuidAsync(projectBackwardCompat, 'context');
  }

  /**
   * Resolve context ID for a given theme_id by walking up: theme → exhibition → project.
   */
  private async resolveContextForTheme(themeId: number): Promise<string | null> {
    if (!this.themeExhibitionMap) {
      const rows = await this.context.legacyDb.query<{ theme_id: number; exhibition_id: number }>(
        `SELECT theme_id, exhibition_id FROM ${SH_SCHEMA}.sh_exhibition_themes`
      );
      this.themeExhibitionMap = new Map(rows.map((r) => [r.theme_id, r.exhibition_id]));
    }

    const exhibitionId = this.themeExhibitionMap.get(themeId);
    if (exhibitionId === undefined) return null;

    return this.resolveContextForExhibition(exhibitionId);
  }

  /**
   * Resolve context ID for a given subtheme_id by walking up: subtheme → theme → exhibition → project.
   */
  private async resolveContextForSubtheme(subthemeId: number): Promise<string | null> {
    if (!this.subthemeThemeMap) {
      const rows = await this.context.legacyDb.query<{ subtheme_id: number; theme_id: number }>(
        `SELECT subtheme_id, theme_id FROM ${SH_SCHEMA}.sh_exhibition_subthemes`
      );
      this.subthemeThemeMap = new Map(rows.map((r) => [r.subtheme_id, r.theme_id]));
    }

    const themeId = this.subthemeThemeMap.get(subthemeId);
    if (themeId === undefined) return null;

    return this.resolveContextForTheme(themeId);
  }
}
