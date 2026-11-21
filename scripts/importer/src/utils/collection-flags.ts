/**
 * The collection flags and legacy codes that leave `collection_translations.extra`
 * (M16 E4a, #2650; M17 A1, #2742).
 *
 * The importers set `collections.draft` themselves (M17 A1): an exhibition
 * legacy hides (`show = 'n'`) and an Explore theme it doesn't offer
 * (`status = 'i'`) are drafts. This step only cleans what an older database
 * still holds in `extra`. A flag moves to `draft` when every translation of the
 * collection holds the same value, or the collection is left as it is:
 * - `legacy_exhibition.show` (`y`/`n`): `n` is a draft;
 * - `legacy_status` (Explore themes: `e` offered, `i` not): `i` is a draft.
 * A flag inside `legacy_exhibition` moves only when the block keeps other keys,
 * as the exporters put it back into the block.
 *
 * A gallery's `featured` flag and live date are site configuration (M17 A2,
 * #2743): `site-config` writes them into the gallery's instance file, in its
 * texts' `thg_gallery` block.
 *
 * Legacy codes nothing reads, dropped: `introd_type`, `et_title`,
 * `et_introduction`, `showOnMonument`, `hb_type`, `hb_general_type`,
 * `territory_level`.
 *
 * The exporters give the flags back (`scripts/exporters/shared/collection-flags.mjs`).
 */

export const DROPPED_CODE_KEYS: readonly string[] = [
  'introd_type',
  'et_title',
  'et_introduction',
  'showOnMonument',
  'hb_type',
  'hb_general_type',
  'territory_level',
];

/** The top-level keys this step reads. */
export const COLLECTION_FLAG_KEYS: readonly string[] = [
  'legacy_exhibition',
  'legacy_status',
  ...DROPPED_CODE_KEYS,
];

export interface CollectionFlags {
  draft?: boolean;
}

interface FlagValues {
  show?: unknown;
  status?: unknown;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** The flag values a translation's extra holds, and which of them can move. */
function flagValues(extra: Record<string, unknown>): FlagValues {
  const values: FlagValues = {};
  const exhibition = extra['legacy_exhibition'];
  if (isObject(exhibition) && 'show' in exhibition && Object.keys(exhibition).length > 1) {
    values.show = exhibition['show'];
  }
  if ('legacy_status' in extra) values.status = extra['legacy_status'];
  return values;
}

/** The one value all rows agree on, `undefined` when none has it, or `null` on disagreement. */
function agreed(values: unknown[]): unknown {
  const present = values.filter((value) => value !== undefined);
  if (present.length === 0) return undefined;
  const first = JSON.stringify(present[0]);
  return present.every((value) => JSON.stringify(value) === first) ? present[0] : null;
}

export interface FlagPlan {
  /** The collection's columns to set. */
  columns: CollectionFlags;
  /** Problems that keep the flags in extra (the codes are still dropped). */
  problems: string[];
}

/**
 * The columns of one collection from the extras of its translations, or the
 * problems that keep its flags in extra.
 */
export function planCollectionFlags(extras: Record<string, unknown>[]): FlagPlan {
  const rows = extras.map(flagValues);
  const problems: string[] = [];
  const columns: CollectionFlags = {};

  const show = agreed(rows.map((r) => r.show));
  const status = agreed(rows.map((r) => r.status));

  if (show !== undefined && status !== undefined) problems.push('both an exhibition show flag and a theme status');
  if (show !== undefined) {
    if (show === 'y' || show === 'n') columns.draft = show === 'n';
    else problems.push(`legacy_exhibition.show ${JSON.stringify(show)}`);
  }
  if (status !== undefined) {
    if (status === 'e' || status === 'i') columns.draft = status === 'i';
    else problems.push(`legacy_status ${JSON.stringify(status)}`);
  }
  return { columns: problems.length > 0 ? {} : columns, problems };
}

/**
 * The translation's extra without the dropped codes and, when `moveFlags`, the
 * flags; null when nothing else is left.
 */
export function stripCollectionFlags(
  extra: Record<string, unknown>,
  moveFlags: boolean
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (DROPPED_CODE_KEYS.includes(key)) continue;
    if (moveFlags && key === 'legacy_status') continue;
    if (moveFlags && key === 'legacy_exhibition' && isObject(value) && Object.keys(value).length > 1) {
      out[key] = Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'show'));
      continue;
    }
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}
