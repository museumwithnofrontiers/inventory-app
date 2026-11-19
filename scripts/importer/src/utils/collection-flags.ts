/**
 * The collection flags and legacy codes that leave `collection_translations.extra`
 * (M16 E4a, #2650, decision 6).
 *
 * Flags, to `collections` columns (the same on every translation of a
 * collection, or the collection is left as it is):
 * - `legacy_exhibition.show` (`y`/`n`) → `visible`;
 * - `legacy_status` (Explore themes: `e` shown, `i` not) → `visible`;
 * - `thg_gallery.featured` (legacy `enum('A','H')`: `A` among the featured
 *   galleries, `H` not) → `featured`;
 * - `thg_gallery.live_date` (an ISO date at midnight UTC) → `published_at`.
 * A flag inside `legacy_exhibition` or `thg_gallery` moves only when the
 * block keeps other keys, as the exporters put it back into the block.
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
  'thg_gallery',
  ...DROPPED_CODE_KEYS,
];

const LIVE_DATE = /^(\d{4}-\d{2}-\d{2})T00:00:00\.000Z$/;

export interface CollectionFlags {
  visible?: boolean;
  featured?: boolean;
  published_at?: string;
}

interface FlagValues {
  show?: unknown;
  status?: unknown;
  featured?: unknown;
  liveDate?: unknown;
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
  const gallery = extra['thg_gallery'];
  if (isObject(gallery)) {
    const moving = ['featured', 'live_date'].filter((key) => key in gallery);
    if (Object.keys(gallery).length > moving.length) {
      if ('featured' in gallery) values.featured = gallery['featured'];
      if ('live_date' in gallery) values.liveDate = gallery['live_date'];
    }
  }
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
  const featured = agreed(rows.map((r) => r.featured));
  const liveDate = agreed(rows.map((r) => r.liveDate));

  if (show !== undefined && status !== undefined) problems.push('both an exhibition show flag and a theme status');
  if (show !== undefined) {
    if (show === 'y' || show === 'n') columns.visible = show === 'y';
    else problems.push(`legacy_exhibition.show ${JSON.stringify(show)}`);
  }
  if (status !== undefined) {
    if (status === 'e' || status === 'i') columns.visible = status === 'e';
    else problems.push(`legacy_status ${JSON.stringify(status)}`);
  }
  if (featured !== undefined) {
    if (featured === 'A' || featured === 'H') columns.featured = featured === 'A';
    else problems.push(`thg_gallery.featured ${JSON.stringify(featured)}`);
  }
  if (liveDate !== undefined) {
    const match = typeof liveDate === 'string' ? LIVE_DATE.exec(liveDate) : null;
    if (match) columns.published_at = match[1]!;
    else problems.push(`thg_gallery.live_date ${JSON.stringify(liveDate)}`);
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
    if (moveFlags && key === 'thg_gallery' && isObject(value)) {
      const rest = Object.entries(value).filter(([k]) => k !== 'featured' && k !== 'live_date');
      out[key] = rest.length > 0 ? Object.fromEntries(rest) : value;
      continue;
    }
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}
