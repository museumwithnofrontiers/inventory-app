import { publicationLinks, type PageLink } from '../../../shared/links.mjs'
import { loadSites, type Site } from '../../../shared/sites.mjs'
import type { Database } from './database.js'

/**
 * Legacy's "Related MWNF Travel Book" on a Discover Islamic Art item sheet
 * (`database_item.php`, M14 D4, #2538, #2440): the first work of project IAM
 * whose country is the item's — the MWNF Travel Book of that country — in
 * the books' order (their legacy id). Legacy reads it for every item, of
 * Islamic Art and of Explore Islamic Art Collections alike, by its country
 * alone: the Travel Books are IAM's, not ISL's ("ISL read as IAM").
 *
 * The rule lives here, once (D-P10): nothing stores it per item.
 */
export const TRAVEL_BOOK_PROJECT = 'mwnf3:projects:IAM'

interface TravelBookRow {
  id: string
  country_id: string
  backward_compatibility: string | null
}

/** The legacy book id of a publication (`mwnf3:bookbase:{id}`); books with none come last. */
function legacyBookId(key: string | null): number {
  const match = key?.match(/^mwnf3:bookbase:(\d+)$/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

/** The first Travel Book of each country, as legacy picks it. */
export function firstBookByCountry(rows: TravelBookRow[]): Map<string, string> {
  const sorted = [...rows].sort(
    (a, b) =>
      legacyBookId(a.backward_compatibility) - legacyBookId(b.backward_compatibility) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  const out = new Map<string, string>()
  for (const row of sorted) if (!out.has(row.country_id)) out.set(row.country_id, row.id)
  return out
}

/** Each country's Travel Book, linked to its page on the Publications site. */
export async function travelBooksByCountry(
  db: Pick<Database, 'query'>,
  sites: Site[] = loadSites()
): Promise<Map<string, PageLink>> {
  const rows = await db.query<TravelBookRow>(
    `SELECT p.id, p.country_id, p.backward_compatibility
     FROM publications p
     JOIN projects pr ON pr.id = p.project_id
     WHERE pr.backward_compatibility = ? AND p.country_id IS NOT NULL
     ORDER BY p.id`,
    [TRAVEL_BOOK_PROJECT]
  )
  const byCountry = firstBookByCountry(rows)
  const links = await publicationLinks((sql, params) => db.query(sql, params), [...new Set(byCountry.values())], sites)
  const linkById = new Map(links.map(link => [link.id, link]))
  const out = new Map<string, PageLink>()
  for (const [country, id] of byCountry) {
    const link = linkById.get(id)
    if (link) out.set(country, link)
  }
  return out
}
