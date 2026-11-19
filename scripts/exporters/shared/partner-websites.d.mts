/** Types of `partner-websites.mjs`. */

export interface PartnerWebsite {
  url: string
  title?: string
}

export function partnerWebsites(
  query: (sql: string, params?: (string | number | null)[]) => Promise<unknown[]>,
  partnerIds: string[]
): Promise<Map<string, PartnerWebsite[]>>
