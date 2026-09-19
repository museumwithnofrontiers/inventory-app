/**
 * Exhibition Logo Extra Backfill Importer
 *
 * Standalone, idempotent backfill of the sponsor-logo passenger data —
 * the hyperlink, the banner slot, the visibility flag and the per-language
 * captions — into `collection_images.extra`, plus the `image-type:logo` tag,
 * on a database imported before ThgGalleryContentImporter carried them.
 *
 * Why they were missing: `collection_images` had no `extra` column, so the
 * importer read `label`, `link`, `category_id`, `visible` and
 * `further_reading` off `exhibition_logo` and then threw them away, and never
 * read `exhibition_logo_i18n` (where the display caption actually lives — the
 * base row of gallery 47 says "UNAOC", the i18n row says "United Nations
 * Alliance of Civilizations", and the live API serves the latter) or the
 * `exhibition_logo_category` slot lookup at all. An exhibition data package
 * could ship the logo file and its order, and nothing else: no caption, no
 * hyperlink, no "Footer 2" placement.
 *
 * Scope and safety:
 * - Reads only the three legacy tables the importer now reads, and builds the
 *   payload with the very same `buildExhibitionLogoExtra()` helper the write
 *   path uses — a backfilled row is indistinguishable from a fresh one.
 * - Row identity is `(collection_id, legacy path)`: `collection_images` has no
 *   `backward_compatibility` column, and the main importer already uses that
 *   identity for its own skip detection.
 * - Merges into any existing `extra`, writing only keys that are currently
 *   unset — so a rerun is a no-op and this cannot clobber a fresh import, nor
 *   anything another step has put there.
 * - Attaches the logo tag where it is missing; `attachTagsToCollectionImage`
 *   is INSERT IGNORE, so re-attaching an existing tag is free.
 * - Touches `extra` and the tag pivot only. The path, alt_text and
 *   display_order the original import wrote are left exactly as they are.
 *
 * Run standalone with `--only exhibition-logo-extra-backfill`. It is a no-op
 * after a fresh full import. See museumwithnofrontiers/inventory-app#1592.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { TagHelper } from '../../helpers/tag-helper.js';
import {
  buildExhibitionLogoExtra,
  IMAGE_TYPE_TAG_CATEGORY,
  LOGO_TAG_NAME,
  type ExhibitionLogoExtraSource,
  type LegacyExhibitionLogoCategory,
  type LegacyExhibitionLogoI18n,
} from '../phase-10/thg-gallery-content-importer.js';

interface LegacyExhibitionLogoRow {
  logo_id: number;
  gallery_id: number;
  category_id: number | null;
  logo: string | null;
  label: string | null;
  alt: string | null;
  link: string | null;
  visible: string | null;
  further_reading: string | null;
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export class ExhibitionLogoExtraBackfillImporter extends BaseImporter {
  private tagHelper: TagHelper | null = null;

  getName(): string {
    return 'ExhibitionLogoExtraBackfillImporter';
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
      this.logInfo('Backfilling exhibition logo link/category/captions into extra...');

      const rows = await this.context.legacyDb.query<LegacyExhibitionLogoRow>(
        `SELECT logo_id, gallery_id, category_id, logo, label, alt, link, visible, further_reading
         FROM mwnf3_thematic_gallery.exhibition_logo
         ORDER BY gallery_id, logo_id`
      );
      this.logInfo(`Found ${rows.length} exhibition_logo row(s)`);
      if (rows.length === 0) {
        this.showSummary(result.imported, result.skipped, result.errors.length, 0);
        result.success = true;
        return result;
      }

      const i18nByLogoId = await this.loadTranslations(result);
      const categoryNames = await this.loadCategories(result);
      const defaultLanguageId = await this.getDefaultLanguageIdAsync();

      let logoTagId: string | null = null;
      if (!this.isDryRun && !this.isSampleOnlyMode) {
        logoTagId = await this.getTagHelper().findOrCreate(
          LOGO_TAG_NAME,
          IMAGE_TYPE_TAG_CATEGORY,
          defaultLanguageId
        );
        if (!logoTagId) {
          const warning = 'image-type:logo tag could not be resolved — logos will not be tagged';
          this.logWarning(warning);
          result.warnings.push(warning);
        }
      }

      for (const row of rows) {
        try {
          await this.backfillOne(
            row,
            i18nByLogoId.get(row.logo_id) ?? [],
            categoryNames,
            defaultLanguageId,
            logoTagId,
            result
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`exhibition_logo.logo_id=${row.logo_id}: ${message}`);
          this.logError(`exhibition_logo.logo_id=${row.logo_id}`, message);
          this.showError();
        }
      }

      this.showSummary(
        result.imported,
        result.skipped,
        result.errors.length,
        result.warnings.length
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to backfill exhibition logo extra: ${message}`);
      this.logError('ExhibitionLogoExtraBackfillImporter', message);
      this.showError();
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async backfillOne(
    row: LegacyExhibitionLogoRow,
    i18nRows: LegacyExhibitionLogoI18n[],
    categoryNames: Map<number, string>,
    defaultLanguageId: string,
    logoTagId: string | null,
    result: ImportResult
  ): Promise<void> {
    const key = `exhibition_logo.logo_id=${row.logo_id}`;

    const logoPath = trimToNull(row.logo);
    if (!logoPath) {
      const warning = `${key}: logo path is empty, skipping`;
      this.logWarning(warning);
      result.warnings.push(warning);
      result.skipped++;
      this.showSkipped();
      return;
    }

    const galleryBC = `mwnf3_thematic_gallery:thg_gallery:${row.gallery_id}`;
    const collectionId = await this.getEntityUuidAsync(galleryBC, 'collection');
    if (!collectionId) {
      const warning = `${key}: collection ${galleryBC} not found, skipping — run ThgGalleryImporter first`;
      this.logWarning(warning);
      result.warnings.push(warning);
      result.skipped++;
      this.showSkipped();
      return;
    }

    // `collection_images` has no backward_compatibility column — identity is
    // (collection_id, legacy path), and imageExists() returns the row's id.
    const collectionImageId = await this.context.strategy.imageExists(
      'collection_images',
      collectionId,
      logoPath
    );
    if (!collectionImageId) {
      const warning = `${key}: no collection image for '${logoPath}' on ${galleryBC}, skipping — run ThgGalleryContentImporter first`;
      this.logWarning(warning);
      result.warnings.push(warning);
      result.skipped++;
      this.showSkipped();
      return;
    }

    const translations = await this.resolveTranslations(row.logo_id, i18nRows, result);
    const built = buildExhibitionLogoExtra({
      link: row.link,
      categoryId: row.category_id,
      categoryName: row.category_id === null ? null : (categoryNames.get(row.category_id) ?? null),
      visible: row.visible,
      baseLabel: row.label,
      baseAlt: row.alt,
      baseFurtherReading: row.further_reading,
      defaultLanguageId,
      translations,
    } satisfies ExhibitionLogoExtraSource);

    const existing = await this.context.strategy.getCollectionImageExtra(collectionImageId);
    const missing = Object.keys(built).filter((field) => existing?.[field] === undefined);
    const needsTag = logoTagId !== null;

    // Nothing to write and nothing to tag — a rerun, or a database imported
    // after the fix.
    if (missing.length === 0 && !needsTag) {
      result.skipped++;
      this.showSkipped();
      return;
    }

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would add ${missing.join('/') || '(nothing)'} to the logo image of ${galleryBC} (${logoPath})`
      );
      result.imported++;
      this.showProgress();
      return;
    }

    if (logoTagId) {
      await this.getTagHelper().attachToCollectionImage(collectionImageId, [logoTagId]);
    }

    if (missing.length === 0) {
      result.skipped++;
      this.showSkipped();
      return;
    }

    const merged = { ...(existing ?? {}) };
    for (const field of missing) {
      merged[field] = built[field];
    }
    await this.context.strategy.setCollectionImageExtra(collectionImageId, JSON.stringify(merged));

    result.imported++;
    this.showProgress();
  }

  /**
   * Read the per-language captions, grouped by logo. A missing table is
   * tolerated the same way the base query tolerates one.
   */
  private async loadTranslations(
    result: ImportResult
  ): Promise<Map<number, LegacyExhibitionLogoI18n[]>> {
    let rows: LegacyExhibitionLogoI18n[];
    try {
      rows = await this.context.legacyDb.query<LegacyExhibitionLogoI18n>(
        `SELECT logo_id, language_id, label, alt, further_reading
         FROM mwnf3_thematic_gallery.exhibition_logo_i18n
         ORDER BY logo_id, language_id`
      );
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : String(queryError);
      if (message.includes("doesn't exist") || message.includes('Table')) {
        this.logWarning(`exhibition_logo_i18n table not available: ${message}`);
        result.warnings.push(
          `exhibition_logo_i18n table not available: ${message}; logo captions skipped`
        );
        return new Map();
      }
      throw queryError;
    }

    const byLogoId = new Map<number, LegacyExhibitionLogoI18n[]>();
    for (const row of rows) {
      const existing = byLogoId.get(row.logo_id) ?? [];
      existing.push(row);
      byLogoId.set(row.logo_id, existing);
    }
    return byLogoId;
  }

  private async loadCategories(result: ImportResult): Promise<Map<number, string>> {
    let rows: LegacyExhibitionLogoCategory[];
    try {
      rows = await this.context.legacyDb.query<LegacyExhibitionLogoCategory>(
        `SELECT category_id, name, description
         FROM mwnf3_thematic_gallery.exhibition_logo_category
         ORDER BY category_id`
      );
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : String(queryError);
      if (message.includes("doesn't exist") || message.includes('Table')) {
        this.logWarning(`exhibition_logo_category table not available: ${message}`);
        result.warnings.push(
          `exhibition_logo_category table not available: ${message}; logo category names skipped`
        );
        return new Map();
      }
      throw queryError;
    }

    const names = new Map<number, string>();
    for (const row of rows) {
      const name = trimToNull(row.name);
      if (name !== null) {
        names.set(row.category_id, name);
      }
    }
    return names;
  }

  /**
   * Map legacy 2-char language codes onto the inventory's 3-char ids. A code
   * that does not resolve is warned about and dropped — never thrown.
   */
  private async resolveTranslations(
    logoId: number,
    rows: LegacyExhibitionLogoI18n[],
    result: ImportResult
  ): Promise<ExhibitionLogoExtraSource['translations']> {
    const translations: ExhibitionLogoExtraSource['translations'] = [];
    for (const row of rows) {
      const sourceLanguage = trimToNull(row.language_id);
      if (!sourceLanguage) {
        const warning = `exhibition_logo_i18n.logo_id=${logoId}: language_id is empty, skipping caption`;
        this.logWarning(warning);
        result.warnings.push(warning);
        continue;
      }

      const languageId = await this.getLanguageIdByLegacyCodeAsync(sourceLanguage);
      if (!languageId) {
        const warning = `exhibition_logo_i18n.logo_id=${logoId}: unknown language '${sourceLanguage}', skipping caption`;
        this.logWarning(warning);
        result.warnings.push(warning);
        continue;
      }

      translations.push({
        languageId,
        label: row.label,
        alt: row.alt,
        furtherReading: row.further_reading,
      });
    }
    return translations;
  }
}
