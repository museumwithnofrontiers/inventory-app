/**
 * The placement texts that left `collection_item.extra` for the placement
 * translations, `collection_item_translations` (M16 C2, #2642; ADR 006). A
 * placement is an item on a collection; its texts are its own, per language
 * (decision 4 (a)): the same item on two themes keeps two descriptions and two
 * captions.
 *
 * Each key is a map of language id to text, and goes to one column, as
 * written; no two legacy fields share one:
 * - `detail_name` → `title`;
 * - `contextual_descriptions` (thematic gallery themes, Travels trails) and
 *   `detail_justification` (mwnf3 exhibition pages) → `description`. A
 *   placement has one or the other: the exporters tell them apart by the
 *   collection's legacy key (an mwnf3 collection's text is its
 *   `detail_justification`), so a placement where that doesn't hold keeps
 *   the key in `extra`;
 * - `justifications`: `{ curator, partner }` per language → the
 *   `curator_justification` and `partner_justification` columns; a single
 *   text (Sharing History's National Context) → `justification`;
 * - `image_captions` → `caption`;
 * - `item_name`, `item_date`, `item_location`, `item_museum`, and (C3, #2643)
 *   `item_dynasty`, `item_artist`, `item_material` → the columns of the same
 *   name: the item's caption on that page, as written (decision 1 (a));
 * - `source_bc_by_language` → `backward_compatibility`: each theme text's own
 *   legacy key (ADR 006 rule 3).
 *
 * A key whose value doesn't have that shape stays in `extra` and is reported.
 * The exporters put the keys back (`scripts/exporters/shared/placement-translations.mjs`),
 * so keep the two in step.
 */

/** The placement translation's text columns. */
export interface CollectionItemTranslationColumns {
  title?: string;
  description?: string;
  curator_justification?: string | null;
  partner_justification?: string | null;
  justification?: string;
  caption?: string;
  item_name?: string;
  item_date?: string;
  item_location?: string;
  item_museum?: string;
  item_dynasty?: string;
  item_artist?: string;
  item_material?: string;
  backward_compatibility?: string;
}

export type CollectionItemTranslationColumn = keyof CollectionItemTranslationColumns;

/** Every column a placement translation write may set, in table order. */
export const COLLECTION_ITEM_TRANSLATION_COLUMNS: readonly CollectionItemTranslationColumn[] = [
  'title',
  'description',
  'curator_justification',
  'partner_justification',
  'justification',
  'caption',
  'item_name',
  'item_date',
  'item_location',
  'item_museum',
  'item_dynasty',
  'item_artist',
  'item_material',
  'backward_compatibility',
];

/** Each `extra` key that maps a language to one text, and its column. */
const TEXT_KEYS: ReadonlyArray<readonly [string, CollectionItemTranslationColumn]> = [
  ['detail_name', 'title'],
  ['contextual_descriptions', 'description'],
  ['detail_justification', 'description'],
  ['image_captions', 'caption'],
  ['item_name', 'item_name'],
  ['item_date', 'item_date'],
  ['item_location', 'item_location'],
  ['item_museum', 'item_museum'],
  ['item_dynasty', 'item_dynasty'],
  ['item_artist', 'item_artist'],
  ['item_material', 'item_material'],
  ['source_bc_by_language', 'backward_compatibility'],
];

/** The `collection_item.extra` keys this module moves. */
export const COLLECTION_ITEM_TRANSLATION_KEYS: readonly string[] = [
  ...TEXT_KEYS.map(([key]) => key),
  'justifications',
];

/** The legacy key prefix of the collections whose description is `detail_justification`. */
export const DETAIL_JUSTIFICATION_SOURCES: readonly string[] = ['mwnf3:'];

/**
 * The key a placement's description was stored under, by its collection's
 * legacy key: `detail_justification` on an mwnf3 collection, else
 * `contextual_descriptions`.
 */
