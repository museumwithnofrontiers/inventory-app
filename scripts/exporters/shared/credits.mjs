// @ts-check
/**
 * Collection credits (M16 I5, inventory-app#2648): the people behind a
 * collection's texts are Contributors of the collection, one per credit, with
 * the credit's `extra` key as their `category`. The importer moved them out of
 * `collection_translations.extra` (CollectionCreditsImporter); the packages
 * still ship them there, so an exporter puts each one back under its key.
 *
 * A Contributor translation gives the text of its language and context: its
 * `name`, else its `description`, else an empty text (an empty
 * `travels_author` says the text names nobody). A hidden Contributor is left
 * out.
 *
 * Types are in `credits.d.mts`.
 */

/** The credit keys, in display order (the importer's COLLECTION_CREDITS). */
export const COLLECTION_CREDIT_KEYS = Object.freeze([
  'author',
  'travels_author',
  'prepared_by',
  'curated_by',
  'credits',
  'local_coordinator',
  'local_team',
  'photo_by',
])

const CHUNK = 500

/** @param {unknown[]} values */
const marks = values => values.map(() => '?').join(', ')

/**
 * @param {string} collectionId
 * @param {string} languageId
 * @param {string} contextId
 */
export const creditKey = (collectionId, languageId, contextId) => `${collectionId}|${languageId}|${contextId}`

/**
 * The credits of these collections, by `creditKey` of their translation.
 *
 * @param {import('./sites.mjs').Query} query
 * @param {string[]} collectionIds
 * @returns {Promise<Map<string, Record<string, string>>>}
 */
export async function loadCollectionCredits(query, collectionIds) {
  /** @type {Map<string, Record<string, string>>} */
  const credits = new Map()
  for (let start = 0; start < collectionIds.length; start += CHUNK) {
    const ids = collectionIds.slice(start, start + CHUNK)
    const rows = /** @type {{ collection_id: string, language_id: string, context_id: string, category: string, name: string | null, description: string | null }[]} */ (
      await query(
        `SELECT c.collection_id, t.language_id, t.context_id, c.category, t.name, t.description
         FROM contributors c
         JOIN contributor_translations t ON t.contributor_id = c.id
         WHERE c.collection_id IN (${marks(ids)})
           AND c.category IN (${marks([...COLLECTION_CREDIT_KEYS])})
           AND c.visible = 1
         ORDER BY c.collection_id, t.language_id, t.context_id, c.display_order, c.category`,
        [...ids, ...COLLECTION_CREDIT_KEYS]
      )
    )
    for (const row of rows) {
      const key = creditKey(row.collection_id, row.language_id, row.context_id)
      const texts = credits.get(key) ?? {}
      texts[row.category] = row.name ?? row.description ?? ''
      credits.set(key, texts)
    }
  }
  return credits
}

/**
 * The translation's `extra` with its credits back under their keys, in the
 * key order MySQL gives a JSON object (shorter keys first, then byte order),
 * so the package reads as it did when the credits were stored there.
 *
 * @param {unknown} extra
 * @param {Record<string, string> | undefined} credits
 * @returns {unknown}
 */
export function withCollectionCredits(extra, credits) {
  if (!credits || Object.keys(credits).length === 0) return extra
  const base = extra && typeof extra === 'object' && !Array.isArray(extra) ? /** @type {Record<string, unknown>} */ (extra) : {}
  return mysqlJsonOrder({ ...base, ...credits })
}

/**
 * The object's keys in MySQL's JSON order: by length, then by their UTF-8 bytes.
 *
 * @param {Record<string, unknown>} object
 * @returns {Record<string, unknown>}
 */
export function mysqlJsonOrder(object) {
  const keys = Object.keys(object).sort((a, b) => {
    const left = Buffer.from(a, 'utf8')
    const right = Buffer.from(b, 'utf8')
    return left.length - right.length || Buffer.compare(left, right)
  })
  return Object.fromEntries(keys.map(key => [key, object[key]]))
}
