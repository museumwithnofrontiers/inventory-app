/** Types of `links.mjs`. */
import type { Query, Site, SiteLink } from './sites.mjs'

/** A page of another site: a publication on Publications, a trail on Travels. */
export interface PageLink extends SiteLink {
  id: string
  backward_compatibility: string | null
  /** The title per language code. */
  titles: Record<string, string>
}

export interface TrailLink extends PageLink {
  /** The subtitle per language code; legacy titled a trail "<title> - <subtitle>". */
  subtitles: Record<string, string>
}

export function publicationLinks(query: Query, ids: string[], sites?: Site[]): Promise<PageLink[]>
export function trailLinks(query: Query, ids: string[], sites?: Site[]): Promise<TrailLink[]>
