/**
 * THG Gallery Content Importer
 *
 * Imports exhibition-specific content for thematic galleries:
 * - exhibition_logo (+ _i18n, + _category) -> collection_images (+ extra, + tag)
 * - exhibition_partner -> partners + collection_partner + partner_logos
 * - exhibition_related_content links/documents -> collection_media
 *
 * A sponsor logo carries more than a file: a display caption (per language),
 * a hyperlink to the sponsor, a banner slot and a visibility flag. Those ride
 * along in `collection_images.extra`, and the image is marked as a logo with
 * the `image-type:logo` tag — `collection_images` has no type column of its
 * own. See museumwithnofrontiers/inventory-app#1592.
 */

import path from 'path';

import { BaseImporter } from '../../core/base-importer.js';
import type {
  CollectionMediaData,
  ImportResult,
  PartnerData,
  PartnerLogoData,
  PartnerTranslationData,
} from '../../core/types.js';
import { TagHelper } from '../../helpers/tag-helper.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { mapCountryCode } from '../../utils/code-mappings.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import {
  loadGalleryAddresses,
  localiseConverted,
  type GalleryAddress,
} from '../../utils/legacy-links.js';

interface LegacyExhibitionLogo {
  logo_id: number;
  gallery_id: number;
  category_id: number | null;
  display_order: number | null;
  logo: string | null;
  label: string | null;
  alt: string | null;
  link: string | null;
  visible: string | null;
  further_reading: string | null;
}

/**
 * `mwnf3_thematic_gallery.exhibition_logo_i18n` — the per-language caption of a
 * sponsor logo, keyed `(logo_id, language_id)` with `language_id` the legacy
 * 2-char code. This is where the *display* string lives: for gallery 47 the
 * base row says `UNAOC` while the i18n row says
 * `United Nations Alliance of Civilizations`, and the live API serves the
 * latter.
 */
/**
 * Does this related-content entry have anything `collection_media` can hold?
 *
 * The translations decide it as much as the base row does. On gallery 47 every
 * base row is bare and each carries an `_i18n` row with an uploaded document,
 * so the whole table is media-backed; on gallery 56 neither level has a link or
 * a document and all five entries are bibliographies. Reading only the base row
 * would file ten of Colours' entries as text and lose their documents.
 */
export function relatedContentCarriesMedia(
  content: Pick<LegacyExhibitionRelatedContent, 'link' | 'uploaded_document'>,
  translations: Pick<LegacyExhibitionRelatedContentI18n, 'link' | 'uploaded_document'>[]
): boolean {
  const hasMedia = (row: { link: string | null; uploaded_document: string | null }): boolean =>
    Boolean(trimToNull(row.link)) || Boolean(trimToNull(row.uploaded_document));
  return hasMedia(content) || translations.some(hasMedia);
}

/**
 * One "Further Reading" block on an exhibition's related-content page: a
 * bibliography with no link and no document, keyed by language the same way
 * `collection_item.extra`'s `contextual_descriptions` are.
 */
interface FurtherReadingEntry {
  legacy_id: number;
  category_id: number | null;
  display_order: number;
  texts: Record<string, string>;
}

export interface LegacyExhibitionLogoI18n {
  logo_id: number;
  language_id: string | null;
  label: string | null;
  alt: string | null;
  further_reading: string | null;
}

/**
 * `mwnf3_thematic_gallery.exhibition_logo_category` — a static 5-row lookup
 * naming the banner slot a logo is rendered in: `0 Header`, `1 Footer 1`,
 * `2 Footer 2`, `3 Footer 3`, `4 Footer 4`.
 */
export interface LegacyExhibitionLogoCategory {
  category_id: number;
  name: string | null;
  description: string | null;
}

interface LegacyExhibitionPartner {
  partner_id: number;
  gallery_id: number;
  category_id: number;
  display_order: number | null;
  entity_name: string | null;
  entity_location: string | null;
  entity_country: string | null;
  title: string | null;
  link: string | null;
  description: string | null;
  logo: string | null;
  visible: string | null;
  contact_title: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_fax: string | null;
  further_reading: string | null;
}

interface LegacyExhibitionPartnerI18n {
  partner_id: number;
  language_id: string | null;
  entity_name: string | null;
  entity_location: string | null;
  entity_country: string | null;
  title: string | null;
  link: string | null;
  description: string | null;
  logo: string | null;
  contact_title: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_fax: string | null;
  further_reading: string | null;
}

interface LegacyExhibitionRelatedContent {
  related_content_id: number;
  gallery_id: number;
  category_id: number | null;
  display_order: number | null;
  further_reading: string | null;
  entity_name: string | null;
  entity_location: string | null;
  entity_country: string | null;
  title: string | null;
  link: string | null;
  authors: string | null;
  type_resource: string | null;
  description: string | null;
  uploaded_document: string | null;
}

interface LegacyExhibitionRelatedContentI18n {
  related_content_id: number;
  language_id: string | null;
  further_reading: string | null;
  entity_name: string | null;
  entity_location: string | null;
  entity_country: string | null;
  title: string | null;
  link: string | null;
  authors: string | null;
  type_resource: string | null;
  description: string | null;
  uploaded_document: string | null;
}

