/**
 * The collection credits: the `collection_translations.extra` keys that name
 * the people behind a collection's texts (M16 I5, #2648).
 *
 * Each key becomes a Contributor of the collection, with its category
 * (`App\Enums\ContributorCategory`, #2795), and each translation's text
 * becomes that Contributor's translation in the same language and context,
 * kept as written:
 * - a name in `name`;
 * - a block (credits, a team, lines with roles) in `description`.
 *
 * The `extra` key is the legacy field the other importers write; the category
 * says what the credit is. They differ for two credits:
 * - `travels_author` → `source_text_author`, the author of a text the
 *   collection reuses;
 * - `credits` → `exhibition_credits`, an exhibition's block of credit lines.
 *
 * The order here is also the Contributors' display order.
 */

import type { CollectionCreditCategory } from '../domain/contributor-category.js';

export interface CollectionCredit {
  /** The `extra` key the other importers write, and this step reads. */
  extraKey: string;
  /** The Contributor's category. */
  category: CollectionCreditCategory;
  /** Where the text goes on the Contributor translation. */
  field: 'name' | 'description';
  /** The Contributor's internal name. */
  label: string;
}

export const COLLECTION_CREDITS: readonly CollectionCredit[] = [
  { extraKey: 'author', category: 'author', field: 'name', label: 'Author' },
  {
    extraKey: 'travels_author',
    category: 'source_text_author',
    field: 'name',
    label: 'Source text author',
  },
  { extraKey: 'prepared_by', category: 'prepared_by', field: 'description', label: 'Prepared by' },
  { extraKey: 'curated_by', category: 'curated_by', field: 'description', label: 'Curated by' },
  {
    extraKey: 'credits',
    category: 'exhibition_credits',
    field: 'description',
    label: 'Exhibition credits',
  },
  {
    extraKey: 'local_coordinator',
    category: 'local_coordinator',
    field: 'description',
    label: 'Local coordinator',
  },
  { extraKey: 'local_team', category: 'local_team', field: 'description', label: 'Local team' },
  { extraKey: 'photo_by', category: 'photo_by', field: 'description', label: 'Photo by' },
];

/** The `extra` keys this step moves. */
export const COLLECTION_CREDIT_EXTRA_KEYS: readonly string[] = COLLECTION_CREDITS.map(
  (credit) => credit.extraKey
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
    if (!Object.prototype.hasOwnProperty.call(extra, credit.extraKey)) continue;
    const value = extra[credit.extraKey];
    if (typeof value !== 'string') {
      kept.push(credit.extraKey);
      continue;
    }
    credits.push({ credit, text: value });
    moved.add(credit.extraKey);
  }

  const rest = Object.fromEntries(Object.entries(extra).filter(([key]) => !moved.has(key)));
  return { extra: Object.keys(rest).length > 0 ? rest : null, credits, kept };
}

/**
 * The Contributor's backward_compatibility: one per collection and credit,
 * keyed by the legacy `extra` key so that it stays stable whatever the
 * category is called.
 */
export function collectionCreditKey(collectionKey: string, extraKey: string): string {
  return `${collectionKey}#credit:${extraKey}`;
}
