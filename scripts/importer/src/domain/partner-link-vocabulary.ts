/**
 * The values of `collection_partner.level` and `collection_partner.collection_type`
 * (#2796).
 *
 * The app holds them in `App\Enums\PartnerLevel` and
 * `App\Enums\CollectionPartnerType`, and its pivot model casts both columns.
 * The importer writes through SQL, past the app's validation, so it keeps this
 * copy: `attachPartnerToCollectionWithLevel` takes these types, and the
 * compiler refuses any other value. `partner-link-vocabulary.test.ts` checks
 * the copy against the two PHP enums.
 */

/**
 * A project's three tiers, then legacy's only thematic gallery exhibition
 * partner category ("Other contributor").
 */
export const PARTNER_LEVELS = [
  'partner',
  'associated_partner',
  'minor_contributor',
  'material_provider',
] as const;

export type PartnerLevel = (typeof PARTNER_LEVELS)[number];

export const COLLECTION_PARTNER_TYPES = ['collection', 'project', 'gallery', 'exhibition'] as const;

export type CollectionPartnerType = (typeof COLLECTION_PARTNER_TYPES)[number];
