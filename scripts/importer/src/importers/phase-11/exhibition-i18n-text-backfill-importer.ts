/**
 * Exhibition i18n Text Backfill Importer
 *
 * Standalone, idempotent backfill of the three curated exhibition texts —
 * `subtitle`, `heading` and `about` — into
 * `collection_translations.extra.exhibition_i18n`, on a database imported
 * before ThgGalleryTranslationImporter preserved them.
 *
 * Why they were missing: the importer joined all three into the single
 * `collection_translations.description` with a blank line between them. That is
 * fine for a "one body of text" consumer and lossy for everyone else — `about`
 * contains blank lines of its own, so the join cannot be reversed by splitting.
 * The legacy exhibition sheet renders the three in three different places (the
 * sub-title under the title, the headline in the banner, the About page body),
 * and the live API returns them as three separate fields
 * (`exhibitionSubtitle` / `exhibitionHeadline` / `exhibitionAbout`), so an
 * exhibition data package cannot reproduce the site without them.
 *
 * Scope and safety:
 * - Reads only `mwnf3_thematic_gallery.exhibition_i18n`, the same source row
 *   the original importer read, so the values are identical to a fresh import.
 * - Merges into the existing `extra`, preserving `thg_gallery` and every
 *   `exhibition_i18n` key already there (`enabled`, `popup_logo`, …).
 * - Skips a row whose three fields are all empty, and skips one whose
 *   `exhibition_i18n` block already carries all the non-empty ones — so a rerun
 *   is a no-op and this cannot clobber a fresh import.
 * - Touches `extra` only. Titles, descriptions and every other column are left
 *   exactly as the original import wrote them, including the joined
 *   `description`, which stays for existing consumers.
 *
 * Run standalone with `--only exhibition-i18n-text-backfill`. It is a no-op
 * after a fresh full import, because ThgGalleryTranslationImporter now writes
 * the three fields itself. See museumwithnofrontiers/inventory-app#1546.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

interface LegacyExhibitionTextRow {
  gallery_id: number;
  language_id: string;
  subtitle: string | null;
  heading: string | null;
  about: string | null;
}

/** The three fields this backfill is responsible for, legacy name → extra key. */
const TEXT_FIELDS = ['subtitle', 'heading', 'about'] as const;

export class ExhibitionI18nTextBackfillImporter extends BaseImporter {
  getName(): string {
    return 'ExhibitionI18nTextBackfillImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Backfilling exhibition_i18n subtitle/heading/about into extra...');

      const rows = await this.context.legacyDb.query<LegacyExhibitionTextRow>(
        `SELECT gallery_id, language_id, subtitle, heading, about
         FROM mwnf3_thematic_gallery.exhibition_i18n
         ORDER BY gallery_id, language_id`
      );
      this.logInfo(`Found ${rows.length} exhibition_i18n row(s)`);

      for (const row of rows) {
        const key = `${row.gallery_id}:${row.language_id}`;
        try {
          await this.backfillOne(key, row, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Exhibition ${key}: ${message}`);
          this.logError(`Exhibition ${key}`, message);
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
      result.errors.push(`Failed to backfill exhibition i18n texts: ${message}`);
      this.logError('ExhibitionI18nTextBackfillImporter', message);
      this.showError();
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async backfillOne(
    key: string,
    row: LegacyExhibitionTextRow,
    result: ImportResult
  ): Promise<void> {
    const texts: Record<string, string> = {};
    for (const field of TEXT_FIELDS) {
      const value = row[field]?.trim();
      if (value) texts[field] = value;
    }

    if (Object.keys(texts).length === 0) {
      result.skipped++;
      this.showSkipped();
      return;
    }

    const galleryBC = `mwnf3_thematic_gallery:thg_gallery:${row.gallery_id}`;
    const collectionId = await this.getEntityUuidAsync(galleryBC, 'collection');
    if (!collectionId) {
      const warning = `Exhibition ${key}: collection ${galleryBC} not found, skipping — run ThgGalleryImporter first`;
      this.logWarning(warning);
      result.warnings.push(warning);
      result.skipped++;
      this.showSkipped();
      return;
    }

    const languageId = await this.getLanguageIdByLegacyCodeAsync(row.language_id);
    if (!languageId) {
      const warning = `Exhibition ${key}: language '${row.language_id}' not found, skipping`;
      this.logWarning(warning);
      result.warnings.push(warning);
      result.skipped++;
      this.showSkipped();
      return;
    }

    const existing = await this.context.strategy.getCollectionTranslationExtra(
      collectionId,
      languageId
    );
    const exhibitionI18n = {
      ...((existing?.['exhibition_i18n'] as Record<string, unknown> | undefined) ?? {}),
    };

    // Already complete — a rerun, or a database imported after the fix.
    const missing = Object.keys(texts).filter(field => exhibitionI18n[field] === undefined);
    if (missing.length === 0) {
      result.skipped++;
      this.showSkipped();
      return;
    }

    for (const field of missing) {
      exhibitionI18n[field] = texts[field];
    }
    const merged = { ...(existing ?? {}), exhibition_i18n: exhibitionI18n };

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would add ${missing.join('/')} to ${galleryBC} (${languageId})`
      );
      result.imported++;
      this.showProgress();
      return;
    }

    await this.context.strategy.setCollectionTranslationExtra(
      collectionId,
      languageId,
      JSON.stringify(merged)
    );

    result.imported++;
    this.showProgress();
  }
}
