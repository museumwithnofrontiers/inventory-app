/**
 * THG Gallery Translation Importer (Exhibition-specific extras)
 *
 * Imports exhibition_i18n entries as CollectionTranslation records.
 * Only runs for galleries classified and validated as exhibitions.
 *
 * extra shape:
 * {
 *   "thg_gallery":     { <non-empty source fields without direct target columns> },
 *   "exhibition_i18n": { "enabled": "Y", "exh_img_caption": "...", ... }  // when non-empty
 * }
 *
 * Legacy schema:
 * - mwnf3_thematic_gallery.exhibition_i18n (gallery_id, language_id, title, subtitle, heading,
 *                                            about, enabled, exh_img_caption, popup_logo_show,
 *                                            popup_logo)
 * - mwnf3_thematic_gallery.thg_gallery (extra fields)
 *
 * New schema:
 * - collection_translations (id, collection_id, language_id, context_id, title, description,
 *                             extra, backward_compatibility)
 *
 * Note: Base gallery/exhibition titles come from thg_gallery_lang (ThgGalleryLangImporter).
 *       This importer handles only exhibition-specific enrichment from exhibition_i18n.
 *
 * has_timeline and has_country_timeline are MySQL bit(1) columns and are stored
 * as JSON booleans — see bitToBoolean. This importer runs BEFORE
 * ThgGalleryLangImporter, which merges into an existing translation row with
 * existing-wins semantics: whatever shape is written here is the shape that
 * survives, so the normalisation has to happen on both paths.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  loadGalleryAddresses,
  localiseLegacyLinks,
  type GalleryAddress,
} from '../../utils/legacy-links.js';
import { bitToBoolean } from '../../utils/legacy-values.js';

/**
 * Legacy exhibition_i18n structure
 */
interface LegacyExhibitionI18n {
  gallery_id: number;
  language_id: string; // 2-letter code
  title: string | null;
  subtitle: string | null;
  heading: string | null;
  about: string | null;
  enabled: 'Y' | 'N';
  exh_img_caption: string | null;
  popup_logo_show: string | null;
  popup_logo: string | null;
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
  status: string | null;
  mwnf3_project_id: number | null;
}

/** thg_gallery columns that are MySQL bit(1) and must be stored as booleans. */
const GALLERY_BIT_FIELDS = ['has_timeline', 'has_country_timeline'] as const;

export class ThgGalleryTranslationImporter extends BaseImporter {
  /** gallery_id -> extra fields from thg_gallery */
  private galleryExtraMap: Map<number, LegacyThgGalleryExtra> = new Map();
  /** gallery_id -> the site's own address, for the links a curator wrote into its texts */
  private galleryAddresses: Map<number, GalleryAddress> = new Map();

  getName(): string {
    return 'ThgGalleryTranslationImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing gallery translations from exhibition_i18n...');

      // Load thg_gallery extra fields for preservation in translation.extra
      await this.loadGalleryExtras();
      this.galleryAddresses = await loadGalleryAddresses(this.context.legacyDb);

      // Query translations from legacy database including extra fields
      const translations = await this.context.legacyDb.query<LegacyExhibitionI18n>(
        `SELECT gallery_id, language_id, title, subtitle, heading, about, enabled,
                exh_img_caption, popup_logo_show, popup_logo
         FROM mwnf3_thematic_gallery.exhibition_i18n
         ORDER BY gallery_id, language_id`
      );

      this.logInfo(`Found ${translations.length} gallery translations to import`);

