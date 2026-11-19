// @ts-check
/**
 * A partner's other websites (M16 F3, inventory-app#2653). They were the
 * `urls` list of each partner translation, the same on every one; they are
 * the partner's `website` links now. The packages still ship them as
 * `additional_urls`, in list order, each `{url, title}` with `title` only
 * where legacy had one, as MySQL ordered the keys.
 *
 * Types are in `partner-websites.d.mts`.
 */

/** @param {unknown[]} values */
const marks = values => values.map(() => '?').join(', ')

/**
 * @param {(sql: string, params?: (string | number | null)[]) => Promise<unknown[]>} query
 * @param {string[]} partnerIds
 * @returns {Promise<Map<string, { url: string, title?: string }[]>>}
 */
export async function partnerWebsites(query, partnerIds) {
  /** @type {Map<string, { url: string, title?: string }[]>} */
  const out = new Map()
  const unique = [...new Set(partnerIds)]
  if (unique.length === 0) return out
  const rows = /** @type {{ partner_id: string, url: string, title: string | null }[]} */ (
    await query(
      `SELECT linkable_id AS partner_id, url, title
       FROM links
       WHERE linkable_type = 'partner' AND type = 'website' AND linkable_id IN (${marks(unique)})
       ORDER BY linkable_id, display_order, id`,
      unique
    )
  )
  for (const row of rows) {
    const entry = row.title === null ? { url: row.url } : { url: row.url, title: row.title }
    const list = out.get(row.partner_id)
    if (list) list.push(entry)
    else out.set(row.partner_id, [entry])
  }
  return out
}
