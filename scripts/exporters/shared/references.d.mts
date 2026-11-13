/** Types of `references.mjs`. */
import type { Query, Site, SiteLink } from './sites.mjs'

export interface ItemReference {
  id: string
  type: string
  backward_compatibility: string | null
  /** The item's name per language code. */
  names: Record<string, string>
  /** The item's first picture, a `/pub` rendition URL; null when it has none. */
  picture: string | null
  /** The page that opens the item on each site that has one (`pages.mjs`), its home site first. */
  sites: SiteLink[]
}

export function namesByItem(
  rows: { item_id: string; language: string; context_id: string; own_context_id: string | null; name: string | null }[]
): Map<string, Record<string, string>>

export function resolveReferences(
  query: Query,
  itemIds: string[],
  options: { baseUrl: string; sites?: Site[] }
): Promise<ItemReference[]>
