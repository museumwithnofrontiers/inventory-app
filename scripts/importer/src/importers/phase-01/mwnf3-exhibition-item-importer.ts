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
 * - legacy's "Awaiting Image" placeholder → the same: it is shown where a photo
 *   was never supplied and is a photo of nothing, so no picture item is made
 *   from it (Pascal, 2026-10-28);
 * - no picture → the item itself.
 * A record placed twice on one page keeps its first placement (legacy shows
 * the first on page load); the others are reported — a legacy data error
 * (#2360).
 *
 * Exhibition-level images (exhibition_images.ref_item):
 * - Same format, linked to exhibition Collection
 * - 92 item references + 2 custom photos, each an item of its own as on the
 *   pages (its caption its texts), or a CollectionImage for any other picture
 *
 * EAV metadata (exhibition_page_images_fields):
 * - detail_justification, detail_name, item_artist, item_date, item_dynasty,
 *   item_location, item_material, item_museum, item_name → stored in collection_item pivot extra
 *
 * Detail views (exhibition_page_image_details + fields, Baroque Art only):
 * legacy shows, at a placement's position, the detail pictures listed for it,
 * one view per detail n2, each with its own texts. Each becomes a placement of
 * its own (decided 2026-10-28) at the parent's n, with its n2, `parent_n2` (the
 * n2 of the placement it is a view of) and `detail_n`, linking:
 * - the monument-detail picture item it shows (monument_detail_pictures);
 * - else the monument detail it references, the picture (if any) kept as a
 *   page image, as for a placement;
 * - else, with no detail referenced, an item of its own under the placed
 *   item: its caption as its texts, tagged `custom exhibition picture`.
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

/** Legacy's "Awaiting Image" placeholder, shown where a photo was never supplied. */
const AWAITING_IMAGE = 'custom/exhibition/137.jpg';

const isAwaitingImage = (picture: string): boolean => picture.trim().toLowerCase() === AWAITING_IMAGE;

/** A custom exhibition photo: legacy's own exhibition-only photos, the placeholder excepted. */
const isCustomPhoto = (picture: string): boolean => CUSTOM_PICTURE.test(picture.trim()) && !isAwaitingImage(picture);

/** An item picture of legacy's picture tables, found by its path. */
interface LegacyPicture {
  /** The picture child item it was imported as. */
  pictureBackwardCompat: string;
  /** The item it is a picture of. */
  itemBackwardCompat: string;
}

/** A monument-detail picture of legacy's picture tables, found by its path. */
interface LegacyDetailPicture {
  /** The picture child item it was imported as. */
  pictureBackwardCompat: string;
  /** The monument detail it is a picture of. */
  detailBackwardCompat: string;
}

/** What one placement writes: the record it links, and a picture of its own. */
interface Placement {
  linkedId: string;
  /** A picture that is none of the item's own, kept as a page image. */
  pagePicture: string | null;
}

/** One detail view of a page placement (exhibition_page_image_details). */
interface DetailView {
  id: number;
  n: number;
  n2: number;
  ref: string;
  picture: string;
  eav: ImageEav;
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
  /** legacy's monument-detail pictures by lowercased path */
  private detailPictures = new Map<string, LegacyDetailPicture>();
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
      this.detailPictures = await this.loadDetailPictures();
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

    // Pre-load the detail views of each placement
    const detailMap = await this.loadDetailViews();

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

