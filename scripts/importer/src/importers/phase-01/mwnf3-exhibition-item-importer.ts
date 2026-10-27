/**
 * MWNF3 Exhibition Item Importer
 *
 * Links items to mwnf3 exhibition page Collections via the collection_item pivot,
 * and imports custom images as CollectionImage records.
 *
 * Item references (exhibition_page_images.ref_item, artintro_page_images.ref_item):
 * - Format: 'O;ISL;jo;1;8' (type;project;country;partner;number) for objects
 * - Format: 'M;BAR;it;12;30' for monuments
 * - Empty ref_item on a page with a custom exhibition photo → an item of its
 *   own (Pascal, 2026-10-27): a picture with no parent, the photo as its
 *   image, the placement's caption as its texts in every language, tagged
 *   `custom exhibition picture`, placed like any item. Legacy showed such a
 *   photo with its caption and no record behind it.
 * - Empty ref_item otherwise = custom image (CollectionImage, not a pivot)
 *
 * What a placement links (`picture`, the path legacy shows):
 * - one of the referenced item's own pictures → that picture's child item
 *   (type 'picture', which the picture importers create): an item placed
 *   twice on a page with two of its pictures is two placements, each with
 *   its own texts, and the picture is the one legacy showed;
 * - a custom exhibition photo of the item (custom/exhibition/…, which legacy's
 *   picture tables do not list) → a picture child item of the item made for
 *   it, tagged `custom exhibition picture` (image-type) so the exporters keep
 *   it off the item's own pictures (Pascal, 2026-10-27);
 * - any other picture (a path legacy's picture tables do not list) → the item
 *   itself, and the picture becomes a CollectionImage of the page at the
 *   placement's position, as legacy's other custom pictures are;
 * - no picture → the item itself.
 * A record placed twice on one page keeps its first placement (legacy shows
 * the first on page load); the others are reported — a legacy data error
 * (#2360).
 *
 * Exhibition-level images (exhibition_images.ref_item):
 * - Same format, linked to exhibition Collection
 * - 92 item references + 2 custom images
 *
 * EAV metadata (exhibition_page_images_fields):
 * - detail_justification, detail_name, item_artist, item_date, item_dynasty,
 *   item_location, item_material, item_museum, item_name → stored in collection_item pivot extra
 *
 * Image detail annotations (exhibition_page_image_details + fields):
 * - Stored as nested array in the parent page-image's collection_item extra
 *
 * Dependencies:
 * - Mwnf3ExhibitionImporter (hierarchy collections must exist)
 * - ObjectImporter, MonumentImporter (items must exist)
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import type {
  Mwnf3LegacyExhibitionPageImage,
  Mwnf3LegacyExhibitionPageImageDetail,
  Mwnf3LegacyExhibitionLevelImage,
  Mwnf3LegacyArtintroPageImage,
} from '../../domain/types/index.js';
import { TagHelper } from '../../helpers/tag-helper.js';
import { formatBackwardCompatibility } from '../../utils/backward-compatibility.js';
import { mapCountryCode, mapLanguageCode } from '../../utils/code-mappings.js';
import { convertHtmlToMarkdown } from '../../utils/html-to-markdown.js';
import {
  monumentPictureBackwardCompatibility,
  objectPictureBackwardCompatibility,
} from '../../utils/picture-backward-compatibility.js';

const MWNF3_SCHEMA = 'mwnf3';

/** Legacy's exhibition-only photos of an item. */
const CUSTOM_PICTURE = /^custom\//i;

/** The tag that marks a custom exhibition photo's picture item (category `image-type`). */
export const CUSTOM_PICTURE_TAG = 'custom exhibition picture';

/** An item picture of legacy's picture tables, found by its path. */
interface LegacyPicture {
  /** The picture child item it was imported as. */
  pictureBackwardCompat: string;
  /** The item it is a picture of. */
  itemBackwardCompat: string;
}

/** What one placement writes: the record it links, and a picture of its own. */
interface Placement {
  linkedId: string;
  /** A picture that is none of the item's own, kept as a page image. */
  pagePicture: string | null;
}

/**
 * Parsed ref_item components.
 */
interface ParsedRefItem {
  type: 'object' | 'monument';
  projectId: string;
  country: string;
  partnerId: string;
  number: number;
}

/**
 * Supported EAV field names for image placement metadata.
 */
