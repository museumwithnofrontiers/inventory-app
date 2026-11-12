import { describe, expect, it } from 'vitest'

import { firstBookByCountry, travelBooksByCountry, TRAVEL_BOOK_PROJECT } from '../../src/core/travel-books.js'
import type { Site } from '../../../shared/sites.mjs'

/**
 * Legacy's "Related MWNF Travel Book" (D4, #2538): the first IAM work of the
 * item's country, kept once, here (D-P10).
 */
describe('the Travel Book of a country', () => {
  it("takes each country's first book in legacy's order", () => {
    const byCountry = firstBookByCountry([
      { id: 'later', country_id: 'jor', backward_compatibility: 'mwnf3:bookbase:20' },
      { id: 'first', country_id: 'jor', backward_compatibility: 'mwnf3:bookbase:3' },
      { id: 'egypt', country_id: 'egy', backward_compatibility: 'mwnf3:bookbase:7' },
    ])
    expect(Object.fromEntries(byCountry)).toEqual({ jor: 'first', egy: 'egypt' })
  })

  it("links it to the publication's page on the Publications site", async () => {
    const sites: Site[] = [
      { slug: 'publications', kind: 'standalone', origin: 'https://example.test/publications', itemPath: '/item/:id', rule: null },
    ]
    const asked: (string | number | null)[][] = []
    const db = {
      query: async <T>(sql: string, params: (string | number | null)[] = []): Promise<T[]> => {
        asked.push(params)
        if (sql.includes('FROM publication_translations')) return [{ id: 'p7', language: 'en', title: 'Egypt' }] as T[]
        if (sql.includes('JOIN projects pr')) {
          return [{ id: 'p7', country_id: 'egy', backward_compatibility: 'mwnf3:bookbase:7' }] as T[]
        }
        if (sql.includes('FROM publications WHERE')) return [{ id: 'p7', backward_compatibility: 'mwnf3:bookbase:7' }] as T[]
        return []
      },
    }
    const books = await travelBooksByCountry(db, sites)
    expect(asked[0]).toEqual([TRAVEL_BOOK_PROJECT])
    expect(books.get('egy')).toEqual({
      id: 'p7',
      backward_compatibility: 'mwnf3:bookbase:7',
      titles: { en: 'Egypt' },
      site: 'publications',
      path: '/publication/p7',
      url: 'https://example.test/publications/#/publication/p7',
    })
    expect(books.has('jor')).toBe(false)
  })
})
