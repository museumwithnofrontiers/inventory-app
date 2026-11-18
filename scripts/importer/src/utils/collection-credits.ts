/**
 * The collection credits: the `collection_translations.extra` keys that name
 * the people behind a collection's texts (M16 I5, #2648).
 *
 * Each key becomes a Contributor of the collection, with the key as its
 * `category`, and each translation's text becomes that Contributor's
 * translation in the same language and context, kept as written:
 * - a name in `name`;
 * - a block (credits, a team, lines with roles) in `description`.
 *
 * The exporters give the key back to the package from the Contributor, so
 * the order here is also the Contributors' display order.
 */

export interface CollectionCredit {
  /** The `extra` key, and the Contributor category. */
  category: string;
  /** Where the text goes on the Contributor translation. */
  field: 'name' | 'description';
  /** The Contributor's internal name. */
  label: string;
}

export const COLLECTION_CREDITS: readonly CollectionCredit[] = [
  { category: 'author', field: 'name', label: 'Author' },
  { category: 'travels_author', field: 'name', label: 'Travels author' },
  { category: 'prepared_by', field: 'description', label: 'Prepared by' },
  { category: 'curated_by', field: 'description', label: 'Curated by' },
  { category: 'credits', field: 'description', label: 'Credits' },
  { category: 'local_coordinator', field: 'description', label: 'Local coordinator' },
  { category: 'local_team', field: 'description', label: 'Local team' },
  { category: 'photo_by', field: 'description', label: 'Photo by' },
];

export const COLLECTION_CREDIT_KEYS: readonly string[] = COLLECTION_CREDITS.map(
  (credit) => credit.category
);

export interface SplitCredits {
  /** The extra without the credit keys, or null when nothing else is left. */
  extra: Record<string, unknown> | null;
  /** The credits found, in COLLECTION_CREDITS order. */
  credits: Array<{ credit: CollectionCredit; text: string }>;
  /** Credit keys whose value is not a string; they stay in `extra`. */
  kept: string[];
}

/**
 * Splits the credit keys off a collection translation's extra.
 *
 * Only string values move. An empty string moves too: an empty
 * `travels_author` says the text is a Travels itinerary's that names no
 * author. Any other value stays in `extra` and is reported, so nothing is
 * lost.
 */
export function splitCollectionCredits(extra: Record<string, unknown>): SplitCredits {
  const credits: SplitCredits['credits'] = [];
  const kept: string[] = [];
  const moved = new Set<string>();

  for (const credit of COLLECTION_CREDITS) {
    if (!Object.prototype.hasOwnProperty.call(extra, credit.category)) continue;
    const value = extra[credit.category];
    if (typeof value !== 'string') {
      kept.push(credit.category);
      continue;
    }
    credits.push({ credit, text: value });
    moved.add(credit.category);
  }

  const rest = Object.fromEntries(Object.entries(extra).filter(([key]) => !moved.has(key)));
  return { extra: Object.keys(rest).length > 0 ? rest : null, credits, kept };
}

/** The Contributor's backward_compatibility: one per collection and category. */
export function collectionCreditKey(collectionKey: string, category: string): string {
  return `${collectionKey}#credit:${category}`;
}
