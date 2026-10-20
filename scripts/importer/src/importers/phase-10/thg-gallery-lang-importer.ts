/**
 * THG Gallery Lang Importer
 *
 * Imports thg_gallery_lang entries as CollectionTranslation records.
 * This covers base gallery/exhibition translations shared by both galleries and exhibitions.
 *
 * Legacy schema:
 * - mwnf3_thematic_gallery.thg_gallery_lang (gallery_id, lang, title, long_title, short_text,
 *                                             mouse_over_text, keywords)
 * - mwnf3_thematic_gallery.thg_gallery (gallery_id, link, image, banner_image, banner_item,
 *                                        new_expire_date, landing_url, portal_image, live_date,
 *                                        homepage_image, homepage_item, has_timeline,
 *                                        has_country_timeline, featured, mwnf3_project_id)
 *
 * `thg_gallery.status` (live/hidden) is not imported: it is the old sites'
 * runtime state, not curatorial data. A gallery with no website is hidden.
 *
 * New schema:
 * - collection_translations (id, collection_id, language_id, context_id, title, description,
 *                             extra, backward_compatibility)
 *
 * extra shape:
 * {
 *   "thg_gallery":      { <non-empty source fields without direct target columns> },
 *   "thg_gallery_lang": { "mouse_over_text": "...", "keywords": "..." }   // when non-empty
 * }
 *
 * has_timeline and has_country_timeline are MySQL bit(1) columns and are stored
 * as JSON booleans — see bitToBoolean.
 *
 * The gallery's identity attributes (mwnf3 project code, slug, canonical host)
 * are NOT stored here: they belong to the gallery, not to one of its languages,
 * and ThgGalleryImporter writes them to collections.extra.thg_gallery.
 *
 * This importer runs for ALL thg_gallery rows (both galleries and exhibitions).
 * Exhibition-specific extra data from exhibition_i18n is handled by ThgGalleryTranslationImporter.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { bitToBoolean } from '../../utils/legacy-values.js';

/**
 * Legacy thg_gallery_lang structure
 * PK: (gallery_id, lang)
 */
interface LegacyThgGalleryLang {
  gallery_id: number;
  lang: string; // 2-char language code
  title: string | null;
  long_title: string | null;
  short_text: string | null;
  mouse_over_text: string | null;
  keywords: string | null;
}

/**
 * Extra gallery fields from thg_gallery that don't map to collection columns.
 */
interface LegacyThgGalleryExtra {
  gallery_id: number;
  link: string | null;
  image: string | null;
  banner_image: string | null;
  banner_item: number | null;
  new_expire_date: string | null;
  landing_url: string | null;
  portal_image: string | null;
  live_date: string | null;
  homepage_image: string | null;
  homepage_item: number | null;
  /** MySQL bit(1) — mysql2 hands these back as Buffers, see bitToBoolean. */
  has_timeline: unknown;
  has_country_timeline: unknown;
  featured: number | null;
  mwnf3_project_id: string | null;
}

/** thg_gallery columns that are MySQL bit(1) and must be stored as booleans. */
const GALLERY_BIT_FIELDS = ['has_timeline', 'has_country_timeline'] as const;

export class ThgGalleryLangImporter extends BaseImporter {
  /** gallery_id -> extra fields from thg_gallery */
  private galleryExtraMap: Map<number, LegacyThgGalleryExtra> = new Map();

  getName(): string {
    return 'ThgGalleryLangImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing gallery base translations from thg_gallery_lang...');

      // Load thg_gallery extra fields for preservation in translation.extra
      await this.loadGalleryExtras();

      // Query base gallery translations including mouse_over_text and keywords
      const rows = await this.context.legacyDb.query<LegacyThgGalleryLang>(
        `SELECT gallery_id, lang, title, long_title, short_text, mouse_over_text, keywords
         FROM mwnf3_thematic_gallery.thg_gallery_lang
         ORDER BY gallery_id, lang`
      );

      this.logInfo(`Found ${rows.length} gallery lang rows to import`);