interface GalleryTypeRow {
  gallery_id: number;
  is_gallery: number | boolean | string | null;
  is_exhibition: number | boolean | string | null;
}

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_MIME_TYPES[ext] ?? 'application/octet-stream';
}

function mapContentType(legacyType: string | null): 'audio' | 'video' | 'document' | null {
  const normalized = trimToNull(legacyType)?.toLowerCase();
  if (!normalized) {
    return null;
  }
  if (['audio', 'mp3', 'ogg'].includes(normalized)) {
    return 'audio';
  }
  if (['video', 'mp4', 'youtube', 'vimeo'].includes(normalized)) {
    return 'video';
  }
  if (['document', 'pdf'].includes(normalized)) {
    return 'document';
  }
  return null;
}

function mapPartnerLevel(categoryId: number): string | null {
  switch (categoryId) {
    case 1:
      return 'full_partner';
    case 2:
      return 'co_organiser';
    case 3:
      return 'other_contributor';
    default:
      return null;
  }
}

function isTruthyFlag(value: number | boolean | string | null): boolean {
  return value === true || value === 1 || value === '1' || value === 'Y';
}

function buildExtra(fields: Record<string, string | number | null | undefined>): string | null {
  const extra: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'number') {
      extra[key] = value;
      continue;
    }
    const trimmed = trimToNull(value);
    if (trimmed) {
      extra[key] = trimmed;
    }
  }

  return Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;
}

/**
 * The `image-type` tag that marks a collection image as an exhibition sponsor
 * logo. `collection_images` has no type column of its own; the `image-type`
 * tag family is how `map` images are already distinguished, and logos join it.
 */
export const LOGO_TAG_NAME = 'logo';
export const IMAGE_TYPE_TAG_CATEGORY = 'image-type';

/**
 * Everything the `collection_images.extra` payload of a sponsor logo is built
 * from. Language ids are the inventory's 3-char ids (`eng`), already resolved
 * from the legacy 2-char codes — the exporter converts back on output, exactly
 * as it does for every other translation.
 */
export interface ExhibitionLogoExtraSource {
  link: string | null;
  categoryId: number | null;
  categoryName: string | null;
  visible: string | null;
  /** Base-row texts. They seed the default language; an i18n row wins. */
  baseLabel: string | null;
  baseAlt: string | null;
  baseFurtherReading: string | null;
  defaultLanguageId: string;
  translations: Array<{
    languageId: string;
    label: string | null;
    alt: string | null;
    furtherReading: string | null;
  }>;
}

/**
 * Build the `collection_images.extra` payload for one exhibition sponsor logo.
 *
 * Shared by ThgGalleryContentImporter (the write path) and
 * ExhibitionLogoExtraBackfillImporter (the repair path) so the two shapes
 * cannot drift — a backfilled row must be indistinguishable from a
 * freshly-imported one. See museumwithnofrontiers/inventory-app#1592.
 *
 * Keys with no value anywhere are omitted, the same convention `buildExtra()`
 * above follows. `visible` is always present: `false` is a value, and a logo
 * legacy hides is still imported — the inventory is the system of record and
 * filtering is the viewer's job.
 */
export function buildExhibitionLogoExtra(
  source: ExhibitionLogoExtraSource
): Record<string, unknown> {
  const extra: Record<string, unknown> = {};

  const link = trimToNull(source.link);
  if (link) {
    extra['link'] = link;
  }
  if (source.categoryId !== null && source.categoryId !== undefined) {
    extra['category_id'] = source.categoryId;
  }
  const categoryName = trimToNull(source.categoryName);
  if (categoryName) {
    extra['category_name'] = categoryName;
  }
  extra['visible'] = isTruthyFlag(source.visible);

  const labels: Record<string, string> = {};
  const alts: Record<string, string> = {};
  const furtherReadings: Record<string, string> = {};

  // The base row seeds the default language …
  const baseLabel = trimToNull(source.baseLabel);
  if (baseLabel) labels[source.defaultLanguageId] = baseLabel;
  const baseAlt = trimToNull(source.baseAlt);
  if (baseAlt) alts[source.defaultLanguageId] = baseAlt;
  const baseFurtherReading = trimToNull(source.baseFurtherReading);
  if (baseFurtherReading) furtherReadings[source.defaultLanguageId] = baseFurtherReading;

  // … and an i18n row wins on conflict.
  for (const translation of source.translations) {
    const label = trimToNull(translation.label);
    if (label) labels[translation.languageId] = label;
    const alt = trimToNull(translation.alt);
    if (alt) alts[translation.languageId] = alt;
    const furtherReading = trimToNull(translation.furtherReading);
    if (furtherReading) furtherReadings[translation.languageId] = furtherReading;
  }

  if (Object.keys(labels).length > 0) extra['labels'] = labels;
  if (Object.keys(alts).length > 0) extra['alts'] = alts;
  if (Object.keys(furtherReadings).length > 0) extra['further_readings'] = furtherReadings;

  return extra;
}

export class ThgGalleryContentImporter extends BaseImporter {
  private galleryCollectionTypes = new Map<number, 'gallery' | 'exhibition'>();
  /** gallery_id -> the site's own address, for the links a curator wrote into its texts */
  private galleryAddresses = new Map<number, GalleryAddress>();
  private defaultContextId: string | null = null;
  private tagHelper: TagHelper | null = null;