      for (const row of translations) {
        // A link a curator wrote into these texts points at the legacy site by
        // its absolute address; the website that replaces it reaches the same
        // page as a hash route. Rewritten here, before the HTML becomes
        // Markdown, so the package's links work as they are.
        const legacy = this.localiseLinks(row);
        try {
          // Get the language ID by its legacy 2-char code (backward_compatibility)
          // Returns the ISO-3 code (e.g., 'en' → 'eng')
          const languageId = await this.getLanguageIdByLegacyCodeAsync(legacy.language_id);
          if (!languageId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Gallery ${legacy.gallery_id}: Language '${legacy.language_id}' not found`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const galleryBackwardCompat = `mwnf3_thematic_gallery:thg_gallery:${legacy.gallery_id}`;
          const backwardCompat = `mwnf3_thematic_gallery:exhibition_i18n:${legacy.gallery_id}:${legacy.language_id}`;

          // Check if already exists (use async for database fallback)
          if (await this.entityExistsAsync(backwardCompat, 'collection_translation')) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Get the collection ID (use async for database fallback)
          const collectionId = await this.getEntityUuidAsync(galleryBackwardCompat, 'collection');
          if (!collectionId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Gallery ${legacy.gallery_id}: Collection not found. Run ThgGalleryImporter first.`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Get the context ID (same as the gallery's context, use async for database fallback)
          const contextId = await this.getEntityUuidAsync(galleryBackwardCompat, 'context');
          if (!contextId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Gallery ${legacy.gallery_id}: Context not found. Run ThgGalleryContextImporter first.`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Build title (use title or fallback)
          const title = legacy.title || `Gallery ${legacy.gallery_id}`;

          // Build description from subtitle, heading, and about
          const descriptionParts: string[] = [];
          if (legacy.subtitle) {
            descriptionParts.push(legacy.subtitle);
          }
          if (legacy.heading) {
            descriptionParts.push(legacy.heading);
          }
          if (legacy.about) {
            descriptionParts.push(legacy.about);
          }
          const description = descriptionParts.join('\n\n') || null;

          // Build extra object
          const extra = this.buildExtra(legacy);

          // Collect sample
          this.collectSample(
            'thg_gallery_translation',
            legacy as unknown as Record<string, unknown>,
            'success',
            undefined,
            languageId
          );

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create collection translation: ${title} (${backwardCompat})`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          // Write collection translation using strategy
          await this.context.strategy.writeCollectionTranslation({
            collection_id: collectionId,
            language_id: languageId,
            context_id: contextId,
            title: title,
            description: description,
            extra: extra ? JSON.stringify(extra) : null,
            backward_compatibility: backwardCompat,
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Gallery ${legacy.gallery_id} (${legacy.language_id}): ${message}`);
          this.logError(`Gallery ${legacy.gallery_id} (${legacy.language_id})`, message);
          this.showError();
        }
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ThgGalleryTranslationImporter', message);
    }

    return result;
  }

  private localiseLinks(row: LegacyExhibitionI18n): LegacyExhibitionI18n {
    const address = this.galleryAddresses.get(row.gallery_id);
    if (!address) return row;
    const localise = (text: string | null) => (text ? localiseLegacyLinks(text, address) : text);
    return {
      ...row,
      subtitle: localise(row.subtitle),
      heading: localise(row.heading),
      about: localise(row.about),
      exh_img_caption: localise(row.exh_img_caption),
      popup_logo: localise(row.popup_logo),
    };
  }

  /**
   * Load thg_gallery extra fields (those without direct collection columns) into galleryExtraMap.
   */
  private async loadGalleryExtras(): Promise<void> {
    try {
      const rows = await this.context.legacyDb.query<LegacyThgGalleryExtra>(
        `SELECT gallery_id, link, image, banner_image, banner_item, new_expire_date,
                landing_url, portal_image, live_date, homepage_image, homepage_item,
                has_timeline, has_country_timeline, featured, status, mwnf3_project_id
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
   * Includes thg_gallery fields (non-empty) and exhibition_i18n optional fields.
   */
  private buildExtra(i18n: LegacyExhibitionI18n): Record<string, unknown> | null {
    const obj: Record<string, unknown> = {};

    // thg_gallery extra fields
    const galleryRow = this.galleryExtraMap.get(i18n.gallery_id);
    if (galleryRow) {
      const galleryExtra: Record<string, unknown> = {};
      const galleryFields: Array<keyof LegacyThgGalleryExtra> = [
        'link', 'image', 'banner_image', 'banner_item', 'new_expire_date',
        'landing_url', 'portal_image', 'live_date', 'homepage_image', 'homepage_item',
        'has_timeline', 'has_country_timeline', 'featured', 'status', 'mwnf3_project_id',
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

    // exhibition_i18n optional fields
    const exhibitionExtra: Record<string, unknown> = {};
    if (i18n.enabled) exhibitionExtra.enabled = i18n.enabled;
    // subtitle / heading / about are ALSO joined into `description` above, for
    // the general-purpose "one body of text" consumers. That join is lossy and
    // cannot be undone — `about` contains the same blank-line separator the
    // join uses — so the three are preserved individually here as well. The
    // exhibition sheet renders them in three different places (sub-title under
    // the title, headline in the banner, about on its own page), and an
    // exhibition data package has no other way to tell them apart.
    // See museumwithnofrontiers/inventory-app#1546.
    if (i18n.subtitle) exhibitionExtra.subtitle = i18n.subtitle;
    if (i18n.heading) exhibitionExtra.heading = i18n.heading;
    if (i18n.about) exhibitionExtra.about = i18n.about;
    if (i18n.exh_img_caption) exhibitionExtra.exh_img_caption = i18n.exh_img_caption;
    if (i18n.popup_logo_show) exhibitionExtra.popup_logo_show = i18n.popup_logo_show;
    if (i18n.popup_logo) exhibitionExtra.popup_logo = i18n.popup_logo;
    if (Object.keys(exhibitionExtra).length > 0) {
      obj.exhibition_i18n = exhibitionExtra;
    }

    return Object.keys(obj).length > 0 ? obj : null;
  }
}
