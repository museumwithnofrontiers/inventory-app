/**
 * Shared types for the site i18n extractor.
 */

/** A THG site is either a Gallery (thg_gallery.project_id = 'THG') or an Exhibition ('EXH'). */
export type SiteKind = 'gallery' | 'exhibition'

/**
 * One row of the site registry, assembled from thg_gallery + thg_gallery_url.
 *
 * This is the same anchor the importer writes to collections.extra.thg_gallery
 * (issue #1520), read straight from the legacy source instead.
 */
export interface SiteRegistryEntry {
  galleryId: number
  /** thg_gallery.project_id — 'THG' or 'EXH'. */
  thgProjectId: string | null
  kind: SiteKind
  /** The mwnf3 project the site's native items belong to, e.g. 'AMU', 'DCA', 'EXHCOLOUR'. */
  mwnf3ProjectId: string | null
  /** thg_gallery.link — the public URL path segment. */
  slug: string | null
  /** thg_gallery_url.link — the canonical public host of the legacy site. */
  host: string | null
  name: string
  /** 'A' = active, 'H' = hidden. */
  status: string
  i18nGroupId: number | null
  i18nCommonGroupId: number | null
}

/** One row of mwnf3.translation. */
export interface TranslationRow {
  wordId: string
  langId: string
  value: string | null
}

/** Flat vue-i18n message catalogue: locale -> key -> message. */
export type MessageCatalogue = Record<string, Record<string, string>>

/**
 * What the merge did, so a scaffolding run can be audited without re-querying.
 *
 * `droppedByLegacyRightJoin` is the interesting one: the legacy DXA API joins the
 * site group onto the common group with a RIGHT JOIN, so a site string whose
 * (key, language) pair is absent from the common group never reaches the browser.
 * We keep those strings; this list records which ones legacy was throwing away.
 */
export interface ExtractionStats {
  commonRows: number
  siteRows: number
  /** "key@lang" pairs where the site group replaced a common-group value. */
  overridden: string[]
  /**
   * "key@lang" pairs the site group restates with a value identical to the
   * common group's once both are converted. Subset of `overridden`.
   *
   * These are the pairs that make a site look like it customises something when
   * it does not, so the layered layout keeps them out of a site's own files and
   * the report names the count — a legacy-data smell worth seeing.
   */
  overriddenNoOp: string[]
  /** "key@lang" pairs contributed only by the site group. */
  added: string[]
  /** "key@lang" pairs the legacy API's RIGHT JOIN discards. Subset of overridden ∪ added. */
  droppedByLegacyRightJoin: string[]
  /** Rows skipped because word_id was empty — legacy junk, not addressable by any client. */
  emptyKeyRows: number
  /** Rows whose value contained markup and was rewritten as Markdown. */
  markdownConverted: number
  /** Rows dropped because the value was empty (vue-i18n falls back instead). */
  emptyValueRows: number
  /** Keys containing '.', which vue-i18n reads as a message path rather than a literal key. */
  keysWithDots: string[]
  locales: string[]
  keysPerLocale: Record<string, number>
}

/**
 * A site's catalogue split into the layer it shares with every other site
 * registered against the same common group, and the layer it owns.
 *
 * See `splitLayers()` for why the base is the common group rather than whatever
 * the sites in a given run happen to agree on.
 */
export interface LayerSplit {
  /** Pairs the site overrides with a different value, or adds outright. */
  own: MessageCatalogue
  /** Own keys per locale. Locales absent here get no file in the site directory. */
  ownKeysPerLocale: Record<string, number>
  /**
   * Locale -> keys the shared layer carries and the merged catalogue does not.
   *
   * Only reachable when a site group overrides a common pair with a value that
   * is empty after conversion. The layered layout has no way to express a
   * deletion — shallow-merging the two layers would resurrect the key — so a
   * non-empty `suppressed` aborts the run rather than writing output that does
   * not reproduce the flat catalogue.
   */
  suppressed: Record<string, string[]>
}

export interface ExtractedSite {
  site: SiteRegistryEntry
  messages: MessageCatalogue
  stats: ExtractionStats
  warnings: string[]
  /** Present when the run wrote layered output. */
  layers?: LayerSplit
  /** Present when the run wrote website-layout output. */
  website?: WebsiteReportInfo
}

/**
 * What the report needs about a site's website-layout output — the namespace it
 * was built with, alongside the `buildWebsiteCatalogue` result.
 */
export interface WebsiteReportInfo {
  namespace: string
  locales: MessageCatalogue
  notEmitted: string[]
  missing: string[]
}