const IMAGE_EAV_FIELDS_PAGE = [
  'detail_name',
  'detail_justification',
  'item_artist',
  'item_date',
  'item_dynasty',
  'item_location',
  'item_material',
  'item_museum',
  'item_name',
] as const;

const IMAGE_EAV_FIELDS_EXHIBITION = [
  'item_date',
  'item_description',
  'item_dynasty',
  'item_location',
  'item_museum',
  'item_name',
] as const;

const IMAGE_EAV_FIELDS_ARTINTRO = [
  'detail_name',
  'detail_justification',
  'item_date',
  'item_dynasty',
  'item_location',
  'item_museum',
  'item_name',
] as const;

type ImageEavFieldName = string;

/**
 * Pivoted EAV: non-empty image placement metadata fields.
 * Each supported field is a language-keyed map.
 */
type ImageEav = Record<ImageEavFieldName, Record<string, string>>;

export class Mwnf3ExhibitionItemImporter extends BaseImporter {
  /** legacy's item pictures by lowercased path */
  private pictures = new Map<string, LegacyPicture>();
  /** `collection:record` pairs already placed, so a second placement is reported, not merged */
  private placed = new Set<string>();

  getName(): string {
    return 'Mwnf3ExhibitionItemImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      this.logInfo('Importing mwnf3 exhibition item references and custom images...');

      this.pictures = await this.loadPictures();
      this.placed = new Set();

      // ========================================================================
      // Pass 1: Page-level images (2,394 rows)
      // ========================================================================
      await this.importPageImages(result);

      // ========================================================================
      // Pass 2: Exhibition-level images (94 rows)
      // ========================================================================
      await this.importExhibitionLevelImages(result);

      // ========================================================================
      // Pass 3: Artintro page images (158 rows, all item references)
      // ========================================================================
      await this.importArtintroPageImages(result);

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(message);
      this.logError('Mwnf3ExhibitionItemImporter', message);
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // Pass 1: Page-level images
  // --------------------------------------------------------------------------
  private async importPageImages(result: ImportResult): Promise<void> {
    // The exhibition's project: an item made for a photo placed with no item
    // belongs to it.
    const images = await this.context.legacyDb.query<Mwnf3LegacyExhibitionPageImage & { project_id: string | null }>(
      `SELECT pi.image_id, pi.page_id, pi.n, pi.n2, pi.ref_item, pi.picture, e.project_id
       FROM ${MWNF3_SCHEMA}.exhibition_page_images pi
       LEFT JOIN ${MWNF3_SCHEMA}.exhibition_pages p ON p.page_id = pi.page_id
       LEFT JOIN ${MWNF3_SCHEMA}.exhibition_themes t ON t.theme_id = p.theme_id
       LEFT JOIN ${MWNF3_SCHEMA}.exhibitions e ON e.exhibition_id = t.exhibition_id
       ORDER BY pi.page_id, pi.n, pi.n2`
    );

    this.logInfo(`Found ${images.length} exhibition page images`);

    // Pre-load EAV data for editorial fields (detail_name, detail_justification only)
    const imageEavMap = await this.loadImageEav();

    // Pre-load detail annotations
    const detailMap = await this.loadImageDetails();

    for (const img of images) {
      try {
        const collectionBackwardCompat = `${MWNF3_SCHEMA}:exhibition_pages:${img.page_id}`;
        const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
        if (!collectionId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `Page image ${img.image_id}: Page collection not found (${collectionBackwardCompat})`
          );
          this.logWarning(
            `Page image ${img.image_id}: Page collection not found (${collectionBackwardCompat}), skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const parsed = this.parseRefItem(img.ref_item);

        if (parsed) {
          // Item reference → collection_item pivot
          const itemBackwardCompat = this.buildItemBackwardCompat(parsed);
          const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
          if (!itemId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Page image ${img.image_id}: Item not found (${itemBackwardCompat})`
            );
            this.logWarning(
              `Page image ${img.image_id}: Item not found (${itemBackwardCompat}), skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Build extra with ordering and editorial EAV
          const extra: Record<string, unknown> = {
            n: img.n,
            n2: img.n2,
          };

          // Merge EAV placement metadata
          const eav = imageEavMap.get(img.image_id);
          if (eav) {
            for (const [field, langMap] of Object.entries(eav)) {
              extra[field] = langMap;
            }
          }

          // Merge detail annotations
          const details = detailMap.get(img.image_id);
          if (details && details.length > 0) {
            extra.details = details;
          }

          await this.writePlacement(
            `Page image ${img.image_id}`,
            collectionId,
            { itemId, itemBackwardCompat, parsed, picture: img.picture, n: img.n, extra },
            result
          );
        } else if (CUSTOM_PICTURE.test(img.picture?.trim() ?? '') && img.project_id) {
          // A custom photo with no item behind it → an item of its own.
          const eav = imageEavMap.get(img.image_id) ?? {};
          const extra: Record<string, unknown> = { n: img.n, n2: img.n2, ...eav };
          const details = detailMap.get(img.image_id);
          if (details && details.length > 0) extra.details = details;

          const label = `Page image ${img.image_id}`;
          const itemId = await this.standalonePicture(img.picture.trim(), img.project_id, eav);
          if (!itemId) {
            // A dry or sample run writes nothing.
            result.imported++;
            this.showProgress();
            continue;
          }
          const placedKey = `${collectionId}:${itemId}`;
          if (this.placed.has(placedKey)) {
            result.warnings = result.warnings || [];
            result.warnings.push(`${label}: placed twice on the same page, first placement kept`);
            this.logWarning(`${label}: placed twice on the same page, first placement kept`);
            result.skipped++;
            this.showSkipped();
            continue;
          }
          this.placed.add(placedKey);
          await this.context.strategy.writeCollectionItem({
            collection_id: collectionId,
            item_id: itemId,
            display_order: img.n,
            extra,
          });
          result.imported++;
          this.showProgress();
        } else {
          // Custom image (empty ref_item) → CollectionImage. collection_images
          // has no backward_compatibility column — identity is (owner, legacy
          // path).
          if (await this.imageExistsAsync('collection_images', collectionId, img.picture)) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeCollectionImage({
            collection_id: collectionId,
            path: img.picture,
            original_name: img.picture.split('/').pop() || img.picture,
            mime_type: 'image/jpeg',
            size: 1, // Placeholder for ImageSyncTool
            alt_text: null,
            display_order: img.n,
          });

          result.imported++;
          this.showProgress();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Page image ${img.image_id}: ${message}`);
        this.logError(`Page image ${img.image_id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Pass 2: Exhibition-level images
  // --------------------------------------------------------------------------
  private async importExhibitionLevelImages(result: ImportResult): Promise<void> {
    const images = await this.context.legacyDb.query<Mwnf3LegacyExhibitionLevelImage>(
      `SELECT image_id, exhibition_id, n, n2, ref_item, picture
       FROM ${MWNF3_SCHEMA}.exhibition_images
       ORDER BY exhibition_id, n, n2`
    );

    this.logInfo(`Found ${images.length} exhibition-level images`);

    // Pre-load EAV placement metadata for exhibition-level images
    const exhibitionImageEavMap = await this.loadExhibitionImageEav();

    for (const img of images) {
      try {
        const collectionBackwardCompat = `${MWNF3_SCHEMA}:exhibitions:${img.exhibition_id}`;
        const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
        if (!collectionId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `Exhibition image ${img.image_id}: Exhibition collection not found (${collectionBackwardCompat})`
          );
          this.logWarning(
            `Exhibition image ${img.image_id}: Exhibition collection not found (${collectionBackwardCompat}), skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const parsed = this.parseRefItem(img.ref_item);

        if (parsed) {
          // Item reference → collection_item pivot
          const itemBackwardCompat = this.buildItemBackwardCompat(parsed);
          const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
          if (!itemId) {
            result.warnings = result.warnings || [];
            result.warnings.push(
              `Exhibition image ${img.image_id}: Item not found (${itemBackwardCompat})`
            );
            this.logWarning(
              `Exhibition image ${img.image_id}: Item not found (${itemBackwardCompat}), skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Build extra with ordering and EAV placement metadata
          const extra: Record<string, unknown> = {
            n: img.n,
            n2: img.n2,
          };

          // Merge exhibition-level EAV placement metadata
          const exhEav = exhibitionImageEavMap.get(img.image_id);
          if (exhEav) {
            for (const [field, langMap] of Object.entries(exhEav)) {
              extra[field] = langMap;
            }
          }

          await this.writePlacement(
            `Exhibition image ${img.image_id}`,
            collectionId,
            { itemId, itemBackwardCompat, parsed, picture: img.picture, n: img.n, extra },
            result
          );
        } else {
          // Custom image → CollectionImage. collection_images has no
          // backward_compatibility column — identity is (owner, legacy path).
          if (await this.imageExistsAsync('collection_images', collectionId, img.picture)) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (this.isDryRun || this.isSampleOnlyMode) {
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeCollectionImage({
            collection_id: collectionId,
            path: img.picture,
            original_name: img.picture.split('/').pop() || img.picture,
            mime_type: 'image/jpeg',
            size: 1,
            alt_text: null,
            display_order: img.n,
          });

          result.imported++;
          this.showProgress();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Exhibition image ${img.image_id}: ${message}`);
        this.logError(`Exhibition image ${img.image_id}`, message);
        this.showError();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Pass 3: Artintro page images (all item references, no custom)
  // --------------------------------------------------------------------------
  private async importArtintroPageImages(result: ImportResult): Promise<void> {
    const images = await this.context.legacyDb.query<Mwnf3LegacyArtintroPageImage>(
      `SELECT image_id, page_id, n, n2, ref_item, picture
       FROM ${MWNF3_SCHEMA}.artintro_page_images
       ORDER BY page_id, n, n2`
    );

    this.logInfo(`Found ${images.length} artintro page images`);

    // Pre-load EAV placement metadata for artintro page images
    const artintroImageEavMap = await this.loadArtintroImageEav();

    for (const img of images) {
      try {
        const collectionBackwardCompat = `${MWNF3_SCHEMA}:artintro_pages:${img.page_id}`;
        const collectionId = await this.getEntityUuidAsync(collectionBackwardCompat, 'collection');
        if (!collectionId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `Artintro page image ${img.image_id}: Page collection not found (${collectionBackwardCompat})`
          );
          this.logWarning(
            `Artintro page image ${img.image_id}: Page collection not found, skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const parsed = this.parseRefItem(img.ref_item);
        if (!parsed) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `Artintro page image ${img.image_id}: Could not parse ref_item '${img.ref_item}'`
          );
          this.logWarning(
            `Artintro page image ${img.image_id}: Could not parse ref_item '${img.ref_item}', skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const itemBackwardCompat = this.buildItemBackwardCompat(parsed);
        const itemId = await this.getEntityUuidAsync(itemBackwardCompat, 'item');
        if (!itemId) {
          result.warnings = result.warnings || [];
          result.warnings.push(
            `Artintro page image ${img.image_id}: Item not found (${itemBackwardCompat})`
          );
          this.logWarning(
            `Artintro page image ${img.image_id}: Item not found (${itemBackwardCompat}), skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Build extra with ordering and EAV placement metadata
        const artintroExtra: Record<string, unknown> = {
          n: img.n,
          n2: img.n2,
        };

        // Merge artintro EAV placement metadata
        const artintroEav = artintroImageEavMap.get(img.image_id);
        if (artintroEav) {
          for (const [field, langMap] of Object.entries(artintroEav)) {
            artintroExtra[field] = langMap;
          }
        }

        await this.writePlacement(
          `Artintro page image ${img.image_id}`,
          collectionId,
          { itemId, itemBackwardCompat, parsed, picture: img.picture, n: img.n, extra: artintroExtra },
          result
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Artintro page image ${img.image_id}: ${message}`);
        this.logError(`Artintro page image ${img.image_id}`, message);
        this.showError();
      }
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Write one placement of an item on a collection: the record it links (see
   * the file header), its position and texts, and a picture that is none of
   * the item's own as a page image at the same position.
   */
  private async writePlacement(
    label: string,
    collectionId: string,
    placement: {
      itemId: string;
      itemBackwardCompat: string;
      parsed: ParsedRefItem;
      picture: string | null;
      n: number;
      extra: Record<string, unknown>;
    },
    result: ImportResult
  ): Promise<void> {
    const { linkedId, pagePicture } = await this.resolvePlacement(label, placement, result);

    const placedKey = `${collectionId}:${linkedId}`;
    if (this.placed.has(placedKey)) {
      result.warnings = result.warnings || [];
      result.warnings.push(`${label}: placed twice on the same page, first placement kept`);
      this.logWarning(`${label}: placed twice on the same page, first placement kept`);
      result.skipped++;
      this.showSkipped();
      return;
    }
    this.placed.add(placedKey);

    if (this.isDryRun || this.isSampleOnlyMode) {
      result.imported++;
      this.showProgress();
      return;
    }

    await this.context.strategy.writeCollectionItem({
      collection_id: collectionId,
      item_id: linkedId,
      display_order: placement.n,
      extra: placement.extra,
    });

    if (pagePicture && !(await this.imageExistsAsync('collection_images', collectionId, pagePicture))) {
      await this.context.strategy.writeCollectionImage({
        collection_id: collectionId,
        path: pagePicture,
        original_name: pagePicture.split('/').pop() || pagePicture,
        mime_type: 'image/jpeg',
        size: 1, // Placeholder for ImageSyncTool
        alt_text: null,
        display_order: placement.n,
      });
    }

    result.imported++;
    this.showProgress();
  }

  /** The record a placement links, and the picture it keeps as a page image. */
  private async resolvePlacement(
    label: string,
    placement: { itemId: string; itemBackwardCompat: string; parsed: ParsedRefItem; picture: string | null },
    result: ImportResult
  ): Promise<Placement> {
    const picture = placement.picture?.trim() ?? '';
    if (!picture) return { linkedId: placement.itemId, pagePicture: null };

    if (CUSTOM_PICTURE.test(picture)) {
      const pictureId = await this.customPicture(placement.parsed, placement.itemId, picture);
      return pictureId ? { linkedId: pictureId, pagePicture: null } : { linkedId: placement.itemId, pagePicture: picture };
    }

    const own = this.pictures.get(picture.toLowerCase());
    if (!own || own.itemBackwardCompat.toLowerCase() !== placement.itemBackwardCompat.toLowerCase()) {
      return { linkedId: placement.itemId, pagePicture: picture };
    }

    const pictureId = await this.getEntityUuidAsync(own.pictureBackwardCompat, 'item');
    if (!pictureId) {
      result.warnings = result.warnings || [];
      result.warnings.push(
        `${label}: picture item not found (${own.pictureBackwardCompat}), kept as a page image`
      );
      this.logWarning(`${label}: picture item not found (${own.pictureBackwardCompat}), kept as a page image`);
      return { linkedId: placement.itemId, pagePicture: picture };
    }
    return { linkedId: pictureId, pagePicture: null };
  }

  /**
   * A custom exhibition photo of an item as a picture child item of that
   * item, made once per photo: its image is the photo, and the
   * `custom exhibition picture` tag keeps it off the item's own pictures, which
   * legacy's sheet never showed it among. Null in a dry or sample run, where
   * nothing is written; the placement then falls back to the item.
   */
  private async customPicture(parsed: ParsedRefItem, itemId: string, picture: string): Promise<string | null> {
    const backwardCompat = formatBackwardCompatibility({
      schema: MWNF3_SCHEMA,
      table: 'exhibition_custom_pictures',
      pkValues: [picture.toLowerCase()],
    });
    const existing = await this.getEntityUuidAsync(backwardCompat, 'item');
    if (existing) return existing;
    if (this.isDryRun || this.isSampleOnlyMode) return null;

    const projectBackwardCompat = formatBackwardCompatibility({
      schema: MWNF3_SCHEMA,
      table: 'projects',
      pkValues: [parsed.projectId.toLowerCase()],
    });
    const partnerBackwardCompat =
      parsed.type === 'monument'
        ? formatBackwardCompatibility({
            schema: MWNF3_SCHEMA,
            table: 'institutions',
            pkValues: [this.formatPartnerId('Mon', parsed.partnerId), parsed.country.toLowerCase()],
          })
        : formatBackwardCompatibility({
            schema: MWNF3_SCHEMA,
            table: 'museums',
            pkValues: [this.formatPartnerId('Mus', parsed.partnerId), parsed.country.toLowerCase()],
          });

    const pictureId = await this.context.strategy.writeItem({
      type: 'picture',
      internal_name: `Custom exhibition picture ${picture}`,
      collection_id: await this.getEntityUuidAsync(projectBackwardCompat, 'collection'),
      partner_id: await this.getEntityUuidAsync(partnerBackwardCompat, 'partner'),
      parent_id: itemId,
      country_id: mapCountryCode(parsed.country.toLowerCase()),
      project_id: await this.getEntityUuidAsync(projectBackwardCompat, 'project'),
      owner_reference: null,
      mwnf_reference: null,
      display_order: null,
      backward_compatibility: backwardCompat,
    });
    await this.context.strategy.writeItemImage({
      item_id: pictureId,
      path: picture,
      original_name: picture.split('/').pop() || picture,
      mime_type: 'image/jpeg',
      size: 1, // Placeholder for ImageSyncTool
      alt_text: null,
      display_order: 1,
    });
    const tags = new TagHelper(this.context.strategy, this.context.tracker, this.context.logger);
    const language = this.context.tracker.getMetadata('default_language_id') ?? 'eng';
    await tags.attachToItem(pictureId, await tags.findOrCreateList(CUSTOM_PICTURE_TAG, 'image-type', language));
    this.registerEntity(pictureId, backwardCompat, 'item');
    return pictureId;
  }

  /**
   * A custom exhibition photo placed with no item, as an item of its own: a
   * picture with no parent, the photo as its image, tagged
   * `custom exhibition picture`, made once per photo. Its texts are the
   * placement's caption in each language that names it (legacy printed that
   * caption and nothing else): the name, the date, the place, the museum and
   * the justification; the dynasty, which an item translation has no column
   * for, in its extra. Null in a dry or sample run, where nothing is written.
   */
  private async standalonePicture(picture: string, projectId: string, eav: ImageEav): Promise<string | null> {
    const backwardCompat = formatBackwardCompatibility({
      schema: MWNF3_SCHEMA,
      table: 'exhibition_custom_pictures',
      pkValues: [picture.toLowerCase()],
    });
    const existing = await this.getEntityUuidAsync(backwardCompat, 'item');
    if (existing) return existing;
    if (this.isDryRun || this.isSampleOnlyMode) return null;

    const projectBackwardCompat = formatBackwardCompatibility({
      schema: MWNF3_SCHEMA,
      table: 'projects',
      pkValues: [projectId.toLowerCase()],
    });
    const contextId = await this.getEntityUuidAsync(projectBackwardCompat, 'context');
    if (!contextId) throw new Error(`Context not found: ${projectBackwardCompat}`);

    const itemId = await this.context.strategy.writeItem({
      type: 'picture',
      internal_name: `Custom exhibition picture ${picture}`,
      collection_id: await this.getEntityUuidAsync(projectBackwardCompat, 'collection'),
      partner_id: null,
      parent_id: null,
      country_id: null,
      project_id: await this.getEntityUuidAsync(projectBackwardCompat, 'project'),
      owner_reference: null,
      mwnf_reference: null,
      display_order: null,
      backward_compatibility: backwardCompat,
    });
    await this.context.strategy.writeItemImage({
      item_id: itemId,
      path: picture,
      original_name: picture.split('/').pop() || picture,
      mime_type: 'image/jpeg',
      size: 1, // Placeholder for ImageSyncTool
      alt_text: null,
      display_order: 1,
    });
    const tags = new TagHelper(this.context.strategy, this.context.tracker, this.context.logger);
    const language = this.context.tracker.getMetadata('default_language_id') ?? 'eng';
    await tags.attachToItem(itemId, await tags.findOrCreateList(CUSTOM_PICTURE_TAG, 'image-type', language));

    const MAX_NAME_LENGTH = 255;
    for (const [lang, name] of Object.entries(eav.item_name ?? {})) {
      const text = (field: string) => eav[field]?.[lang] ?? null;
      await this.context.strategy.writeItemTranslation({
        item_id: itemId,
        language_id: mapLanguageCode(lang),
        context_id: contextId,
        backward_compatibility: `${backwardCompat}:${lang}`,
        name: name.slice(0, MAX_NAME_LENGTH),
        description: text('detail_justification'),
        dates: text('item_date'),
        location: text('item_location'),
        holder: text('item_museum'),
        extra: text('item_dynasty') ? JSON.stringify({ dynasty: text('item_dynasty') }) : null,
      });
    }

    this.registerEntity(itemId, backwardCompat, 'item');
    return itemId;
  }

  /**
   * Legacy's item pictures by lowercased path, each with the picture child
   * item it was imported as and the item it is a picture of. Rows are one
   * per language; a path is one picture.
   */
  private async loadPictures(): Promise<Map<string, LegacyPicture>> {
    const map = new Map<string, LegacyPicture>();
    const add = (path: string, picture: LegacyPicture) => {
      const key = path.trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, picture);
    };

    const objects = await this.context.legacyDb.query<{
      project_id: string;
      country: string;
      museum_id: string;
      number: number;
      type: string;
      image_number: number;
      path: string;
    }>(
      `SELECT DISTINCT project_id, country, museum_id, number, type, image_number, path
       FROM ${MWNF3_SCHEMA}.objects_pictures
       WHERE path IS NOT NULL AND TRIM(path) != ''
       ORDER BY project_id, country, museum_id, number, type, image_number`
    );
    for (const row of objects) {
      add(row.path, {
        pictureBackwardCompat: objectPictureBackwardCompatibility(row),
        itemBackwardCompat: `${MWNF3_SCHEMA}:objects:${row.project_id.toLowerCase()}:${row.country.toLowerCase()}:${row.museum_id}:${row.number}`,
      });
    }

    const monuments = await this.context.legacyDb.query<{
      project_id: string;
      country: string;
      institution_id: string;
      number: number;
      type: string;
      image_number: number;
      path: string;
    }>(
      `SELECT DISTINCT project_id, country, institution_id, number, type, image_number, path
       FROM ${MWNF3_SCHEMA}.monuments_pictures
       WHERE path IS NOT NULL AND TRIM(path) != ''
       ORDER BY project_id, country, institution_id, number, type, image_number`
    );
    for (const row of monuments) {
      add(row.path, {
        pictureBackwardCompat: monumentPictureBackwardCompatibility(row),
        itemBackwardCompat: `${MWNF3_SCHEMA}:monuments:${row.project_id.toLowerCase()}:${row.country.toLowerCase()}:${row.institution_id}:${row.number}`,
      });
    }

    this.logInfo(`Loaded ${map.size} item pictures by path`);
    return map;
  }

  /**
   * Parse mwnf3 ref_item format: 'O;ISL;jo;1;8' or 'M;BAR;it;12;30'.
   * Returns null for empty/invalid references.
   */
  private parseRefItem(refItem: string): ParsedRefItem | null {
    if (!refItem || !refItem.trim()) return null;

    const parts = refItem.split(';').map((s) => s.trim());
    if (parts.length < 5) return null;

    const [typeCode, projectId, country, partnerId, numberStr] = parts;
    const number = parseInt(numberStr!, 10);
    if (isNaN(number)) return null;

    const type = typeCode === 'M' ? 'monument' : 'object';
    return { type, projectId: projectId!, country: country!, partnerId: partnerId!, number };
  }

  /**
   * Build a backward_compatibility key for an mwnf3 item from parsed ref_item.
   * Objects: mwnf3:objects:{project}:{country}:{museum_id}:{number}
   * Monuments: mwnf3:monuments:{project}:{country}:{institution_id}:{number}
   *
   * ref_item stores raw partner IDs (e.g., '1', '1_H', '12') that must be
   * converted to the museum/institution format used in the objects/monuments
   * tables: Mus01, Mus01_H, Mus12, Mon01, etc.
   */
  private buildItemBackwardCompat(parsed: ParsedRefItem): string {
    const table = parsed.type === 'monument' ? 'monuments' : 'objects';
    const prefix = parsed.type === 'monument' ? 'Mon' : 'Mus';
    const formattedPartnerId = this.formatPartnerId(prefix, parsed.partnerId);
    return `${MWNF3_SCHEMA}:${table}:${parsed.projectId.toLowerCase()}:${parsed.country.toLowerCase()}:${formattedPartnerId}:${parsed.number}`;
  }

  /**
   * Convert a raw ref_item partner ID to the museum/institution format.
   * Examples: '1' → 'Mus01', '1_H' → 'Mus01_H', '12' → 'Mus12'
   */
  private formatPartnerId(prefix: string, rawId: string): string {
    const underscoreIdx = rawId.indexOf('_');
    if (underscoreIdx !== -1) {
      const numPart = rawId.substring(0, underscoreIdx);
      const suffix = rawId.substring(underscoreIdx);
      return `${prefix}${numPart.padStart(2, '0')}${suffix}`;
    }
    return `${prefix}${rawId.padStart(2, '0')}`;
  }

  /**
   * Pivot EAV rows from a query result into Map<image_id, ImageEav>.
   */
  private pivotImageEav(
    rows: Array<{ entity_id: number; lang_id: string; field: string; value: string }>
  ): Map<number, ImageEav> {
    const map = new Map<number, ImageEav>();
    for (const row of rows) {
      if (row.value == null || !row.value.trim()) continue;
      if (!map.has(row.entity_id)) {
        map.set(row.entity_id, {});
      }
      const eav = map.get(row.entity_id)!;
      if (!eav[row.field]) eav[row.field] = {};
      eav[row.field]![row.lang_id] = convertHtmlToMarkdown(row.value);
    }
    return map;
  }

  /**
   * Load and pivot exhibition_page_images_fields EAV for all supported placement fields.
   * Returns Map<image_id, ImageEav>.
   */
  private async loadImageEav(): Promise<Map<number, ImageEav>> {
    const fieldList = IMAGE_EAV_FIELDS_PAGE.map((f) => `'${f}'`).join(', ');
    const rows = await this.context.legacyDb.query<{
      entity_id: number;
      lang_id: string;
      field: string;
      value: string;
    }>(
      `SELECT image_id AS entity_id, lang_id, field, value
       FROM ${MWNF3_SCHEMA}.exhibition_page_images_fields
       WHERE field IN (${fieldList})
         AND value IS NOT NULL AND TRIM(value) != ''
       ORDER BY image_id, lang_id, field`
    );

    const map = this.pivotImageEav(rows);
    this.logInfo(`Loaded placement EAV for ${map.size} page images`);
    return map;
  }

  /**
   * Load exhibition_page_image_details + EAV fields (all supported placement fields).
   * Returns Map<parent_image_id, detail_annotation[]>.
   */
  private async loadImageDetails(): Promise<Map<number, Array<Record<string, unknown>>>> {
    const details = await this.context.legacyDb.query<Mwnf3LegacyExhibitionPageImageDetail>(
      `SELECT image_detail_id AS detail_id, image_id, n, n2, ref_detail_item, picture_details
       FROM ${MWNF3_SCHEMA}.exhibition_page_image_details
       ORDER BY image_id, n, n2`
    );

    const detailFieldList = IMAGE_EAV_FIELDS_PAGE.map((f) => `'${f}'`).join(', ');
    const detailEavRows = await this.context.legacyDb.query<{
      entity_id: number;
      lang_id: string;
      field: string;
      value: string;
    }>(
      `SELECT image_detail_id AS entity_id, lang_id, field, value
       FROM ${MWNF3_SCHEMA}.exhibition_page_image_details_fields
       WHERE field IN (${detailFieldList})
         AND value IS NOT NULL AND TRIM(value) != ''
       ORDER BY image_detail_id, lang_id, field`
    );

    const detailEav = this.pivotImageEav(detailEavRows);

    // Group by parent image_id
    const map = new Map<number, Array<Record<string, unknown>>>();
    for (const d of details) {
      if (!map.has(d.image_id)) {
        map.set(d.image_id, []);
      }
      const annotation: Record<string, unknown> = {
        n: d.n,
        n2: d.n2,
        ref_detail_item: d.ref_detail_item,
        picture_details: d.picture_details,
      };

      const eav = detailEav.get(d.detail_id);
      if (eav) {
        for (const [field, langMap] of Object.entries(eav)) {
          annotation[field] = langMap;
        }
      }

      map.get(d.image_id)!.push(annotation);
    }

    this.logInfo(`Loaded ${details.length} detail annotations across ${map.size} parent images`);
    return map;
  }

  /**
   * Load and pivot exhibition_images_fields EAV for all supported placement fields.
   * Returns Map<image_id, ImageEav>.
   */
  private async loadExhibitionImageEav(): Promise<Map<number, ImageEav>> {
    const fieldList = IMAGE_EAV_FIELDS_EXHIBITION.map((f) => `'${f}'`).join(', ');
    const rows = await this.context.legacyDb.query<{
      entity_id: number;
      lang_id: string;
      field: string;
      value: string;
    }>(
      `SELECT image_id AS entity_id, lang_id, field, value
       FROM ${MWNF3_SCHEMA}.exhibition_images_fields
       WHERE field IN (${fieldList})
         AND value IS NOT NULL AND TRIM(value) != ''
       ORDER BY image_id, lang_id, field`
    );

    const map = this.pivotImageEav(rows);
    this.logInfo(`Loaded placement EAV for ${map.size} exhibition-level images`);
    return map;
  }

  /**
   * Load and pivot artintro_page_images_fields EAV for all supported placement fields.
   * Returns Map<image_id, ImageEav>.
   */
  private async loadArtintroImageEav(): Promise<Map<number, ImageEav>> {
    const fieldList = IMAGE_EAV_FIELDS_ARTINTRO.map((f) => `'${f}'`).join(', ');
    const rows = await this.context.legacyDb.query<{
      entity_id: number;
      lang_id: string;
      field: string;
      value: string;
    }>(
      `SELECT image_id AS entity_id, lang_id, field, value
       FROM ${MWNF3_SCHEMA}.artintro_page_images_fields
       WHERE field IN (${fieldList})
         AND value IS NOT NULL AND TRIM(value) != ''
       ORDER BY image_id, lang_id, field`
    );

    const map = this.pivotImageEav(rows);
    this.logInfo(`Loaded placement EAV for ${map.size} artintro page images`);
    return map;
  }
}
