/**
 * The values of `contributors.category` (#2795).
 *
 * The app holds them in `App\Enums\ContributorCategory` and casts the column
 * to it. The importer writes through SQL, past the app's validation, so it
 * keeps this copy: `ContributorData.category` takes this type, and the
 * compiler refuses any other value. `contributor-category.test.ts` checks the
 * copy against the PHP enum.
 */

/** The collection credits, the people behind a collection's texts. */
export const COLLECTION_CREDIT_CATEGORIES = [
  'author',
  'source_text_author',
  'prepared_by',
  'curated_by',
  'exhibition_credits',
  'local_coordinator',
  'local_team',
  'photo_by',
] as const;

/** One per category of legacy's `mwnf3_thematic_gallery.contributor_category`. */
export const THEMATIC_GALLERY_CONTRIBUTOR_CATEGORIES = [
  'in_cooperation_with',
  'on_the_occasion_of',
  'main_contributors',
  'with_the_support_of',
] as const;

export const CONTRIBUTOR_CATEGORIES = [
  ...COLLECTION_CREDIT_CATEGORIES,
  ...THEMATIC_GALLERY_CONTRIBUTOR_CATEGORIES,
] as const;

export type CollectionCreditCategory = (typeof COLLECTION_CREDIT_CATEGORIES)[number];
export type ContributorCategory = (typeof CONTRIBUTOR_CATEGORIES)[number];

/**
 * Legacy's `contributor_category.category_id` → the category the importer
 * writes. Named for what the contributor did, as legacy's labels say it.
 */
export const THEMATIC_GALLERY_CATEGORY_BY_LEGACY_KEY: Readonly<
  Record<string, (typeof THEMATIC_GALLERY_CONTRIBUTOR_CATEGORIES)[number]>
> = Object.freeze({
  cooperator: 'in_cooperation_with',
  occasion: 'on_the_occasion_of',
  partner: 'main_contributors',
  sponsor: 'with_the_support_of',
});
