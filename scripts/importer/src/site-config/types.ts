/**
 * Site configuration (M16 E4b, #2673; decision 6): the legacy settings of a
 * site — which image in which slot, a gallery's host and slug, Explore's home
 * banners and itinerary kinds, an exhibition's list metadata — belong to the
 * sites, not to the inventory. The importers that read them no longer write
 * them; each one builds them for the `site-config` command, which writes them
 * into the instance files (`scripts/exporters/instances/*.json`), and the
 * exporters give them back to the packages.
 */

/** What one importer builds for one collection. */
export interface SiteConfigEntry {
  /** The collection's legacy key (`backward_compatibility`). */
  collection: string;
  /** Keys of the collection's own `extra`. */
  extra?: Record<string, unknown>;
  /** Keys every text of the collection carries, the same in each language. */
  translationExtra?: Record<string, unknown>;
  /** Keys of one language's text, by language id. */
  translations?: Record<string, Record<string, unknown>>;
}

/** A collection's site configuration, as an instance file holds it. */
export interface SiteConfigRecord {
  extra?: Record<string, unknown>;
  translation_extra?: Record<string, unknown>;
  translations?: Record<string, Record<string, unknown>>;
}

/** An importer that can build its share of the site configuration. */
export interface SiteConfigBuilder {
  getName(): string;
  siteConfiguration(): Promise<SiteConfigEntry[]>;
}

/** The top-level keys of `collections.extra` that are site configuration. */
export const SITE_COLLECTION_KEYS: readonly string[] = [
  'thg_gallery',
  'logos',
  'explore_home',
  'explore_travel',
  'explore_itinerary',
];

/** The top-level keys of `collection_translations.extra` that are site configuration. */
export const SITE_TRANSLATION_KEYS: readonly string[] = [
  'thg_gallery',
  'thg_gallery_lang',
  'legacy_exhibition',
  'exhibition_i18n',
];
