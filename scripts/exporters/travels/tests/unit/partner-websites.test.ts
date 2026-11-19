import { describe, expect, it } from 'vitest'
import { partnerWebsites } from '../../../shared/partner-websites.mjs'

describe('partnerWebsites (F3)', () => {
  it("lists each partner's website links as {url, title}, title only where there is one", async () => {
    const calls: unknown[][] = []
    const query = async (sql: string, params?: (string | number | null)[]) => {
      calls.push([sql, params])
      return [
        { partner_id: 'p1', url: 'https://a.example.org/', title: 'A' },
        { partner_id: 'p1', url: 'https://b.example.org/', title: null },
        { partner_id: 'p2', url: 'https://c.example.org/', title: 'C' },
      ]
    }

    const websites = await partnerWebsites(query, ['p1', 'p2', 'p1'])

    expect(websites.get('p1')).toEqual([{ url: 'https://a.example.org/', title: 'A' }, { url: 'https://b.example.org/' }])
    expect(Object.keys(websites.get('p1')![0]!)).toEqual(['url', 'title'])
    expect(websites.get('p2')).toEqual([{ url: 'https://c.example.org/', title: 'C' }])
    expect(calls[0]![1]).toEqual(['p1', 'p2'])
    expect(String(calls[0]![0])).toContain("linkable_type = 'partner' AND type = 'website'")
  })

  it('asks nothing for no partner', async () => {
    const websites = await partnerWebsites(async () => {
      throw new Error('no query expected')
    }, [])
    expect(websites.size).toBe(0)
  })
})
