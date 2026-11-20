// @ts-check
/**
 * The partner each project partner belongs to (M16 J2, inventory-app#2709):
 * legacy's associated (and further associated) museums and institutions
 * under a tier-1 partner of the same project. The importer writes it on the
 * member's project-tier `collection_partner` row as `parent_partner_id`; it
 * used to be one `partner_group:*` collection per tier-1 partner.
 *
 * A member gets a parent only when both it and its parent are among the
 * partners being exported, as with the group collections before.
 *
 * Types are in `partner-parents.d.mts`.
 */

/** @param {unknown[]} values */
const marks = values => values.map(() => '?').join(', ')

/**
 * @param {(sql: string, params?: (string | number | null)[]) => Promise<unknown[]>} query
 * @param {string[]} projectIds the exported projects
 * @param {string[]} partnerIds the exported partners
 * @returns {Promise<Map<string, string>>} partner id → parent partner id
 */
export async function partnerParents(query, projectIds, partnerIds) {
  /** @type {Map<string, string>} */
  const out = new Map()
  const projects = [...new Set(projectIds)]
  const partners = [...new Set(partnerIds)]
  if (projects.length === 0 || partners.length === 0) return out
  const rows = /** @type {{ partner_id: string, parent_partner_id: string }[]} */ (
    await query(
      `SELECT cp.partner_id, cp.parent_partner_id
       FROM collection_partner cp
       JOIN collections c ON c.id = cp.collection_id
       JOIN projects proj ON proj.context_id = c.context_id
       WHERE cp.collection_type = 'project'
         AND cp.parent_partner_id IS NOT NULL
         AND proj.id IN (${marks(projects)})
         AND cp.partner_id IN (${marks(partners)})
       ORDER BY cp.partner_id, proj.id`,
      [...projects, ...partners]
    )
  )
  const exported = new Set(partners)
  for (const row of rows) {
    if (row.parent_partner_id === row.partner_id || !exported.has(row.parent_partner_id)) continue
    if (!out.has(row.partner_id)) out.set(row.partner_id, row.parent_partner_id)
  }
  return out
}
