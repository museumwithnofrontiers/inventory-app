/**
 * The collection translation texts that left `extra` for columns of their own
 * (M16, ADR 006). Each `extra` key maps to one `collection_translations`
 * column, which takes the text exactly as the importer stored it.
 *
 * - E1 (#2647): subtitle, introduction, duration. mwnf3's exhibition fields
 *   call the introduction `intro_text`, Travels' itineraries `introduction`:
 *   both go to `introduction`. A translation holding both is not moved and is
 *   reported, so that nothing is merged.
 * - F2 (#2652): `cover_images`, an exhibition cover picture's caption, as
 *   written, into `cover_caption` (nothing says which image is the cover).
 *
 * The exporters give each key back to the package under its legacy name
 * (`scripts/exporters/shared/collection-columns.mjs`), so keep the two lists
 * equal.
 */

export interface CollectionTranslationColumn {
  /** The `extra` key the importer writes. */
  key: string;
  /** The `collection_translations` column that holds it now. */
  column: string;
}

export const COLLECTION_TRANSLATION_COLUMNS: readonly CollectionTranslationColumn[] = [
  { key: 'subtitle', column: 'subtitle' },
  { key: 'intro_text', column: 'introduction' },
  { key: 'introduction', column: 'introduction' },
  { key: 'duration', column: 'duration' },
  { key: 'cover_images', column: 'cover_caption' },
];

export const COLLECTION_TRANSLATION_COLUMN_KEYS: readonly string[] =
  COLLECTION_TRANSLATION_COLUMNS.map((entry) => entry.key);

export interface SplitCollectionColumns {
  /** The extra without the moved keys, or null when nothing else is left. */
  extra: Record<string, unknown> | null;
  /** Column name → text, for the keys found. */
  columns: Record<string, string>;
  /** Mapped keys whose value is not a string; they stay in `extra`. */
  kept: string[];
  /** Columns two keys of the row compete for; the row is left as it is. */
  conflicts: string[];
}

/**
 * Splits the mapped keys off a collection translation's extra.
 *
 * Only string values move, as written. Any other value stays in `extra` and
 * is reported. When two keys of the row map to one column, nothing moves.
 */
export function splitCollectionTranslationColumns(
  extra: Record<string, unknown>
): SplitCollectionColumns {
  const columns: Record<string, string> = {};
  const kept: string[] = [];
  const moved = new Set<string>();
  const sources = new Map<string, string[]>();

  for (const { key, column } of COLLECTION_TRANSLATION_COLUMNS) {
    if (!Object.prototype.hasOwnProperty.call(extra, key)) continue;
    sources.set(column, [...(sources.get(column) ?? []), key]);
  }
  const conflicts = [...sources.entries()]
    .filter(([, keys]) => keys.length > 1)
    .map(([column, keys]) => `${column} (${keys.join(', ')})`);
  if (conflicts.length > 0) return { extra, columns: {}, kept, conflicts };

  for (const { key, column } of COLLECTION_TRANSLATION_COLUMNS) {
    if (!Object.prototype.hasOwnProperty.call(extra, key)) continue;
    const value = extra[key];
    if (typeof value !== 'string') {
      kept.push(key);
      continue;
    }
    columns[column] = value;
    moved.add(key);
  }

  const rest = Object.fromEntries(Object.entries(extra).filter(([key]) => !moved.has(key)));
  return { extra: Object.keys(rest).length > 0 ? rest : null, columns, kept, conflicts };
}
