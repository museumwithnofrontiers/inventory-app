/**
 * Picture Credits Importer (M16 F1, #2651, ADR 006 Decision 3 (b))
 *
 * Moves a picture's photographer and its own credit line from its translations'
 * `extra` to its image row (see utils/picture-credits.ts), then gives the
 * same values to the parent's copy of that image (an object's, monument's or
 * detail's first picture is attached to it too). Also moves
 * `partner_images.extra.photographer` to its column.
 *
 * The picture importers of every legacy database write these keys, and later
 * steps move translations between contexts, so the move runs once, after
 * every one of them (`runsLast`). It reads nothing from the legacy database;
 * the texts are copied as stored.
 *
 * The objects' and monuments' `copyright` is the sheet's rights line, not a
 * picture's: it moves to their translations' `image_rights`.
 *
 * Only the 26 ISL/IAM images that still burn their own text change what
 * `/pub` burns: their text moves to `credit`, so they burn the project's line
 * like every other ISL and IAM picture.
 *
 * Idempotent: a second run finds the same values. Run it again with
 * `--only picture-credits` after re-running a picture importer on its own.
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import {
  planImageRights,
  planParentImage,
  planPictureCredits,
} from '../../utils/picture-credits.js';

const DEFAULT_LANGUAGE_ID = 'eng';

export class PictureCreditsImporter extends BaseImporter {
  getName(): string {
    return 'PictureCreditsImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();
    const preview = this.isDryRun || this.isSampleOnlyMode;
    const tag = this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN';

    try {
      this.logInfo(
        'Moving picture photographers and credits from item_translations.extra to the images...'
      );
      const rows = await this.context.strategy.findPictureCreditRows();
      const defaultLanguageId =
        this.context.tracker.getMetadata('default_language_id') ?? DEFAULT_LANGUAGE_ID;
      const plan = planPictureCredits(rows, defaultLanguageId);
      this.logInfo(
        `Found ${plan.images.length} image(s) and ${plan.translations.length} translation(s) to update; ` +
          `${plan.kept.length} picture text(s) differ by language and stay in extra`
      );

      for (const image of plan.images) {
        await this.apply(result, `Item image ${image.image_id}`, preview, tag, () =>
          this.context.strategy.setItemImagePictureCredit(
            image.image_id,
            image.photographer,
            image.credit,
            image.clear_copyright
          )
        );
      }

      for (const translation of plan.translations) {
        await this.apply(result, `Item translation ${translation.id}`, preview, tag, () =>
          this.context.strategy.setItemTranslationColumnsAsStoredById(
            translation.id,
            {},
            translation.extra === null ? null : JSON.stringify(translation.extra)
          )
        );
      }

      // After the pictures: the parent's copy takes the picture image's values.
      for (const row of await this.context.strategy.findPictureParentImages()) {
        const update = planParentImage(row);
        if (update === null) continue;
        await this.apply(result, `Item image ${update.image_id}`, preview, tag, () =>
          this.context.strategy.setItemImagePictureCredit(
            update.image_id,
            update.photographer,
            update.credit,
            update.clear_copyright
          )
        );
      }

      for (const row of await this.context.strategy.findPartnerImagesWithPhotographer()) {
        const { photographer, ...rest } = row.extra;
        if (typeof photographer !== 'string') {
          this.logWarning(`Partner image ${row.id}: 'photographer' is not a text, left in extra`);
          result.skipped++;
          continue;
        }
        const extra = Object.keys(rest).length > 0 ? JSON.stringify(rest) : null;
        await this.apply(result, `Partner image ${row.id}`, preview, tag, () =>
          this.context.strategy.setPartnerImagePhotographer(row.id, photographer, extra)
        );
      }

      // An object's or monument's `copyright` is the sheet's rights line, not a
      // picture's: it goes to the translation's `image_rights` column.
      for (const update of planImageRights(await this.context.strategy.findImageRightsRows())) {
        await this.apply(result, `Item translation ${update.id}`, preview, tag, () =>
          this.context.strategy.setItemTranslationImageRights(
            update.id,
            update.image_rights,
            update.extra === null ? null : JSON.stringify(update.extra)
          )
        );
      }

      this.showSummary(result.imported, result.skipped, result.errors.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to move picture credits: ${message}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }

  private async apply(
    result: ImportResult,
    label: string,
    preview: boolean,
    tag: string,
    write: () => Promise<void>
  ): Promise<void> {
    if (preview) {
      this.logInfo(`[${tag}] Would update ${label}`);
      result.imported++;
      this.showProgress();
      return;
    }
    try {
      await write();
      result.imported++;
      this.showProgress();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`${label}: ${message}`);
      this.logError(label, message);
      this.showError();
    }
  }
}
