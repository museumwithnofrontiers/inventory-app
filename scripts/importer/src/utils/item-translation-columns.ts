/**
 * The item translation texts that left `extra` for columns of their own
 * (M16, ADR 006). Each `extra` key maps to one `item_translations` column,
 * which takes the text exactly as the importer stored it.
 *
 * - B1 (#2635): materials, short description, dynasty, region, history.
 * - B4 (#2638, Decision 2 (b)): the credits as written. The four keys of
 *   `credits_as_written` (mwnf3 and Sharing History texts) and `prepared_by`
 *   (Explore and Travels texts, whose legacy field has that name) go to the
 *   four `*_credit` columns. No translation has both `prepared_by` and
 *   `credits_as_written.author`.
 * - B2 (#2636) and B3 (#2637): the keyword line and the artist, workshop,
 *   scribe, patron and architect lines (display texts; the Tags and Artist
 *   links are separate and untouched).
 * - B5 (#2639): `linkcatalogs` → `catalogue_references`, codes and citations
 *   as written (the Book links come from the codes, separately).
 * - B6 (#2640): the Sharing History notices `notice` and `notice_c` →
 *   `notice`, `external_notice`, as written; and `legacy_display_status` N →
 *   `status` hidden. That one is a flag, not a text, so its entry maps values.
 *
 * A key is a top-level `extra` key, or `parent.child` for a key inside an
 * object (`credits_as_written.author`).
 *
 * The exporters give each key back to the package under its legacy name
 * (`scripts/exporters/shared/item-columns.mjs`), so keep the two lists equal.
 */

export interface ItemTranslationColumn {
  /** The `extra` key the importer writes: `key`, or `parent.child`. */
  key: string;
  /** The `item_translations` column that holds it now. */
  column: string;
  /**
   * For a flag rather than a text: each legacy value and the column value it
   * becomes. A value missing here stays in `extra`.
   */
  values?: Readonly<Record<string, string>>;
}

export const ITEM_TRANSLATION_COLUMNS: readonly ItemTranslationColumn[] = [
  { key: 'materials', column: 'materials' },
  { key: 'description2', column: 'short_description' },
  { key: 'dynasty', column: 'dynasty' },
  { key: 'province', column: 'region' },
  { key: 'history', column: 'history' },
  { key: 'credits_as_written.author', column: 'author_credit' },
  { key: 'credits_as_written.copy_editor', column: 'copy_editor_credit' },
  { key: 'credits_as_written.translator', column: 'translator_credit' },
  { key: 'credits_as_written.translation_copy_editor', column: 'translation_copy_editor_credit' },
  { key: 'prepared_by', column: 'author_credit' },
  { key: 'keywords', column: 'keywords' },
  { key: 'artist', column: 'artist' },
  { key: 'period_activity', column: 'artist_period_of_activity' },
  { key: 'artist_birthdate', column: 'artist_birth_date' },
  { key: 'artist_birthplace', column: 'artist_birth_place' },
  { key: 'artist_deathdate', column: 'artist_death_date' },
  { key: 'artist_deathplace', column: 'artist_death_place' },
  { key: 'workshop', column: 'workshop' },
  { key: 'scriber', column: 'scribe' },
  { key: 'patrons', column: 'patrons' },
  { key: 'architects', column: 'architects' },
  { key: 'linkcatalogs', column: 'catalogue_references' },
  { key: 'notice', column: 'notice' },
  { key: 'notice_c', column: 'external_notice' },
  { key: 'legacy_display_status', column: 'status', values: { N: 'hidden' } },
];

/** The top-level `extra` keys that hold a mapped text, for finding the rows. */
export const ITEM_TRANSLATION_COLUMN_KEYS: readonly string[] = [
  ...new Set(ITEM_TRANSLATION_COLUMNS.map((entry) => entry.key.split('.')[0]!)),
];

export interface SplitColumns {
  /** The extra without the moved keys, or null when nothing else is left. */
  extra: Record<string, unknown> | null;
  /** Column name → text, for the keys found. */
  columns: Record<string, string>;
  /** Mapped keys left in `extra`: not a text, or their column already taken. */
  kept: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Splits the mapped keys off an item translation's extra.
 *
 * Only string values move, as written. A value that is not a text, or a second
 * text for a column already filled from another key, stays in `extra` and is
 * reported, so nothing is lost. An object emptied of its keys
 * (`credits_as_written`) leaves `extra` too.
 */
export function splitItemTranslationColumns(extra: Record<string, unknown>): SplitColumns {
  const columns: Record<string, string> = {};
  const kept: string[] = [];
  const moved = new Set<string>();

  for (const { key, column, values } of ITEM_TRANSLATION_COLUMNS) {
    const [parent, child] = key.split('.') as [string, string | undefined];
    const holder = child === undefined ? extra : extra[parent];
    const name = child ?? parent;
    if (!isObject(holder) || !Object.prototype.hasOwnProperty.call(holder, name)) continue;
    const value = holder[name];
    if (typeof value !== 'string' || Object.prototype.hasOwnProperty.call(columns, column)) {
      kept.push(key);
      continue;
    }
    if (values !== undefined) {
      const mapped = Object.prototype.hasOwnProperty.call(values, value)
        ? values[value]
        : undefined;
      if (mapped === undefined) {
        kept.push(key);
        continue;
      }
      columns[column] = mapped;
    } else {
      columns[column] = value;
    }
    moved.add(key);
  }

  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (moved.has(key)) continue;
    if (isObject(value)) {
      const inner = Object.fromEntries(
        Object.entries(value).filter(([child]) => !moved.has(`${key}.${child}`))
      );
      const emptied = Object.keys(inner).length === 0 && Object.keys(value).length > 0;
      if (!emptied)
        rest[key] = Object.keys(inner).length === Object.keys(value).length ? value : inner;
      continue;
    }
    rest[key] = value;
  }

  return { extra: Object.keys(rest).length > 0 ? rest : null, columns, kept };
}