          await this.writePlacement(
            `Page image ${img.image_id}`,
            collectionId,
            { itemId, itemBackwardCompat, parsed, picture: img.picture, n: img.n, extra },
            result
          );
          await this.writeDetailViews(
            `Page image ${img.image_id}`,
            collectionId,
            img,
            { parsed, itemId },
            detailMap.get(img.image_id) ?? [],
            result
          );
        } else if (isCustomPhoto(img.picture ?? '') && img.project_id) {
          // A custom photo with no item behind it → an item of its own.
          const eav = imageEavMap.get(img.image_id) ?? {};
          const extra: Record<string, unknown> = { n: img.n, n2: img.n2, ...eav };

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
          await this.writeDetailViews(
            label,
            collectionId,
            img,
            { parsed: null, itemId },
            detailMap.get(img.image_id) ?? [],
            result
          );
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
    const images = await this.context.legacyDb.query<Mwnf3LegacyExhibitionLevelImage & { project_id: string | null }>(
      `SELECT ei.image_id, ei.exhibition_id, ei.n, ei.n2, ei.ref_item, ei.picture, e.project_id
       FROM ${MWNF3_SCHEMA}.exhibition_images ei
       LEFT JOIN ${MWNF3_SCHEMA}.exhibitions e ON e.exhibition_id = ei.exhibition_id
       ORDER BY ei.exhibition_id, ei.n, ei.n2`
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
        } else if (isCustomPhoto(img.picture ?? '') && img.project_id) {
          // A custom photo with no item behind it → an item of its own, its
          // caption its texts, as on the exhibition's pages: the introduction
          // printed it among the others.
          const eav = exhibitionImageEavMap.get(img.image_id) ?? {};
          const itemId = await this.standalonePicture(img.picture.trim(), img.project_id, eav);
          if (!itemId) {
            // A dry or sample run writes nothing.
            result.imported++;
            this.showProgress();
            continue;
          }
          const placedKey = `${collectionId}:${itemId}`;
          if (this.placed.has(placedKey)) {
            const label = `Exhibition image ${img.image_id}`;
            result.warnings = result.warnings || [];
            result.warnings.push(`${label}: placed twice on the same exhibition, first placement kept`);
            this.logWarning(`${label}: placed twice on the same exhibition, first placement kept`);
            result.skipped++;
            this.showSkipped();
            continue;
          }
          this.placed.add(placedKey);
          await this.context.strategy.writeCollectionItem({
            collection_id: collectionId,
            item_id: itemId,
            display_order: img.n,
            extra: { n: img.n, n2: img.n2, ...eav },
          });
          result.imported++;
          this.showProgress();
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
    const resolved = await this.resolvePlacement(label, placement, result);
    await this.writeLink(label, collectionId, resolved, placement.n, placement.extra, result);
  }

  /**
   * Write what a placement resolved to: its link, unless the page already
   * holds that record (a legacy data error, #2360: the first placement is
   * kept), and its page image at the same position.
   */
  private async writeLink(
    label: string,
    collectionId: string,
    { linkedId, pagePicture }: Placement,
    n: number,
    extra: Record<string, unknown>,
    result: ImportResult
  ): Promise<void> {
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
      display_order: n,
      extra,
    });

    if (pagePicture && !(await this.imageExistsAsync('collection_images', collectionId, pagePicture))) {
      await this.context.strategy.writeCollectionImage({
        collection_id: collectionId,
        path: pagePicture,
        original_name: pagePicture.split('/').pop() || pagePicture,
        mime_type: 'image/jpeg',
        size: 1, // Placeholder for ImageSyncTool
        alt_text: null,
        display_order: n,
      });
    }

    result.imported++;
    this.showProgress();
  }

  /**
   * Write the detail views of a page placement, each a placement of its own
   * (see the file header). `parent` is what the placement itself links: the
   * item it references, or the item made for its photo.
   */
  private async writeDetailViews(
    label: string,
    collectionId: string,
    placement: { n: number; n2: number; project_id: string | null },
    parent: { parsed: ParsedRefItem | null; itemId: string | null },
    views: DetailView[],
    result: ImportResult
  ): Promise<void> {
    for (const view of views) {
      const viewLabel = `${label}, detail view ${view.id}`;
      try {
        const extra: Record<string, unknown> = {
          n: placement.n,
          n2: view.n2,
          parent_n2: placement.n2,
          detail_n: view.n,
          ...view.eav,
        };
        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }
        const resolved = await this.resolveDetailView(viewLabel, view, parent, placement.project_id, result);
        if (!resolved) {
          result.skipped++;
          this.showSkipped();
          continue;
        }
        await this.writeLink(viewLabel, collectionId, resolved, placement.n, extra, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`${viewLabel}: ${message}`);
        this.logError(viewLabel, message);
        this.showError();
      }
    }
  }

  /** The record a detail view links, and the picture it keeps as a page image; null when it has none. */
  private async resolveDetailView(
    label: string,
    view: DetailView,
    parent: { parsed: ParsedRefItem | null; itemId: string | null },
    projectId: string | null,
    result: ImportResult
  ): Promise<Placement | null> {
    const warn = (message: string) => {
      result.warnings = result.warnings || [];
      result.warnings.push(`${label}: ${message}`);
      this.logWarning(`${label}: ${message}`);
    };
    const picture = view.picture?.trim() ?? '';
    const detailBackwardCompat = this.buildDetailBackwardCompat(view.ref);

    if (picture && !isAwaitingImage(picture) && detailBackwardCompat) {
      const own = this.detailPictures.get(picture.toLowerCase());
      if (own && own.detailBackwardCompat.toLowerCase() === detailBackwardCompat.toLowerCase()) {
        const pictureId = await this.getEntityUuidAsync(own.pictureBackwardCompat, 'item');
        if (pictureId) return { linkedId: pictureId, pagePicture: null };
        warn(`picture item not found (${own.pictureBackwardCompat}), the detail linked instead`);
      }
    }

    if (detailBackwardCompat) {
      const detailId = await this.getEntityUuidAsync(detailBackwardCompat, 'item');
      if (detailId) return { linkedId: detailId, pagePicture: picture || null };
      warn(`detail not found (${detailBackwardCompat}), skipping`);
      return null;
    }

    if (!parent.itemId) {
      warn('no detail referenced and no placed item, skipping');
      return null;
    }
    const viewId = await this.viewItem(view, parent.parsed, parent.itemId, projectId);
    return { linkedId: viewId, pagePicture: picture || null };
  }

  /**
   * A detail view that references no detail, as an item of its own under the
   * placed item: legacy showed its caption and no record behind it. Its texts
   * are that caption, and the `custom exhibition picture` tag keeps it off the
   * placed item's own pictures. Made once per view.
   */
  private async viewItem(
    view: DetailView,
    parsed: ParsedRefItem | null,
    parentItemId: string,
    projectId: string | null
  ): Promise<string> {
    const backwardCompat = formatBackwardCompatibility({
      schema: MWNF3_SCHEMA,
      table: 'exhibition_page_image_details',
      pkValues: [view.id],
    });
    const existing = await this.getEntityUuidAsync(backwardCompat, 'item');
    if (existing) return existing;

    const project = parsed?.projectId ?? projectId;
    if (!project) throw new Error('No project to place the view in');
    const projectBackwardCompat = formatBackwardCompatibility({
      schema: MWNF3_SCHEMA,
      table: 'projects',
      pkValues: [project.toLowerCase()],
    });
    const contextId = await this.getEntityUuidAsync(projectBackwardCompat, 'context');
    if (!contextId) throw new Error(`Context not found: ${projectBackwardCompat}`);

    const itemId = await this.context.strategy.writeItem({
      type: 'picture',
      internal_name: `Exhibition detail view ${view.id}`,
      collection_id: await this.getEntityUuidAsync(projectBackwardCompat, 'collection'),
      partner_id: parsed ? await this.getEntityUuidAsync(this.partnerBackwardCompat(parsed), 'partner') : null,
      parent_id: parentItemId,
      country_id: parsed ? mapCountryCode(parsed.country.toLowerCase()) : null,
      project_id: await this.getEntityUuidAsync(projectBackwardCompat, 'project'),
      owner_reference: null,
      mwnf_reference: null,
      display_order: null,
      backward_compatibility: backwardCompat,
    });
    const tags = new TagHelper(this.context.strategy, this.context.tracker, this.context.logger);
    const language = this.context.tracker.getMetadata('default_language_id') ?? 'eng';
    await tags.attachToItem(itemId, await tags.findOrCreateList(CUSTOM_PICTURE_TAG, 'image-type', language));
    await this.writeCaptionTranslations(itemId, backwardCompat, contextId, view.eav);

    this.registerEntity(itemId, backwardCompat, 'item');
    return itemId;
  }

  /** The record a placement links, and the picture it keeps as a page image. */
  private async resolvePlacement(
    label: string,
    placement: { itemId: string; itemBackwardCompat: string; parsed: ParsedRefItem; picture: string | null },
    result: ImportResult
  ): Promise<Placement> {
    const picture = placement.picture?.trim() ?? '';
    if (!picture) return { linkedId: placement.itemId, pagePicture: null };

    if (isCustomPhoto(picture)) {
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
    const pictureId = await this.context.strategy.writeItem({
      type: 'picture',
      internal_name: `Custom exhibition picture ${picture}`,
      collection_id: await this.getEntityUuidAsync(projectBackwardCompat, 'collection'),
      partner_id: await this.getEntityUuidAsync(this.partnerBackwardCompat(parsed), 'partner'),
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
    await this.writeCaptionTranslations(itemId, backwardCompat, contextId, eav);

    this.registerEntity(itemId, backwardCompat, 'item');
    return itemId;
  }

  /**
   * An item's texts from a placement's caption, in each language that names
   * it (legacy printed that caption and nothing else): the name, the date, the
   * place, the museum and the justification; the dynasty, which an item
   * translation has no column for, in its extra.
   */
  private async writeCaptionTranslations(
    itemId: string,
    backwardCompat: string,
    contextId: string,
    eav: ImageEav
  ): Promise<void> {
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
  }

  /** The partner of a referenced record: its museum, or for a monument its institution. */
  private partnerBackwardCompat(parsed: ParsedRefItem): string {
    return parsed.type === 'monument'
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
  }

  /**
   * The monument detail a detail view references, as the monument-detail
   * importer keys it: 'BAR;it;11;9;3' → mwnf3:monument_details:BAR:it:Mon11:9:3.
   * Null when the view references none.
   */
  private buildDetailBackwardCompat(ref: string | null): string | null {
    const parts = (ref ?? '').split(';').map((s) => s.trim());
    if (parts.length < 5 || parts.some((p) => !p)) return null;
    const [projectId, country, institutionId, monumentId, detailId] = parts;
    return formatBackwardCompatibility({
      schema: MWNF3_SCHEMA,
      table: 'monument_details',
      pkValues: [projectId!, country!, this.formatPartnerId('Mon', institutionId!), monumentId!, detailId!],
    });
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
   * Legacy's monument-detail pictures by lowercased path, each with the
   * picture child item it was imported as and the detail it is a picture of,
   * keyed as the monument-detail picture importer keys them.
   */
  private async loadDetailPictures(): Promise<Map<string, LegacyDetailPicture>> {
    const rows = await this.context.legacyDb.query<{
      project_id: string;
      country_id: string;
      institution_id: string;
      monument_id: number;
      detail_id: number;
      picture_id: number;
      path: string;
    }>(
      `SELECT DISTINCT project_id, country_id, institution_id, monument_id, detail_id, picture_id, path
       FROM ${MWNF3_SCHEMA}.monument_detail_pictures
       WHERE path IS NOT NULL AND TRIM(path) != ''
       ORDER BY project_id, country_id, institution_id, monument_id, detail_id, picture_id`
    );
    const map = new Map<string, LegacyDetailPicture>();
    for (const row of rows) {
      const key = row.path.trim().toLowerCase();
      if (map.has(key)) continue;
      const detail = [row.project_id, row.country_id, row.institution_id, row.monument_id, row.detail_id];
      map.set(key, {
        pictureBackwardCompat: formatBackwardCompatibility({
          schema: MWNF3_SCHEMA,
          table: 'monument_detail_pictures',
          pkValues: [...detail, row.picture_id],
        }),
        detailBackwardCompat: formatBackwardCompatibility({
          schema: MWNF3_SCHEMA,
          table: 'monument_details',
          pkValues: detail,
        }),
      });
    }
    this.logInfo(`Loaded ${map.size} monument-detail pictures by path`);
    return map;
  }

  /**
   * Load exhibition_page_image_details and their EAV fields (all supported
   * placement fields). Returns Map<parent_image_id, DetailView[]>, in legacy's
   * order.
   */
  private async loadDetailViews(): Promise<Map<number, DetailView[]>> {
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

    const map = new Map<number, DetailView[]>();
    for (const d of details) {
      if (!map.has(d.image_id)) map.set(d.image_id, []);
      map.get(d.image_id)!.push({
        id: d.detail_id,
        n: d.n,
        n2: d.n2,
        ref: d.ref_detail_item ?? '',
        picture: d.picture_details ?? '',
        eav: detailEav.get(d.detail_id) ?? {},
      });
    }

    this.logInfo(`Loaded ${details.length} detail views across ${map.size} placements`);
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
