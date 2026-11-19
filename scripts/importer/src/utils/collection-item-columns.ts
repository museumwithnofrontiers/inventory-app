/**
 * The placement fields that left `collection_item.extra` for columns of their
 * own (M16 C1, #2641; ADR 006). A placement is an item on a collection.
 *
 * - `n`: the placement's place on the page. It always equals `display_order`
 *   (6,004 of 6,004 rows on 2026-11-19), so the key is dropped; a value that
 *   differs is left in `extra` and reported.
 * - `n2` → `variant_order`: the variant number at that place, as written
 *   (JSON null becomes NULL).
 * - `parent_n2` → `parent_variant_order`: for a detail view, the variant
 *   number of the view it belongs to, as written. A position, not a link
 *   (decision on #2641): some views have no parent placement.
 * - `detail_n`: the detail view's own place. It is always 1, so it carries
 *   nothing and is dropped; any other value is left in `extra` and reported.
 * - `curator_status` → `curator_selected`: Y true, N false. Any other value is
 *   left in `extra`.
 * - `picture` → `picture_item_id`: the legacy path of the picture the
 *   placement shows. The importer step resolves it to a picture item of the
 *   placed item; this module only takes it off `extra` once resolved.
 *
 * The exporters read the columns (`scripts/exporters/shared/placement-columns.mjs`),
 * so keep the two in step.
 */

/** The `collection_item.extra` keys this module moves or drops. */
export const COLLECTION_ITEM_COLUMN_KEYS: readonly string[] = [
  'n',
  'n2',
  'parent_n2',
  'detail_n',
  'curator_status',
  'picture',
];

export interface CollectionItemColumns {
  variant_order?: number | null;
  parent_variant_order?: number | null;
  curator_selected?: boolean;
  picture_item_id?: string;
}

export interface SplitCollectionItemColumns {
  /** The extra without the moved keys, or null when nothing else is left. */
  extra: Record<string, unknown> | null;
  /** Column name → value, for the keys moved. */
  columns: CollectionItemColumns;
  /** Keys left in `extra`, each with the reason. */
  kept: string[];
}

/**
 * Splits the placement fields off a placement's extra.
 *
 * @param displayOrder The placement's `display_order`, which `n` must equal.
 * @param pictureItemId The picture `picture` resolves to, or null when it
 *   doesn't resolve (then `picture` stays in `extra`).
 */
export function splitCollectionItemColumns(
  extra: Record<string, unknown>,
  displayOrder: number | null,
  pictureItemId: string | null
): SplitCollectionItemColumns {
  const columns: CollectionItemColumns = {};
  const kept: string[] = [];
  const moved = new Set<string>();
  const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(extra, key);
  const position = (key: string): number | null | undefined => {
    const value = extra[key];
    if (value === null) return null;
    return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
  };

  if (has('n')) {
    if (extra.n === displayOrder) moved.add('n');
    else kept.push(`n (${JSON.stringify(extra.n)} differs from display_order ${displayOrder})`);
  }
  for (const [key, column] of [
    ['n2', 'variant_order'],
    ['parent_n2', 'parent_variant_order'],
  ] as const) {
    if (!has(key)) continue;
    const value = position(key);
    if (value === undefined) {
      kept.push(`${key} (not a whole number: ${JSON.stringify(extra[key])})`);
      continue;
    }
    columns[column] = value;
    moved.add(key);
  }
  if (has('detail_n')) {
    if (extra.detail_n === 1) moved.add('detail_n');
    else kept.push(`detail_n (${JSON.stringify(extra.detail_n)}, not 1)`);
  }
  if (has('curator_status')) {
    if (extra.curator_status === 'Y' || extra.curator_status === 'N') {
      columns.curator_selected = extra.curator_status === 'Y';
      moved.add('curator_status');
    } else {
      kept.push(`curator_status (${JSON.stringify(extra.curator_status)}, not Y or N)`);
    }
  }
  if (has('picture')) {
    if (pictureItemId !== null) {
      columns.picture_item_id = pictureItemId;
      moved.add('picture');
    } else {
      kept.push(`picture (${JSON.stringify(extra.picture)} resolves to no picture of the item)`);
    }
  }

  const rest = Object.fromEntries(Object.entries(extra).filter(([key]) => !moved.has(key)));
  return { extra: Object.keys(rest).length > 0 ? rest : null, columns, kept };
}

/** The deterministic-uuid name of a placement: one per (collection, item). */
export function placementUuidName(collectionId: string, itemId: string): string {
  return `collection_item:${collectionId}:${itemId}`;
}