export function descriptionKey(collectionBackwardCompatibility: string | null): string {
  const source = collectionBackwardCompatibility ?? '';
  return DETAIL_JUSTIFICATION_SOURCES.some((prefix) => source.startsWith(prefix))
    ? 'detail_justification'
    : 'contextual_descriptions';
}

export interface SplitCollectionItemTranslations {
  /** The extra without the moved keys, or null when nothing else is left. */
  extra: Record<string, unknown> | null;
  /** Language id → the columns to set on that language's translation. */
  translations: Map<string, CollectionItemTranslationColumns>;
  /** Keys left in `extra`, each with the reason. */
  kept: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isLanguageMap = (value: unknown): value is Record<string, unknown> =>
  isObject(value) && Object.keys(value).length > 0;

/**
 * Splits the placement texts off a placement's extra.
 *
 * @param collectionBackwardCompatibility the legacy key of the placement's
 *   collection, which says which key its description goes back under.
 */
export function splitCollectionItemTranslations(
  extra: Record<string, unknown>,
  collectionBackwardCompatibility: string | null
): SplitCollectionItemTranslations {
  const translations = new Map<string, CollectionItemTranslationColumns>();
  const kept: string[] = [];
  const moved = new Set<string>();
  const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(extra, key);
  const columnsOf = (languageId: string): CollectionItemTranslationColumns => {
    let columns = translations.get(languageId);
    if (!columns) {
      columns = {};
      translations.set(languageId, columns);
    }
    return columns;
  };
  const descriptionKeys = ['contextual_descriptions', 'detail_justification'].filter(has);
  const expectedDescriptionKey = descriptionKey(collectionBackwardCompatibility);

  for (const [key, column] of TEXT_KEYS) {
    if (!has(key)) continue;
    const value = extra[key];
    if (!isLanguageMap(value) || Object.values(value).some((text) => typeof text !== 'string')) {
      kept.push(`${key} (not a map of language to text)`);
      continue;
    }
    if (column === 'description') {
      if (descriptionKeys.length > 1) {
        kept.push(`${key} (the placement has both contextual_descriptions and detail_justification)`);
        continue;
      }
      if (key !== expectedDescriptionKey) {
        kept.push(
          `${key} (its collection ${JSON.stringify(collectionBackwardCompatibility)} holds ${expectedDescriptionKey})`
        );
        continue;
      }
    }
    for (const [languageId, text] of Object.entries(value)) {
      columnsOf(languageId)[column] = text as string;
    }
    moved.add(key);
  }

  if (has('justifications')) {
    const value = extra.justifications;
    const entries = isLanguageMap(value) ? Object.entries(value) : [];
    const valid =
      entries.length > 0 &&
      entries.every(
        ([, entry]) =>
          typeof entry === 'string' ||
          (isObject(entry) &&
            Object.keys(entry).length === 2 &&
            Object.prototype.hasOwnProperty.call(entry, 'curator') &&
            Object.prototype.hasOwnProperty.call(entry, 'partner') &&
            [entry.curator, entry.partner].every((text) => text === null || typeof text === 'string') &&
            (entry.curator !== null || entry.partner !== null))
      );
    if (!valid) {
      kept.push(
        'justifications (not a map of language to a text or to { curator, partner } with at least one text)'
      );
    } else {
      for (const [languageId, entry] of entries) {
        const columns = columnsOf(languageId);
        if (typeof entry === 'string') {
          columns.justification = entry;
        } else {
          const pair = entry as { curator: string | null; partner: string | null };
          columns.curator_justification = pair.curator;
          columns.partner_justification = pair.partner;
        }
      }
      moved.add('justifications');
    }
  }

  const rest = Object.fromEntries(Object.entries(extra).filter(([key]) => !moved.has(key)));
  return { extra: Object.keys(rest).length > 0 ? rest : null, translations, kept };
}

/** The deterministic-uuid name of a placement translation: one per (placement, language). */
export function placementTranslationUuidName(placementId: string, languageId: string): string {
  return `collection_item_translation:${placementId}:${languageId}`;
}
