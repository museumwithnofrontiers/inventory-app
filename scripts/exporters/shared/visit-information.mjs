// @ts-check
/**
 * Visit information (M16 D1, inventory-app#2645): how to reach a place, its
 * opening hours, contact and the rest left the item, collection and partner
 * translations' `extra` for the shared `visit_information` model. The packages
 * still ship each text under its legacy key in `extra`, so an exporter selects
 * the owner's visit information next to the translation and puts the keys
 * back before reading `extra`. The importer's mapping is
 * `scripts/importer/src/utils/visit-information.ts`; keep the two in step:
 *
 * - `how_to_reach`, `contact`, `opening_hours` go back under their own names;
 * - `practical_information` goes back as `info`;
 * - `address`, `institution`, `phone`, `fax`, `email`, `website` go back inside
 *   `monument_contact`, and a row with its own `responsible_institution_org`
 *   gets `monument_contact.responsible_institution` back from it (legacy
 *   stored the same text in both, on every such row).
 *
 * Every text goes back as stored, an empty one too, in the key order MySQL
 * gives a JSON object.
 *
 * Types are in `visit-information.d.mts`.
 */

import { mysqlJsonOrder } from './credits.mjs'

/** The column the subquery's JSON comes back in. */
export const VISIT_INFORMATION_COLUMN = 'visit_information_texts'

const TOP_LEVEL = Object.freeze({
  how_to_reach: 'how_to_reach',
  practical_information: 'info',
  contact: 'contact',
  opening_hours: 'opening_hours',
})

const CONTACT_PARTS = Object.freeze(['address', 'institution', 'phone', 'fax', 'email', 'website'])

const FIELDS = [...Object.keys(TOP_LEVEL), ...CONTACT_PARTS]

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = value => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The owner's visit information in the row's language and context, as one
 * JSON object, for a SELECT list.
 *
 * @param {string} alias the translations alias in the query
 * @param {'item_id' | 'collection_id' | 'partner_id'} ownerColumn
 * @returns {string}
 */
export function visitInformationSelect(alias, ownerColumn) {
  const pairs = FIELDS.map(field => `'${field}', vi.${field}`).join(', ')
  return (
    `(SELECT JSON_OBJECT(${pairs}) FROM visit_information vi` +
    ` WHERE vi.${ownerColumn} = ${alias}.${ownerColumn} AND vi.language_id = ${alias}.language_id` +
    ` AND vi.context_id = ${alias}.context_id LIMIT 1) AS ${VISIT_INFORMATION_COLUMN}`
  )
}

/**
 * `extra` with the visit texts back under their legacy keys, in MySQL JSON key
 * order. With nothing to give back, `extra` is returned as it came.
 *
 * @param {unknown} extra the row's `extra`: a JSON string, an object or null
 * @param {Record<string, unknown>} row the row, holding the selected column
 * @returns {unknown}
 */
export function withVisitInformation(extra, row) {
  const raw = row[VISIT_INFORMATION_COLUMN]
  const visit = typeof raw === 'string' ? JSON.parse(raw) : raw
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  const base = isObject(parsed) ? parsed : {}

  /** @type {Record<string, unknown>} */
  const texts = {}
  /** @type {Record<string, unknown>} */
  const contact = {}
  if (isObject(visit)) {
    for (const [field, key] of Object.entries(TOP_LEVEL)) {
      if (typeof visit[field] === 'string') texts[key] = visit[field]
    }
    for (const part of CONTACT_PARTS) {
      if (typeof visit[part] === 'string') contact[part] = visit[part]
    }
  }
  if (typeof base.responsible_institution_org === 'string') {
    contact.responsible_institution = base.responsible_institution_org
  }
  if (Object.keys(contact).length > 0) {
    const inner = base.monument_contact
    texts.monument_contact = mysqlJsonOrder({ ...(isObject(inner) ? inner : {}), ...contact })
  }

  if (Object.keys(texts).length === 0) return extra
  return mysqlJsonOrder({ ...base, ...texts })
}

/**
 * Puts each row's visit information (selected with `visitInformationSelect`)
 * back into its `extra`, then removes the column. In place; returns the rows.
 *
 * @template {{ extra?: unknown }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function restoreVisitInformation(rows) {
  for (const row of rows) {
    const record = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (row))
    record.extra = withVisitInformation(record.extra, record)
    delete record[VISIT_INFORMATION_COLUMN]
  }
  return rows
}
