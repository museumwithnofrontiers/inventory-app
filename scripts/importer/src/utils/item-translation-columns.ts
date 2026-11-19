/**
 * The item translation texts that left `extra` for columns of their own
 * (M16, ADR 006). Each `extra` key maps to one `item_translations` column,
 * which takes the text exactly as the importer stored it.
 *
 * - B1 (#2635): materials, short description, dynasty, region, history.
 *
 * The exporters give each key back to the package under its legacy name
 * (`scripts/exporters/shared/item-columns.mjs`), so keep the two lists equal.
 */

export interface ItemTranslationColumn {
  /** The `extra` key the importer writes. */
  key: string;
  /** The `item_translations` column that holds it now. */
  column: string;
}

export const ITEM_TRANSLATION_COLUMNS: readonly ItemTranslationColumn[] = [
  { key: 'materials', column: 'materials' },
  { key: 'description2', column: 'short_description' },
  { key: 'dynasty', column: 'dynasty' },
  { key: 'province', column: 'region' },
  { key: 'history', column: 'history' },
];

export const ITEM_TRANSLATION_COLUMN_KEYS: readonly string[] = ITEM_TRANSLATION_COLUMNS.map(
  (entry) => entry.key
);

export interface SplitColumns {
  /** The extra without the moved keys, or null when nothing else is left. */
  extra: Record<string, unknown> | null;
  /** Column name → text, for the keys found. */
  columns: Record<string, string>;
  /** Mapped keys whose value is not a string; they stay in `extra`. */
  kept: string[];
}

/**
 * Splits the mapped keys off an item translation's extra.
 *
 * Only string values move, as written. Any other value stays in `extra` and is
 * reported, so nothing is lost.
 */
export function splitItemTranslationColumns(extra: Record<string, unknown>): SplitColumns {
  const columns: Record<string, string> = {};
  const kept: string[] = [];
  const moved = new Set<string>();

  for (const { key, column } of ITEM_TRANSLATION_COLUMNS) {
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
  return { extra: Object.keys(rest).length > 0 ? rest : null, columns, kept };
}
