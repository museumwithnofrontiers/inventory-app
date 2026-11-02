/**
 * Legacy's own order for its texts: MySQL's `utf8mb3_general_ci`, the
 * collation legacy's `ORDER BY` on a text column sorted in. It ignores case,
 * accents and trailing spaces, then compares code point by code point.
 */
const fold = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trimEnd();

export function compareGeneralCi(a: string, b: string): number {
  const x = fold(a);
  const y = fold(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * A legacy list as legacy displayed it: in its own `sort_order` when the
 * list was ordered by hand (`sort_status` 'Y'), else by its text.
 */
export function orderLikeLegacy<T extends { sort_order: number; text: string }>(
  entries: T[],
  byHand: boolean
): T[] {
  return [...entries].sort((a, b) =>
    byHand ? a.sort_order - b.sort_order : compareGeneralCi(a.text, b.text)
  );
}
