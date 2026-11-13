/** Types of `pages.mjs`. */
import type { Query, Site, SiteLink } from './sites.mjs'

export const EXPLORE_SOURCES: string[]
export function sourceRank(key: string | null): number
export function exploreMonuments(
  members: { location: string; item: string; order: number | null; key: string | null; extra: unknown }[]
): Map<string, { location: string; main: string }[]>
export function resolveItemPages(
  query: Query,
  links: Map<string, SiteLink[]>,
  sites: Site[],
  parents: Map<string, string | null>
): Promise<Map<string, SiteLink[]>>
