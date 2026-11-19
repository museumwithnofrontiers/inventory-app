/**
 * A picture's photographer and its own credit line (M16 F1, #2651, ADR 006
 * Decision 3 (b)). Legacy stored both per language row of the picture; they
 * belong to the picture, so they move to its image row's `photographer` and
 * `credit` columns.
 *
 * - A key leaves the picture translations' `extra` only when every row of the
 *   picture carries the same text: the packages ship it per language, and the
 *   exporters give the image's value back to each row. Where the rows differ,
 *   or some have none, the image takes the default language's text and the
 *   rows keep theirs until an editor has reviewed them.
 * - `copyright` stays the text burned on the picture (image → Project →
 *   fallback, untouched). `credit` holds the picture's own text where the
 *   sheets can't read it back from `copyright`: on ISL and IAM pictures,
 *   which burn their project's line, so their `copyright` is cleared, and
 *   where legacy wrote the mark itself.
 *
 * The exporters print `credit` when set, else `copyright` without the mark the
 * importer added (`scripts/exporters/shared/item-columns.mjs`).
 */

import { PROJECTS_OVERRIDING_PICTURES } from './image-copyright.js';

export const PICTURE_CREDIT_KEYS = ['photographer', 'copyright'] as const;
export type PictureCreditKey = (typeof PICTURE_CREDIT_KEYS)[number];

/** One translation of a picture, with its image row and project. */
export interface PictureCreditRow {
  id: string;
  item_id: string;
  language_id: string;
  extra: Record<string, unknown> | null;
  image_id: string;
  image_copyright: string | null;
  /** The image's values now: kept where its rows no longer hold the key. */
  image_photographer: string | null;
  image_credit: string | null;
  /** The picture's project legacy key, e.g. `mwnf3:projects:IAM`. */
  project_key: string | null;
}

/** An object's, monument's or detail's image that is also its picture's. */
export interface PictureParentImageRow {
  parent_image_id: string;
  parent_photographer: string | null;
  parent_credit: string | null;
  parent_copyright: string | null;
  /** The picture image's values, once its own credits are set. */
  photographer: string | null;
  credit: string | null;
  project_key: string | null;
}

export interface PictureImageUpdate {
  image_id: string;
  photographer: string | null;
  credit: string | null;
  /** True where the image must burn its project's line, not its own text. */
  clear_copyright: boolean;
}

export interface PictureTranslationUpdate {
  id: string;
  extra: Record<string, unknown> | null;
}

export interface PicturePlan {
  images: PictureImageUpdate[];
  translations: PictureTranslationUpdate[];
  /** Pictures whose rows keep their own texts, per key, for review. */
  kept: Array<{ item_id: string; key: PictureCreditKey }>;
}

const MARK_AND_SPACE = '© ';

/** `copyright` as the sheets print it: without the mark the importer added. */
export function withoutCopyrightMark(copyright: string | null): string | null {
  if (!copyright) return null;
  return copyright.startsWith(MARK_AND_SPACE) ? copyright.slice(MARK_AND_SPACE.length) : copyright;
}

/** True for a project whose line legacy printed on every picture (ISL, IAM). */
export function projectOverridesPictures(projectKey: string | null): boolean {
  const match = /^mwnf3:projects:(.+)$/i.exec(projectKey?.trim() ?? '');
  return match !== null && PROJECTS_OVERRIDING_PICTURES.has(match[1]!.toUpperCase());
}

function text(extra: Record<string, unknown> | null, key: string): string | null {
  const value = extra?.[key];
  return typeof value === 'string' ? value : null;
}

/**
 * The image and translation updates for every picture in `rows` (all the
 * translations of each picture, in a stable order).
 */
export function planPictureCredits(
  rows: readonly PictureCreditRow[],
  defaultLanguageId: string
): PicturePlan {
  const byItem = new Map<string, PictureCreditRow[]>();
  for (const row of rows) {
    const group = byItem.get(row.item_id) ?? [];
    group.push(row);
    byItem.set(row.item_id, group);
  }

  const plan: PicturePlan = { images: [], translations: [], kept: [] };

  for (const [itemId, group] of byItem) {
    // A picture has one image; the rows repeat per image if it had more.
    const imageIds = [...new Set(group.map((row) => row.image_id))];
    const translations = new Map<string, PictureCreditRow>();
    for (const row of group) if (!translations.has(row.id)) translations.set(row.id, row);
    const rowsOfPicture = [...translations.values()];

    const chosen: Record<PictureCreditKey, string | null> = { photographer: null, copyright: null };
    const moved = new Set<PictureCreditKey>();
    for (const key of PICTURE_CREDIT_KEYS) {
      const values = rowsOfPicture.map((row) => text(row.extra, key));
      const filled = values.filter((value): value is string => value !== null);
      if (filled.length === 0) continue;
      const uniform = filled.length === values.length && new Set(filled).size === 1;
      const defaultRow = rowsOfPicture.find(
        (row) => row.language_id === defaultLanguageId && text(row.extra, key) !== null
      );
      chosen[key] = defaultRow ? text(defaultRow.extra, key) : filled[0]!;
      if (uniform) moved.add(key);
      else plan.kept.push({ item_id: itemId, key });
    }

    if (chosen.photographer === null && chosen.copyright === null) continue;

    for (const imageId of imageIds) {
      const imageRow = group.find((row) => row.image_id === imageId)!;
      const overrides = projectOverridesPictures(imageRow.project_key);
      const own = chosen.copyright;
      // A key the rows no longer hold moved on an earlier run: keep its value.
      const credit =
        own === null
          ? imageRow.image_credit
          : overrides || withoutCopyrightMark(imageRow.image_copyright) !== own
            ? own
            : null;
      plan.images.push({
        image_id: imageId,
        photographer: chosen.photographer ?? imageRow.image_photographer,
        credit,
        clear_copyright: overrides && imageRow.image_copyright !== null,
      });
    }

    if (moved.size === 0) continue;
    for (const row of rowsOfPicture) {
      const rest = Object.fromEntries(
        Object.entries(row.extra ?? {}).filter(([key]) => !moved.has(key as PictureCreditKey))
      );
      plan.translations.push({ id: row.id, extra: Object.keys(rest).length > 0 ? rest : null });
    }
  }

  return plan;
}

/**
 * The parent's image is the same picture as its first picture's image, so it
 * takes the same photographer and credit, and burns the project's line too
 * where the project's line overrides the picture's. Null where nothing changes.
 */
export function planParentImage(row: PictureParentImageRow): PictureImageUpdate | null {
  const clear =
    projectOverridesPictures(row.project_key) &&
    row.parent_copyright !== null &&
    row.credit !== null;
  if (row.parent_photographer === row.photographer && row.parent_credit === row.credit && !clear) {
    return null;
  }
  return {
    image_id: row.parent_image_id,
    photographer: row.photographer,
    credit: row.credit,
    clear_copyright: clear,
  };
}
