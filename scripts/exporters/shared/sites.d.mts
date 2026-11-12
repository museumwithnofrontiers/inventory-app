/** Types of `sites.mjs`. */

/** A read-only query against the inventory database, as every exporter's `Database.query`. */
export type Query = (sql: string, params?: (string | number | null)[]) => Promise<unknown[]>

export type SiteRule =
  | { type: 'project'; projectIds: string[] }
  | { type: 'collection'; collectionId: string }
  | { type: 'subtree'; collectionId: string }
  | { type: 'tree'; rootPurpose: string; memberOf: string[] | null }

export interface Site {
  slug: string
  kind: string
  /** The site's address, no trailing slash. */
  origin: string
  /** The route of an item's page, with `:id`. */
  itemPath: string
  /** Which items the site shows; null for a site with none. */
  rule: SiteRule | null
}

/** A page of a site. */
export interface SiteLink {
  /** The site's slug. */
  site: string
  /** The page's route on that site. */
  path: string
  /** `<origin>/#<path>`. */
  url: string
}

export interface ItemFacts {
  id: string
  type: string
  project_id: string | null
  /** The collections the item is a member of, or one of its pictures is. */
  memberships: { collection_id: string; viaPicture: boolean }[]
}

export interface CollectionFacts {
  id: string
  parent_id: string | null
  type: string
  purpose: string | null
}

export const INSTANCES_DIR: string
export const DEMO_ORIGIN: string
export const DEFAULT_ITEM_PATH: string
export const PUBLICATION_PATH: string
export const TRAIL_PATH: string

export function loadSites(dir?: string): Site[]
export function siteOf(slug: string, sites: Site[]): Site
export function siteLink(site: Site, route: string, id: string): SiteLink
export function sitesShowing(
  item: ItemFacts,
  sites: Site[],
  collections: ReadonlyMap<string, CollectionFacts>
): SiteLink[]
export function readItemFacts(
  query: Query,
  itemIds: string[]
): Promise<{ items: Map<string, ItemFacts>; collections: Map<string, CollectionFacts> }>
export function resolveItemSites(query: Query, itemIds: string[], sites?: Site[]): Promise<Map<string, SiteLink[]>>
