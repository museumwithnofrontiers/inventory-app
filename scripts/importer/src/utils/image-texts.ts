/**
 * The texts of Sharing History's history-page images and maps (M16 F2,
 * #2652), out of `collection_translations.extra` into ImageTranslations:
 *
 * - `image_captions.{legacy image key}.{language}.{name, date, museum,
 *   location}`: the caption of a history page's own image, in legacy's four
 *   separate fields, each kept as written (never joined);
 * - `map_descriptions.map_{id}.{language}`: the caption of a history
 *   profile's map.
 *
 * An image is found by legacy key only: the legacy image or map id gives its
 * legacy file path, which is the collection image's path (or, once synced,
 * its original name) in the same collection. A text whose image isn't found,
 * or that holds a field the model has no column for, stays in `extra`.
 */

export const IMAGE_TEXT_KEYS = ['image_captions', 'map_descriptions'] as const;

/** The caption fields legacy kept apart, each an ImageTranslation column. */
export const CAPTION_FIELDS = ['name', 'date', 'museum', 'location'] as const;

const HB_IMAGE_PREFIX = 'mwnf3_sharing_history:sh_countries_historicalbackground_images:';
export const HB_MAP_PREFIX = 'mwnf3_sharing_history:sh_countries_historicalbackground_maps:';

export interface ImageTextRow {
  id: string;
  collection_id: string;
  extra: Record<string, unknown>;
}

export interface ImageTextData {
  image_id: string;
  language_id: string;
  caption: string | null;
  name: string | null;
  date: string | null;
  museum: string | null;
  location: string | null;
  backward_compatibility: string;
}

export interface ImageTextPlan {
  texts: ImageTextData[];
  updates: Array<{ id: string; extra: Record<string, unknown> | null }>;
  /** Entries left in extra, with the reason. */
  kept: Array<{ id: string; entry: string; reason: string }>;
}

/** Finds a collection's image by its legacy file path. */
export type ImageLookup = (collectionId: string, legacyPath: string) => string | null;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function planImageTexts(
  rows: readonly ImageTextRow[],
  imagePaths: ReadonlyMap<number, string>,
  mapPaths: ReadonlyMap<number, string>,
  findImage: ImageLookup
): ImageTextPlan {
  const plan: ImageTextPlan = { texts: [], updates: [], kept: [] };

  for (const row of rows) {
    const extra: Record<string, unknown> = { ...row.extra };
    let changed = false;

    const captions = extra['image_captions'];
    if (isObject(captions)) {
      const left: Record<string, unknown> = {};
      for (const [imageKey, byLanguage] of Object.entries(captions)) {
        const legacyId = imageKey.startsWith(HB_IMAGE_PREFIX)
          ? Number(imageKey.slice(HB_IMAGE_PREFIX.length))
          : NaN;
        const path = imagePaths.get(legacyId);
        const imageId = path ? findImage(row.collection_id, path) : null;
        const texts = imageId === null ? null : captionTexts(byLanguage, imageId, imageKey);
        if (texts === null) {
          left[imageKey] = byLanguage;
          plan.kept.push({
            id: row.id,
            entry: `image_captions.${imageKey}`,
            reason:
              imageId === null
                ? 'no image of the page has its legacy path'
                : 'a field the model has no column for',
          });
          continue;
        }
        plan.texts.push(...texts);
        changed = true;
      }
      if (changed) {
        if (Object.keys(left).length > 0) extra['image_captions'] = left;
        else delete extra['image_captions'];
      }
    }

    const maps = extra['map_descriptions'];
    if (isObject(maps)) {
      const left: Record<string, unknown> = {};
      let moved = false;
      for (const [mapKey, byLanguage] of Object.entries(maps)) {
        const mapId = /^map_(\d+)$/.exec(mapKey);
        const path = mapId ? mapPaths.get(Number(mapId[1])) : undefined;
        const imageId = path ? findImage(row.collection_id, path) : null;
        const texts =
          imageId === null ||
          !isObject(byLanguage) ||
          !Object.values(byLanguage).every((v) => typeof v === 'string')
            ? null
            : Object.entries(byLanguage).map(([language, caption]): ImageTextData => ({
                image_id: imageId,
                language_id: language,
                caption: caption as string,
                name: null,
                date: null,
                museum: null,
                location: null,
                backward_compatibility: `${HB_MAP_PREFIX}${mapId![1]}`,
              }));
        if (texts === null) {
          left[mapKey] = byLanguage;
          plan.kept.push({
            id: row.id,
            entry: `map_descriptions.${mapKey}`,
            reason:
              imageId === null
                ? 'no image of the profile has its legacy path'
                : 'not one text per language',
          });
          continue;
        }
        plan.texts.push(...texts);
        moved = true;
      }
      if (moved) {
        changed = true;
        if (Object.keys(left).length > 0) extra['map_descriptions'] = left;
        else delete extra['map_descriptions'];
      }
    }

    if (changed)
      plan.updates.push({ id: row.id, extra: Object.keys(extra).length > 0 ? extra : null });
  }

  return plan;
}

/** One image's caption per language, or null when one isn't the four fields as texts. */
function captionTexts(
  byLanguage: unknown,
  imageId: string,
  imageKey: string
): ImageTextData[] | null {
  if (!isObject(byLanguage)) return null;
  const out: ImageTextData[] = [];
  for (const [language, fields] of Object.entries(byLanguage)) {
    if (!isObject(fields)) return null;
    const known = new Set<string>(CAPTION_FIELDS);
    if (Object.keys(fields).some((key) => !known.has(key))) return null;
    if (Object.values(fields).some((value) => typeof value !== 'string')) return null;
    out.push({
      image_id: imageId,
      language_id: language,
      caption: null,
      name: (fields['name'] as string | undefined) ?? null,
      date: (fields['date'] as string | undefined) ?? null,
      museum: (fields['museum'] as string | undefined) ?? null,
      location: (fields['location'] as string | undefined) ?? null,
      backward_compatibility: imageKey,
    });
  }
  return out;
}