      for (const legacy of rows) {
        try {
          if (!legacy.lang) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Gallery ${legacy.gallery_id}: translation row has no language value (table: thg_gallery_lang, pk: gallery_id=${legacy.gallery_id}, lang=${legacy.lang}), skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const languageId = await this.getLanguageIdByLegacyCodeAsync(legacy.lang);
          if (!languageId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Gallery ${legacy.gallery_id}: unknown language '${legacy.lang}' in thg_gallery_lang`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const galleryBackwardCompat = `mwnf3_thematic_gallery:thg_gallery:${legacy.gallery_id}`;
          const backwardCompat = `mwnf3_thematic_gallery:thg_gallery_lang:${legacy.gallery_id}:${legacy.lang}`;

          if (await this.entityExistsAsync(backwardCompat, 'collection_translation')) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const collectionId = await this.getEntityUuidAsync(galleryBackwardCompat, 'collection');
          if (!collectionId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Gallery ${legacy.gallery_id}: collection not found — run ThgGalleryImporter first`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const contextId = await this.getEntityUuidAsync(galleryBackwardCompat, 'context');
          if (!contextId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Gallery ${legacy.gallery_id}: context not found — run ThgGalleryContextImporter first`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const title = legacy.title || `Gallery ${legacy.gallery_id}`;

          const descriptionParts: string[] = [];
          if (legacy.long_title) descriptionParts.push(legacy.long_title);
          if (legacy.short_text) descriptionParts.push(legacy.short_text);
          const description = descriptionParts.join('\n\n') || null;

          // Build extra object
          const extra = this.buildExtra(legacy);

          // Check for existing translation by (collectionId, languageId, contextId) key — idempotent update
          const existingTranslation = await this.context.strategy.getCollectionTranslationByKey(
            collectionId,
            languageId,
            contextId
          );
          if (existingTranslation) {
            if (extra && !this.isDryRun && !this.isSampleOnlyMode) {
              // Merge: new keys are added, existing keys are NOT overwritten
              const merged = { ...extra, ...(existingTranslation.extra ?? {}) };
              await this.context.strategy.setCollectionTranslationExtraByKey(
                collectionId,
                languageId,
                contextId,
                JSON.stringify(merged)
              );
            }
            result.skipped++;
            this.showSkipped();
            continue;
          }

          this.collectSample(
            'thg_gallery_lang',
            legacy as unknown as Record<string, unknown>,
            'success',
            undefined,
            languageId
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create gallery lang translation: ${title} (${backwardCompat})`
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
            extra: extra ? JSON.stringify(extra) : null,
            backward_compatibility: backwardCompat,
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Gallery ${legacy.gallery_id} (${legacy.lang}): ${message}`
          );
          this.logError(`Gallery ${legacy.gallery_id} (${legacy.lang})`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ThgGalleryLangImporter', message);
    }

    return result;
  }

  /**
   * Load thg_gallery extra fields (those without direct collection columns) into galleryExtraMap.
   */
  private async loadGalleryExtras(): Promise<void> {
    try {
      const rows = await this.context.legacyDb.query<LegacyThgGalleryExtra>(
        `SELECT gallery_id, link, image, banner_image, banner_item, new_expire_date,
                landing_url, portal_image, live_date, homepage_image, homepage_item,
                has_timeline, has_country_timeline, featured, mwnf3_project_id
         FROM mwnf3_thematic_gallery.thg_gallery`
      );
      for (const row of rows) {
        this.galleryExtraMap.set(row.gallery_id, row);
      }
      this.logInfo(`Loaded ${this.galleryExtraMap.size} thg_gallery extra records`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logWarning(`Failed to load thg_gallery extras: ${msg}`);
    }
  }

  /**
   * Build the extra JSON object for a collection translation row.
   * Includes thg_gallery fields (non-empty) and thg_gallery_lang optional fields.
   */
  private buildExtra(lang: LegacyThgGalleryLang): Record<string, unknown> | null {
    const obj: Record<string, unknown> = {};

    // thg_gallery extra fields
    const galleryRow = this.galleryExtraMap.get(lang.gallery_id);
    if (galleryRow) {
      const galleryExtra: Record<string, unknown> = {};
      // `link` and `mwnf3_project_id` are deliberately absent: they identify the
      // gallery, not one of its languages, and ThgGalleryImporter now writes them
      // to collections.extra.thg_gallery as a first-class anchor.
      const galleryFields: Array<keyof LegacyThgGalleryExtra> = [
        'image', 'banner_image', 'banner_item', 'new_expire_date',
        'landing_url', 'portal_image', 'live_date', 'homepage_image', 'homepage_item',
        'has_timeline', 'has_country_timeline', 'featured',
      ];
      for (const field of galleryFields) {
        const isBitField = (GALLERY_BIT_FIELDS as readonly string[]).includes(field);
        const val = isBitField ? bitToBoolean(galleryRow[field]) : galleryRow[field];
        if (val !== null && val !== undefined && val !== '') {
          galleryExtra[field] = val;
        }
      }
      if (Object.keys(galleryExtra).length > 0) {
        obj.thg_gallery = galleryExtra;
      }
    }

    // thg_gallery_lang optional fields
    const langExtra: Record<string, unknown> = {};
    if (lang.mouse_over_text) langExtra.mouse_over_text = lang.mouse_over_text;
    if (lang.keywords) langExtra.keywords = lang.keywords;
    if (Object.keys(langExtra).length > 0) {
      obj.thg_gallery_lang = langExtra;
    }

    return Object.keys(obj).length > 0 ? obj : null;
  }
}
