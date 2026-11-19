// @ts-check
/**
 * Partner columns (M16 D2, inventory-app#2646): the partner fields that left
 * `partner_translations.extra`. The packages still read them from the
 * translation's `extra`, so an exporter selects them next to the translation
 * and puts the legacy keys back before reading `extra`. The importer's
 * mapping is `scripts/importer/src/utils/partner-columns.ts`; keep the two in
 * step:
 *
 * - the partner's contacts (`partner_contacts`, display order 1 and 2) go back
 *   as `contact_person_1` and `contact_person_2`, each with only the fields it
 *   has, in the key order MySQL gives a JSON object;
 * - `partners.featured` goes back as `portal_display: 'y'` (a partner that
 *   isn't featured ships no flag: `n` and none read the same);
 * - `partners.city` goes back as `city`;
 * - the translation's `also_known_as` goes back as `ex_name`.
 *
 * The partner-level keys go back on every translation of the partner, as the
 * importer had duplicated them. Types are in `partner-columns.d.mts`.
 */

import { mysqlJsonOrder } from './credits.mjs'

const CONTACT = (n) => `partner_columns_contact_${n}`
const FEATURED = 'partner_columns_featured'
const CITY = 'partner_columns_city'
const ALSO_KNOWN_AS = 'partner_columns_also_known_as'
const COLUMNS = [CONTACT(1), CONTACT(2), FEATURED, CITY, ALSO_KNOWN_AS]

const CONTACT_FIELDS = ['name', 'title', 'email', 'phone', 'fax']

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = value => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The partner columns, for a SELECT list on `partner_translations`.
 *
 * @param {string} alias the partner_translations alias (or table name) in the query
 * @returns {string}
 */
export function partnerColumnsSelect(alias) {
  const contact = n =>
    `(SELECT JSON_OBJECT(${CONTACT_FIELDS.map(field => `'${field}', pc.${field}`).join(', ')})` +
    ` FROM partner_contacts pc WHERE pc.partner_id = ${alias}.partner_id AND pc.display_order = ${n} LIMIT 1) AS ${CONTACT(n)}`
  return [
    contact(1),
    contact(2),
    `(SELECT own_partner.featured FROM partners own_partner WHERE own_partner.id = ${alias}.partner_id) AS ${FEATURED}`,
    `(SELECT own_partner.city FROM partners own_partner WHERE own_partner.id = ${alias}.partner_id) AS ${CITY}`,
    `${alias}.also_known_as AS ${ALSO_KNOWN_AS}`,
  ].join(', ')
}

/**
 * A contact as legacy's extra held it: only the fields it has, in MySQL JSON key order.
 *
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
function contactOf(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!isObject(parsed)) return null
  const fields = Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string'))
  return Object.keys(fields).length > 0 ? mysqlJsonOrder(fields) : null
}

/**
 * `extra` with the partner columns back under their legacy keys, in MySQL
 * JSON key order. With nothing to give back, `extra` is returned as it came.
 *
 * @param {unknown} extra the row's `extra`: a JSON string, an object or null
 * @param {Record<string, unknown>} row the row, holding the selected columns
 * @returns {unknown}
 */
export function withPartnerColumns(extra, row) {
  /** @type {Record<string, unknown>} */
  const texts = {}
  for (const n of [1, 2]) {
    const contact = contactOf(row[CONTACT(n)])
    if (contact !== null) texts[`contact_person_${n}`] = contact
  }
  if (row[FEATURED] === true || Number(row[FEATURED]) === 1) texts.portal_display = 'y'
  if (typeof row[CITY] === 'string') texts.city = row[CITY]
  if (typeof row[ALSO_KNOWN_AS] === 'string') texts.ex_name = row[ALSO_KNOWN_AS]
  if (Object.keys(texts).length === 0) return extra
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  const base = isObject(parsed) ? parsed : {}
  return mysqlJsonOrder({ ...base, ...texts })
}

/**
 * Puts each row's partner columns (selected with `partnerColumnsSelect`) back
 * into its `extra`, then removes them. In place; returns the rows.
 *
 * @template {{ extra?: unknown }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function restorePartnerColumns(rows) {
  for (const row of rows) {
    const record = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (row))
    record.extra = withPartnerColumns(record.extra, record)
    for (const column of COLUMNS) delete record[column]
  }
  return rows
}
