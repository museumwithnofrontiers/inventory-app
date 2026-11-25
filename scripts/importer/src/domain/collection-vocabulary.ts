/**
 * The values of `collections.type` and `collections.purpose` (#2794).
 *
 * The app holds them in `App\Enums\CollectionType` and
 * `App\Enums\CollectionPurpose`, and casts both columns to those enums. The
 * importer writes through SQL, past the app's validation, so it keeps this
 * copy: `CollectionData` and the purpose writers take these types, and the
 * compiler refuses any other value. `collection-vocabulary.test.ts` checks the
 * copy against the two PHP enums.
 */

export const COLLECTION_TYPES = [
  'collection',
  'exhibition',
  'gallery',
  'theme',
  'exhibition trail',
  'itinerary',
  'location',
  'subtheme',
  'region',
] as const;

export type CollectionType = (typeof COLLECTION_TYPES)[number];

/**
 * Section anchors (`*-root`) are unique per context; `national-context` may
 * occur many times per context.
 */
export const COLLECTION_PURPOSES = [
  'exhibitions-root',
  'artistic-introduction-root',
  'historical-profiles-root',
  'historical-background-root',
  'topics-root',
  'galleries-root',
  'travels-root',
  'explore-root',
  'explore-themes-root',
  'explore-countries-root',
  'explore-itineraries-root',
  'national-context',
] as const;

export type CollectionPurpose = (typeof COLLECTION_PURPOSES)[number];