  /**
   * A text converted to Markdown with its same-site links turned into the
   * hash routes the replacing website reaches the same pages by.
   */
  private markdownOf(text: string | null | undefined, galleryId: number): string {
    return localiseConverted(convertHtmlToMarkdown, text, this.galleryAddresses.get(galleryId));
  }

  private getTagHelper(): TagHelper {
    this.tagHelper ??= new TagHelper(
      this.context.strategy,
      this.context.tracker,
      this.context.logger
    );
    return this.tagHelper;
  }

  getName(): string {
    return 'ThgGalleryContentImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      await this.loadGalleryCollectionTypes();
      this.galleryAddresses = await loadGalleryAddresses(this.context.legacyDb);

      this.logInfo('Importing exhibition logos as collection images...');
      const logoResult = await this.importExhibitionLogos();
      result.imported += logoResult.imported;
      result.skipped += logoResult.skipped;
      result.errors.push(...logoResult.errors);
      result.warnings.push(...(logoResult.warnings ?? []));

      this.logInfo('Importing exhibition partners as partners...');
      const partnerResult = await this.importExhibitionPartners();
      result.imported += partnerResult.imported;
      result.skipped += partnerResult.skipped;
      result.errors.push(...partnerResult.errors);
      result.warnings.push(...(partnerResult.warnings ?? []));

      this.logInfo('Importing exhibition related content as collection media...');
      const contentResult = await this.importExhibitionRelatedContent();
      result.imported += contentResult.imported;
      result.skipped += contentResult.skipped;
      result.errors.push(...contentResult.errors);
      result.warnings.push(...(contentResult.warnings ?? []));

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('ThgGalleryContentImporter', message);
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async loadGalleryCollectionTypes(): Promise<void> {
    const rows = await this.context.legacyDb.query<GalleryTypeRow>(
      `SELECT g.gallery_id, pt.is_gallery, pt.is_exhibition
       FROM mwnf3_thematic_gallery.thg_gallery g
       INNER JOIN mwnf3_thematic_gallery.thg_projects p ON p.project_id = g.project_id
       INNER JOIN mwnf3_thematic_gallery.thg_project_type pt ON pt.type_id = p.type_id`
    );

    for (const row of rows) {
      const isGallery = isTruthyFlag(row.is_gallery);
      const isExhibition = isTruthyFlag(row.is_exhibition);
      if (isGallery && !isExhibition) {
        this.galleryCollectionTypes.set(row.gallery_id, 'gallery');
      }
      if (isExhibition && !isGallery) {
        this.galleryCollectionTypes.set(row.gallery_id, 'exhibition');
      }
    }
  }

  private async importExhibitionLogos(): Promise<ImportResult> {
    const result = this.createResult();

    let logoRows: LegacyExhibitionLogo[];
    try {
      logoRows = await this.context.legacyDb.query<LegacyExhibitionLogo>(
        `SELECT logo_id, gallery_id, category_id, display_order, logo, label, alt, link, visible, further_reading
         FROM mwnf3_thematic_gallery.exhibition_logo
         ORDER BY gallery_id, display_order IS NULL, display_order, logo_id`
      );
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : String(queryError);
      if (message.includes("doesn't exist") || message.includes('Table')) {
        this.logInfo(`exhibition_logo table not available: ${message}`);
        result.warnings.push(`exhibition_logo table not available: ${message}`);
        result.success = true;
        return result;
      }
      throw queryError;
    }

    this.logInfo(`Found ${logoRows.length} exhibition logo rows`);
    if (logoRows.length === 0) {
      return result;
    }

    // The caption, the banner slot and the hyperlink live in two tables the
    // base row only points at. Both are optional: the legacy schema drifts and
    // a missing table must degrade the payload, not fail the import (#1592).
    const i18nRows = await this.loadExhibitionLogoTranslations(result);
    const categoryNames = await this.loadExhibitionLogoCategories(result);
    const defaultLanguageId = await this.getDefaultLanguageIdAsync();

    const i18nByLogoId = new Map<number, LegacyExhibitionLogoI18n[]>();
    for (const i18n of i18nRows) {
      const existing = i18nByLogoId.get(i18n.logo_id) ?? [];
      existing.push(i18n);
      i18nByLogoId.set(i18n.logo_id, existing);
    }

    // find-or-create, tracker → db → insert. Do not hand-build the tag's
    // backward_compatibility: TagHelper owns that format
    // (`mwnf3:tags:image-type:eng:logo`).
    let logoTagId: string | null = null;
    if (!this.isDryRun && !this.isSampleOnlyMode) {
      logoTagId = await this.getTagHelper().findOrCreate(
        LOGO_TAG_NAME,
        IMAGE_TYPE_TAG_CATEGORY,
        defaultLanguageId
      );
      if (!logoTagId) {
        const warning = 'image-type:logo tag could not be resolved — logos will not be tagged';
        result.warnings.push(warning);
        this.logWarning(warning);
      }
    }

    for (const logo of logoRows) {
      try {
        const logoPath = trimToNull(logo.logo);
        if (!logoPath) {
          result.warnings.push(
            `exhibition_logo.logo_id=${logo.logo_id}: logo path is empty, skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const collectionId = await this.resolveGalleryCollectionId(logo.gallery_id);
        if (!collectionId) {
          result.warnings.push(
            `exhibition_logo.logo_id=${logo.logo_id}: gallery collection not found for gallery_id=${logo.gallery_id}, skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Check if already imported. collection_images has no
        // backward_compatibility column — identity is (owner, legacy path).
        if (await this.imageExistsAsync('collection_images', collectionId, logoPath)) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        this.collectSample(
          'exhibition_logo',
          logo as unknown as Record<string, unknown>,
          'success'
        );

        const translations = await this.resolveLogoTranslations(
          i18nByLogoId.get(logo.logo_id) ?? [],
          result
        );
        const extra = buildExhibitionLogoExtra({
          link: logo.link,
          categoryId: logo.category_id,
          categoryName:
            logo.category_id === null ? null : (categoryNames.get(logo.category_id) ?? null),
          visible: logo.visible,
          baseLabel: logo.label,
          baseAlt: logo.alt,
          baseFurtherReading: logo.further_reading,
          defaultLanguageId,
          translations,
        });

        if (!this.isDryRun && !this.isSampleOnlyMode) {
          const imageId = await this.context.strategy.writeCollectionImage({
            collection_id: collectionId,
            path: logoPath,
            original_name: path.basename(logoPath),
            mime_type: guessMimeType(logoPath),
            size: 1,
            alt_text: trimToNull(logo.alt),
            display_order: logo.display_order ?? 0,
            extra: JSON.stringify(extra),
          });

          if (logoTagId) {
            await this.getTagHelper().attachToCollectionImage(imageId, [logoTagId]);
          }
        } else {
          this.logInfo(
            `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create exhibition logo image: ${logoPath} -> collection ${collectionId}`
          );
        }

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`exhibition_logo.logo_id=${logo.logo_id}: ${message}`);
        this.logError(`exhibition_logo.logo_id=${logo.logo_id}`, message);
        this.showError();
      }
    }

    return result;
  }

  private async importExhibitionPartners(): Promise<ImportResult> {
    const result = this.createResult();

    let partnerRows: LegacyExhibitionPartner[];
    try {
      partnerRows = await this.context.legacyDb.query<LegacyExhibitionPartner>(
        `SELECT partner_id, gallery_id, category_id, display_order, entity_name, entity_location,
                entity_country, title, link, description, logo, visible, contact_title,
                contact_name, contact_email, contact_phone, contact_fax, further_reading
         FROM mwnf3_thematic_gallery.exhibition_partner
         ORDER BY gallery_id, display_order IS NULL, display_order, partner_id`
      );
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : String(queryError);
      if (message.includes("doesn't exist") || message.includes('Table')) {
        this.logInfo(`exhibition_partner table not available: ${message}`);
        result.warnings.push(`exhibition_partner table not available: ${message}`);
        result.success = true;
        return result;
      }
      throw queryError;
    }

    const i18nRows = await this.loadExhibitionPartnerTranslations(result);
    if (i18nRows.length > 0 && !this.defaultContextId) {
      this.defaultContextId = await this.getDefaultContextIdAsync();
    }

    const translationsByPartnerId = new Map<number, LegacyExhibitionPartnerI18n[]>();
    for (const i18n of i18nRows) {
      const existing = translationsByPartnerId.get(i18n.partner_id) ?? [];
      existing.push(i18n);
      translationsByPartnerId.set(i18n.partner_id, existing);
    }

    this.logInfo(`Found ${partnerRows.length} exhibition partner rows`);

    for (const partner of partnerRows) {
      try {
        const collectionId = await this.resolveGalleryCollectionId(partner.gallery_id);
        if (!collectionId) {
          result.warnings.push(
            `exhibition_partner.partner_id=${partner.partner_id}: gallery collection not found for gallery_id=${partner.gallery_id}, skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const collectionType = this.galleryCollectionTypes.get(partner.gallery_id);
        if (!collectionType) {
          result.warnings.push(
            `exhibition_partner.partner_id=${partner.partner_id}: collection type not found for gallery_id=${partner.gallery_id}`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const level = mapPartnerLevel(partner.category_id);
        if (!level) {
          result.warnings.push(
            `exhibition_partner.partner_id=${partner.partner_id}: unknown category_id=${partner.category_id}`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const partnerId = await this.resolveOrCreatePartner(partner, result);
        if (!partnerId) {
          continue;
        }

        if (!this.isDryRun && !this.isSampleOnlyMode) {
          await this.context.strategy.attachPartnerToCollectionWithLevel(
            collectionId,
            partnerId,
            collectionType,
            level
          );
        }

        await this.importPartnerLogo(
          partnerId,
          partner.logo,
          partner.partner_id,
          partner.display_order ?? 0
        );
        await this.importPartnerTranslations(
          partnerId,
          partner,
          translationsByPartnerId.get(partner.partner_id) ?? [],
          result
        );

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`exhibition_partner.partner_id=${partner.partner_id}: ${message}`);
        this.logError(`exhibition_partner.partner_id=${partner.partner_id}`, message);
        this.showError();
      }
    }

    return result;
  }

  private async importExhibitionRelatedContent(): Promise<ImportResult> {
    const result = this.createResult();

    let contentRows: LegacyExhibitionRelatedContent[];
    try {
      contentRows = await this.context.legacyDb.query<LegacyExhibitionRelatedContent>(
        `SELECT related_content_id, gallery_id, category_id, display_order, further_reading,
                entity_name, entity_location, entity_country, title, link, authors,
                type_resource, description, uploaded_document
         FROM mwnf3_thematic_gallery.exhibition_related_content
         ORDER BY gallery_id, display_order IS NULL, display_order, related_content_id`
      );
    } catch (queryError) {
      const message = queryError instanceof Error ? queryError.message : String(queryError);
      if (message.includes("doesn't exist") || message.includes('Table')) {
        this.logInfo(`exhibition_related_content table not available: ${message}`);
        result.warnings.push(`exhibition_related_content table not available: ${message}`);
        result.success = true;
        return result;
      }
      throw queryError;
    }

    const i18nRows = await this.loadRelatedContentTranslations(result);
    const translationsByContentId = new Map<number, LegacyExhibitionRelatedContentI18n[]>();
    for (const i18n of i18nRows) {
      const existing = translationsByContentId.get(i18n.related_content_id) ?? [];
      existing.push(i18n);
      translationsByContentId.set(i18n.related_content_id, existing);
    }

    this.logInfo(
      `Found ${contentRows.length} related content rows, ${i18nRows.length} translations`
    );

    // Entries that carry no link and no document — a bibliography and nothing
    // else. They have no `collection_media` row to hang on, so they are
    // collected here and written to the gallery collection's own `extra`.
    const furtherReadingsByCollection = new Map<string, FurtherReadingEntry[]>();

    for (const content of contentRows) {
      try {
        const collectionId = await this.resolveGalleryCollectionId(content.gallery_id);
        if (!collectionId) {
          result.warnings.push(
            `exhibition_related_content.related_content_id=${content.related_content_id}: gallery collection not found for gallery_id=${content.gallery_id}, skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        await this.importRelatedContentBaseRows(collectionId, content, result);

        const translations = translationsByContentId.get(content.related_content_id) ?? [];
        for (const i18n of translations) {
          await this.importRelatedContentTranslationRows(collectionId, content, i18n, result);
        }

        const entry = await this.buildFurtherReadingEntry(content, translations, result);
        if (entry) {
          const bucket = furtherReadingsByCollection.get(collectionId) ?? [];
          bucket.push(entry);
          furtherReadingsByCollection.set(collectionId, bucket);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(
          `exhibition_related_content.related_content_id=${content.related_content_id}: ${message}`
        );
        this.logError(
          `exhibition_related_content.related_content_id=${content.related_content_id}`,
          message
        );
        this.showError();
      }
    }

    for (const [collectionId, entries] of furtherReadingsByCollection) {
      await this.writeFurtherReadings(collectionId, entries, result);
    }

    return result;
  }

  /**
   * A related-content entry with neither a link nor an uploaded document is a
   * bibliography: legacy renders it under "Further Reading" as a block of text
   * and nothing more. `collection_media` cannot hold it — that table is media,
   * and its `url` is required — so the text goes on the exhibition collection's
   * own `extra`, the way a theme's curated picture texts live on
   * `collection_item.extra`.
   *
   * Returns null when the entry has a link or a document (its content is
   * already in `collection_media`), and null when it has neither those nor any
   * text, which is an empty legacy row.
   */
  private async buildFurtherReadingEntry(
    content: LegacyExhibitionRelatedContent,
    translations: LegacyExhibitionRelatedContentI18n[],
    result: ImportResult
  ): Promise<FurtherReadingEntry | null> {
    if (relatedContentCarriesMedia(content, translations)) {
      return null;
    }

    // The base row seeds the default language and an i18n row wins on conflict
    // — the same precedence `buildLogoExtra` applies to a sponsor caption.
    const texts: Record<string, string> = {};
    const baseText = trimToNull(content.further_reading);
    if (baseText) {
      texts[await this.getDefaultLanguageIdAsync()] = this.markdownOf(baseText, content.gallery_id);
    }
    for (const translation of translations) {
      const text = trimToNull(translation.further_reading);
      if (!text) continue;
      const sourceLanguage = trimToNull(translation.language_id);
      if (!sourceLanguage) continue;
      const languageId = await this.getLanguageIdByLegacyCodeAsync(sourceLanguage);
      if (!languageId) {
        result.warnings.push(
          `exhibition_related_content_i18n.related_content_id=${translation.related_content_id}, language_id=${sourceLanguage}: unknown language, skipping further reading`
        );
        continue;
      }
      texts[languageId] = this.markdownOf(text, content.gallery_id);
    }

    if (Object.keys(texts).length === 0) {
      result.skipped++;
      this.showSkipped();
      return null;
    }

    return {
      legacy_id: content.related_content_id,
      category_id: content.category_id,
      display_order: content.display_order ?? 0,
      texts,
    };
  }

  /**
   * Merge one exhibition's bibliographies into `collections.extra`, ordered the
   * way legacy orders the page. Read-modify-write, so the block sits beside
   * whatever `ThgGalleryImporter` and the hidden-museum step already wrote.
   */
  private async writeFurtherReadings(
    collectionId: string,
    entries: FurtherReadingEntry[],
    result: ImportResult
  ): Promise<void> {
    entries.sort((a, b) => a.display_order - b.display_order || a.legacy_id - b.legacy_id);

    if (this.isDryRun || this.isSampleOnlyMode) {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would write ${entries.length} further-reading entr(ies) to collection ${collectionId}`
      );
      result.imported += entries.length;
      return;
    }

    const existing = (await this.context.strategy.getCollectionExtra(collectionId)) ?? {};
    await this.context.strategy.setCollectionExtra(
      collectionId,
      JSON.stringify({ ...existing, further_readings: entries })
    );
    result.imported += entries.length;
    for (let i = 0; i < entries.length; i++) this.showProgress();
  }

  /**
   * Read the per-language logo captions. A missing table is tolerated the same
   * way the base `exhibition_logo` query tolerates one — the legacy schema
   * drifts, and losing the captions must not lose the logos.
   */
  private async loadExhibitionLogoTranslations(
    result: ImportResult
  ): Promise<LegacyExhibitionLogoI18n[]> {
    try {
      return await this.context.legacyDb.query<LegacyExhibitionLogoI18n>(
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
        return [];
      }
      throw queryError;
    }
  }

  /**
   * Read the static banner-slot lookup, so the exporter never needs the legacy
   * database to render "Footer 2".
   */
  private async loadExhibitionLogoCategories(result: ImportResult): Promise<Map<number, string>> {
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
  private async resolveLogoTranslations(
    rows: LegacyExhibitionLogoI18n[],
    result: ImportResult
  ): Promise<ExhibitionLogoExtraSource['translations']> {
    const translations: ExhibitionLogoExtraSource['translations'] = [];
    for (const row of rows) {
      const sourceLanguage = trimToNull(row.language_id);
      if (!sourceLanguage) {
        result.warnings.push(
          `exhibition_logo_i18n.logo_id=${row.logo_id}: language_id is empty, skipping caption`
        );
        continue;
      }

      const languageId = await this.getLanguageIdByLegacyCodeAsync(sourceLanguage);
      if (!languageId) {
        result.warnings.push(
          `exhibition_logo_i18n.logo_id=${row.logo_id}: unknown language '${sourceLanguage}', skipping caption`
        );
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

  private async loadExhibitionPartnerTranslations(
    result: ImportResult
  ): Promise<LegacyExhibitionPartnerI18n[]> {
    try {
      return await this.context.legacyDb.query<LegacyExhibitionPartnerI18n>(
        `SELECT partner_id, language_id, entity_name, entity_location, entity_country, title,
                link, description, logo, contact_title, contact_name, contact_email,
                contact_phone, contact_fax, further_reading
         FROM mwnf3_thematic_gallery.exhibition_partner_i18n
         ORDER BY partner_id, language_id`
      );
    } catch {
      result.warnings.push(
        'exhibition_partner_i18n table not available; partner translations skipped'
      );
      return [];
    }
  }

  private async loadRelatedContentTranslations(
    result: ImportResult
  ): Promise<LegacyExhibitionRelatedContentI18n[]> {
    try {
      return await this.context.legacyDb.query<LegacyExhibitionRelatedContentI18n>(
        `SELECT related_content_id, language_id, further_reading, entity_name,
                entity_location, entity_country, title, link, authors, type_resource,
                description, uploaded_document
         FROM mwnf3_thematic_gallery.exhibition_related_content_i18n
         ORDER BY related_content_id, language_id`
      );
    } catch {
      result.warnings.push(
        'exhibition_related_content_i18n table not available; language-specific related content skipped'
      );
      return [];
    }
  }

  private async resolveGalleryCollectionId(galleryId: number): Promise<string | null> {
    return this.getEntityUuidAsync(`mwnf3_thematic_gallery:thg_gallery:${galleryId}`, 'collection');
  }

  private async resolveOrCreatePartner(
    partner: LegacyExhibitionPartner,
    result: ImportResult
  ): Promise<string | null> {
    const backwardCompatibility = formatBackwardCompatibility({
      schema: 'mwnf3_thematic_gallery',
      table: 'exhibition_partner',
      pkValues: [String(partner.partner_id)],
    });

    const existingPartnerId = await this.getEntityUuidAsync(backwardCompatibility, 'partner');
    if (existingPartnerId) {
      return existingPartnerId;
    }

    const internalName = trimToNull(partner.entity_name) ?? trimToNull(partner.title);
    if (!internalName) {
      result.warnings.push(
        `exhibition_partner.partner_id=${partner.partner_id}: entity_name and title are both empty`
      );
      result.skipped++;
      this.showSkipped();
      return null;
    }

    const countryId = await this.resolveCountryId(
      partner.entity_country,
      partner.partner_id,
      result
    );

    const partnerData: PartnerData = {
      type: 'institution',
      internal_name: internalName,
      backward_compatibility: backwardCompatibility,
      country_id: countryId,
      visible: partner.visible === 'Y',
    };

    this.collectSample(
      'exhibition_partner',
      partner as unknown as Record<string, unknown>,
      'success'
    );

    if (this.isDryRun || this.isSampleOnlyMode) {
      const sampleId = `sample-exhibition-partner-${partner.partner_id}`;
      this.registerEntity(sampleId, backwardCompatibility, 'partner');
      return sampleId;
    }

    const partnerId = await this.context.strategy.writePartner(partnerData);
    this.registerEntity(partnerId, backwardCompatibility, 'partner');
    return partnerId;
  }

  private async resolveCountryId(
    sourceCountry: string | null,
    partnerId: number,
    result: ImportResult
  ): Promise<string | null> {
    const legacyCode = trimToNull(sourceCountry);
    if (!legacyCode) {
      return null;
    }

    let mappedCountryId: string;
    try {
      mappedCountryId = mapCountryCode(legacyCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.warnings.push(
        `exhibition_partner.partner_id=${partnerId}: entity_country='${legacyCode}' cannot be mapped: ${message}`
      );
      return null;
    }

    const countryId = await this.getEntityUuidAsync(legacyCode, 'country');
    return countryId ?? mappedCountryId;
  }

  private async importPartnerTranslations(
    partnerId: string,
    partner: LegacyExhibitionPartner,
    translations: LegacyExhibitionPartnerI18n[],
    result: ImportResult
  ): Promise<void> {
    for (const translation of translations) {
      const sourceLabel = `exhibition_partner_i18n.partner_id=${translation.partner_id}, language_id=${translation.language_id ?? 'null'}`;
      const sourceLanguage = trimToNull(translation.language_id);
      if (!sourceLanguage) {
        result.warnings.push(`${sourceLabel}: language_id is empty, skipping translation`);
        continue;
      }

      const languageId = await this.getLanguageIdByLegacyCodeAsync(sourceLanguage);
      if (!languageId) {
        result.warnings.push(`${sourceLabel}: unknown language, skipping translation`);
        continue;
      }

      const name = trimToNull(translation.entity_name) ?? trimToNull(translation.title);
      if (!name) {
        result.warnings.push(
          `${sourceLabel}: entity_name and title are both empty, skipping translation`
        );
        continue;
      }

      const backwardCompatibility = formatBackwardCompatibility({
        schema: 'mwnf3_thematic_gallery',
        table: 'exhibition_partner_i18n',
        pkValues: [String(translation.partner_id), sourceLanguage],
      });

      if (await this.entityExistsAsync(backwardCompatibility, 'partner_translation')) {
        continue;
      }

      const description = trimToNull(translation.description);
      const translationData: PartnerTranslationData = {
        partner_id: partnerId,
        language_id: languageId,
        context_id: this.defaultContextId!,
        backward_compatibility: backwardCompatibility,
        name: convertHtmlToMarkdown(name),
        description: description ? this.markdownOf(description, partner.gallery_id) : null,
        city_display: trimToNull(translation.entity_location),
        contact_website: trimToNull(translation.link),
        contact_phone: trimToNull(translation.contact_phone),
        contact_email_general: trimToNull(translation.contact_email),
        extra: buildExtra({
          entity_country: translation.entity_country,
          contact_title: translation.contact_title,
          contact_name: translation.contact_name,
          contact_fax: translation.contact_fax,
          further_reading: translation.further_reading,
        }),
      };

      if (!this.isDryRun && !this.isSampleOnlyMode) {
        await this.context.strategy.writePartnerTranslation(translationData);
      }

      await this.importPartnerLogo(
        partnerId,
        translation.logo,
        partner.partner_id,
        partner.display_order ?? 0
      );
    }
  }

  private async importPartnerLogo(
    partnerId: string,
    logoPathValue: string | null,
    sourcePartnerId: number,
    displayOrder: number
  ): Promise<void> {
    const logoPath = trimToNull(logoPathValue);
    if (!logoPath) {
      return;
    }

    // Check if already imported. partner_logos has no
    // backward_compatibility column — identity is (owner, legacy path).
    if (await this.imageExistsAsync('partner_logos', partnerId, logoPath)) {
      return;
    }

    const logoData: PartnerLogoData = {
      partner_id: partnerId,
      path: logoPath,
      original_name: path.basename(logoPath),
      mime_type: guessMimeType(logoPath),
      size: 1,
      logo_type: 'primary',
      alt_text: null,
      display_order: displayOrder,
    };

    if (!this.isDryRun && !this.isSampleOnlyMode) {
      await this.context.strategy.writePartnerLogo(logoData);
    } else {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create partner logo for exhibition_partner.partner_id=${sourcePartnerId}: ${logoPath}`
      );
    }
  }

  private async importRelatedContentBaseRows(
    collectionId: string,
    content: LegacyExhibitionRelatedContent,
    result: ImportResult
  ): Promise<void> {
    const link = trimToNull(content.link);
    if (link) {
      await this.writeRelatedContentMedia({
        collectionId,
        relatedContentId: content.related_content_id,
        sourceTable: 'exhibition_related_content',
        languageId: null,
        source: content,
        galleryId: content.gallery_id,
        url: link,
        type: mapContentType(content.type_resource),
        typeRequired: true,
        displayOrder: content.display_order ?? 0,
        categoryId: content.category_id,
        backwardCompatibility: `mwnf3_thematic_gallery:exhibition_related_content:${content.related_content_id}:link`,
        result,
      });
    }

    const uploadedDocument = trimToNull(content.uploaded_document);
    if (uploadedDocument) {
      await this.writeRelatedContentMedia({
        collectionId,
        relatedContentId: content.related_content_id,
        sourceTable: 'exhibition_related_content',
        languageId: null,
        source: content,
        galleryId: content.gallery_id,
        url: uploadedDocument,
        type: 'document',
        typeRequired: false,
        displayOrder: content.display_order ?? 0,
        categoryId: content.category_id,
        backwardCompatibility: `mwnf3_thematic_gallery:exhibition_related_content:${content.related_content_id}:document`,
        result,
      });
    }
  }

  private async importRelatedContentTranslationRows(
    collectionId: string,
    baseContent: LegacyExhibitionRelatedContent,
    translation: LegacyExhibitionRelatedContentI18n,
    result: ImportResult
  ): Promise<void> {
    const sourceLanguage = trimToNull(translation.language_id);
    const sourceLabel = `exhibition_related_content_i18n.related_content_id=${translation.related_content_id}, language_id=${translation.language_id ?? 'null'}`;
    if (!sourceLanguage) {
      result.warnings.push(
        `${sourceLabel}: language_id is empty, skipping related content translation`
      );
      return;
    }

    const languageId = await this.getLanguageIdByLegacyCodeAsync(sourceLanguage);
    if (!languageId) {
      result.warnings.push(
        `${sourceLabel}: unknown language, skipping related content translation`
      );
      return;
    }

    const link = trimToNull(translation.link);
    if (link) {
      await this.writeRelatedContentMedia({
        collectionId,
        relatedContentId: translation.related_content_id,
        sourceTable: 'exhibition_related_content_i18n',
        languageId,
        source: translation,
        galleryId: baseContent.gallery_id,
        url: link,
        type: mapContentType(translation.type_resource),
        typeRequired: true,
        displayOrder: baseContent.display_order ?? 0,
        categoryId: baseContent.category_id,
        backwardCompatibility: `mwnf3_thematic_gallery:exhibition_related_content_i18n:${translation.related_content_id}:${sourceLanguage}:link`,
        result,
      });
    }

    const uploadedDocument = trimToNull(translation.uploaded_document);
    if (uploadedDocument) {
      await this.writeRelatedContentMedia({
        collectionId,
        relatedContentId: translation.related_content_id,
        sourceTable: 'exhibition_related_content_i18n',
        languageId,
        source: translation,
        galleryId: baseContent.gallery_id,
        url: uploadedDocument,
        type: 'document',
        typeRequired: false,
        displayOrder: baseContent.display_order ?? 0,
        categoryId: baseContent.category_id,
        backwardCompatibility: `mwnf3_thematic_gallery:exhibition_related_content_i18n:${translation.related_content_id}:${sourceLanguage}:document`,
        result,
      });
    }

    // An entry with neither a link nor a document is not skipped any more: its
    // `further_reading` text is collected by `buildFurtherReadingEntry` and
    // written to the collection's `extra` once the whole table has been read.
  }

  private async writeRelatedContentMedia(parameters: {
    collectionId: string;
    relatedContentId: number;
    sourceTable: string;
    languageId: string | null;
    source: LegacyExhibitionRelatedContent | LegacyExhibitionRelatedContentI18n;
    galleryId: number;
    url: string;
    type: 'audio' | 'video' | 'document' | null;
    typeRequired: boolean;
    displayOrder: number;
    categoryId: number | null;
    backwardCompatibility: string;
    result: ImportResult;
  }): Promise<void> {
    let resolvedType = parameters.type;
    if (parameters.typeRequired && !resolvedType) {
      const ext = path.extname(parameters.url).slice(1).toLowerCase();
      resolvedType = mapContentType(ext) ?? 'document';
      parameters.result.warnings.push(
        `related_content ${parameters.source.related_content_id ?? '?'}: missing type_resource, inferred '${resolvedType}' from URL`
      );
    }

    const sourceTitle =
      trimToNull(parameters.source.title) ?? trimToNull(parameters.source.entity_name);
    let title: string;
    if (sourceTitle) {
      title = sourceTitle;
    } else {
      const segment =
        path.basename(new URL(parameters.url, 'http://x').pathname).split('?')[0] || '';
      title = segment || `Related content ${String(parameters.source.related_content_id ?? '?')}`;
      parameters.result.warnings.push(
        `related_content ${parameters.source.related_content_id ?? '?'}: missing title, derived '${title}' from URL`
      );
    }

    if (await this.entityExistsAsync(parameters.backwardCompatibility, 'collection_media')) {
      parameters.result.skipped++;
      this.showSkipped();
      return;
    }

    const description = trimToNull(parameters.source.description);
    const mediaData: CollectionMediaData = {
      collection_id: parameters.collectionId,
      language_id: parameters.languageId,
      type: resolvedType ?? 'document',
      title: convertHtmlToMarkdown(title),
      description: description ? this.markdownOf(description, parameters.galleryId) : null,
      url: parameters.url,
      display_order: parameters.displayOrder,
      extra: buildExtra({
        category_id: parameters.categoryId,
        further_reading: parameters.source.further_reading,
        entity_location: parameters.source.entity_location,
        entity_country: parameters.source.entity_country,
        authors: parameters.source.authors,
        type_resource: parameters.source.type_resource,
      }),
      backward_compatibility: parameters.backwardCompatibility,
    };

    this.collectSample(
      parameters.sourceTable,
      parameters.source as unknown as Record<string, unknown>,
      'success',
      undefined,
      parameters.languageId ?? undefined
    );

    if (!this.isDryRun && !this.isSampleOnlyMode) {
      await this.context.strategy.writeCollectionMedia(mediaData);
    } else {
      this.logInfo(
        `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create related content media: ${parameters.url} (${mediaData.type})`
      );
    }

    parameters.result.imported++;
    this.showProgress();
  }
}
