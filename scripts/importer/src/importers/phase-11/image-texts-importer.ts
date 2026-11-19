/**
 * Image Texts Importer (M16 F2, #2652)
 *
 * Moves the captions of Sharing History's history-page images and maps from
 * `collection_translations.extra` (`image_captions`, `map_descriptions`) to
 * ImageTranslations of the collection images they describe (see
 * utils/image-texts.ts). An image is found by legacy key: the legacy image or
 * map id gives its legacy file path (read from the legacy database), which is
 * the collection image's path, or its original name once synced.
 *
 * The history-page importer writes these keys, and later steps move
 * translations between contexts, so the move runs once, after every one of
 * them (`runsLast`). A text whose image isn't found stays in `extra`, listed
 * in the log.
 *
 * Idempotent: a moved text is gone, and an ImageTranslation's id comes from
 * its legacy key and language. Run it again with `--only image-texts`.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { planImageTexts } from '../../utils/image-texts.js';

const SH_SCHEMA = 'mwnf3_sharing_history';

export class ImageTextsImporter extends BaseImporter {
  getName(): string {
    return 'ImageTextsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    const preview = this.isDryRun || this.isSampleOnlyMode;

    try {
      const rows = await this.context.strategy.findImageTextRows();
      this.logInfo(
        `Found ${rows.length} collection translation(s) with image captions or map descriptions`
      );
      if (rows.length === 0) {
        result.success = true;
        return result;
      }

      const images = await this.context.legacyDb.query<{
        hb_img_id: number;
        picture: string | null;
      }>(`SELECT hb_img_id, picture FROM ${SH_SCHEMA}.sh_countries_historicalbackground_images`);
      const maps = await this.context.legacyDb.query<{ map_id: number; map_path: string | null }>(
        `SELECT map_id, map_path FROM ${SH_SCHEMA}.sh_countries_historicalbackground_maps`
      );
      const imagePaths = new Map(
        images.filter((i) => i.picture).map((i) => [Number(i.hb_img_id), i.picture!])
      );
      const mapPaths = new Map(
        maps.filter((m) => m.map_path).map((m) => [Number(m.map_id), m.map_path!])
      );

      const collectionImages = await this.context.strategy.findCollectionImagePaths([
        ...new Set(rows.map((row) => row.collection_id)),
      ]);
      const findImage = (collectionId: string, legacyPath: string): string | null => {
        const matches = collectionImages.filter(
          (image) =>
            image.collection_id === collectionId &&
            (image.path === legacyPath || image.original_name === legacyPath)
        );
        // More than one would be a guess: then none.
        return matches.length === 1 ? matches[0]!.id : null;
      };

      const plan = planImageTexts(rows, imagePaths, mapPaths, findImage);
      for (const kept of plan.kept) {
        this.logWarning(
          `Collection translation ${kept.id}: ${kept.entry} left in extra (${kept.reason})`
        );
        result.skipped++;
      }
      this.logInfo(`${plan.texts.length} image text(s) from ${plan.updates.length} translation(s)`);

      if (preview) {
        result.imported += plan.texts.length;
        return { ...result, success: true };
      }

      // The texts first: a translation loses its keys only once they exist.
      let failed = 0;
      for (const text of plan.texts) {
        try {
          await this.context.strategy.upsertImageTranslation({
            ...text,
            image_type: 'collection_image',
          });
          result.imported++;
          this.showProgress();
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Image text ${text.backward_compatibility} (${text.language_id}): ${message}`
          );
          this.logError(`Image text ${text.backward_compatibility}`, message);
        }
      }
      if (failed === 0) {
        for (const update of plan.updates) {
          await this.context.strategy.setCollectionTranslationExtraAsStoredById(
            update.id,
            update.extra === null ? null : JSON.stringify(update.extra)
          );
        }
      } else {
        this.logWarning(
          `${failed} image text(s) failed, so every key stays in extra; run the step again`
        );
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to move image texts: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
