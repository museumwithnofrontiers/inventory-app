// @ts-check
/**
 * Item translation columns (M16, ADR 006): the texts that left
 * `item_translations.extra` for columns of their own. The importer moves each
 * key to its column (`scripts/importer/src/utils/item-translation-columns.ts`,
 * keep the two lists equal); the packages still ship each text under its
 * legacy key in `extra`, so an exporter selects the columns and puts the keys
 * back before reading `extra`.
 *
 * - B1 (inventory-app#2635): materials, short description, dynasty, region,
 *   history.
 * - B4 (inventory-app#2638): the credits as written, in the four `*_credit`
 *   columns. On an Explore or Travels text `author_credit` goes back as
 *   `prepared_by`, the legacy field those texts had; on any other text the four
 *   go back inside `credits_as_written`. The translation's legacy key says
 *   which, so `itemColumnsSelect` selects it too.
 * - B2 (inventory-app#2636) and B3 (inventory-app#2637): the keyword line and
 *   the artist, workshop, scribe, patron and architect lines, as written.
 * - F1 (inventory-app#2651): a picture's `photographer` and its own credit
 *   (`copyright`) left its translations for its image row. A picture's rows
 *   ship them per language, so each row gets the image's value back, unless a
 *   row of that picture still holds the key: the importer leaves the texts
 *   that differ by language in `extra` until they are reviewed. The credit is
 *   the image's `credit`, else its `copyright` without the mark the importer
 *   added for the burn.
 * - B5 (inventory-app#2639) and B6 (inventory-app#2640): the catalogue
 *   references and the two Sharing History notices, as written.
 * - M17 B2 (inventory-app#2745): Sharing History's display status is
 *   `sh_display_status` in a Sharing History text's `extra`; it goes back
 *   under its legacy name, `legacy_display_status`.
 * - F3 (inventory-app#2653): an object's `catalogue_holding_link` is the item's
 *   `catalogue` link in the translation's language; it goes back to that row.
 * - B7 (inventory-app#2690): Sharing History's `third_name`, `archival` and
 *   `holding_institution_org`; and its `second_name`, which is the
 *   `alternate_name` column on Sharing History texts only (an entry with
 *   `sources`). Their one "Also known as" (legacy `name2`) stays in `extra` and
 *   goes back to the row's `alternate_name`, so the package reads as before.
 *
 * Types are in `item-columns.d.mts`.
 */

import { mysqlJsonOrder } from './credits.mjs'
import { VISIT_INFORMATION_COLUMN, visitInformationSelect, withVisitInformation } from './visit-information.mjs'

/** Each legacy `extra` key (`key` or `parent.child`) and the column that holds it now. */
export const ITEM_TRANSLATION_COLUMNS = Object.freeze([
  Object.freeze({ key: 'materials', column: 'materials' }),
  Object.freeze({ key: 'description2', column: 'short_description' }),
  Object.freeze({ key: 'dynasty', column: 'dynasty' }),
  Object.freeze({ key: 'province', column: 'region' }),
  Object.freeze({ key: 'history', column: 'history' }),
  Object.freeze({ key: 'credits_as_written.author', column: 'author_credit' }),
  Object.freeze({ key: 'credits_as_written.copy_editor', column: 'copy_editor_credit' }),
  Object.freeze({ key: 'credits_as_written.translator', column: 'translator_credit' }),
  Object.freeze({ key: 'credits_as_written.translation_copy_editor', column: 'translation_copy_editor_credit' }),
  Object.freeze({ key: 'prepared_by', column: 'author_credit' }),
  Object.freeze({ key: 'keywords', column: 'keywords' }),
  Object.freeze({ key: 'artist', column: 'artist' }),
  Object.freeze({ key: 'period_activity', column: 'artist_period_of_activity' }),
  Object.freeze({ key: 'artist_birthdate', column: 'artist_birth_date' }),
  Object.freeze({ key: 'artist_birthplace', column: 'artist_birth_place' }),
  Object.freeze({ key: 'artist_deathdate', column: 'artist_death_date' }),
  Object.freeze({ key: 'artist_deathplace', column: 'artist_death_place' }),
  Object.freeze({ key: 'workshop', column: 'workshop' }),
  Object.freeze({ key: 'scriber', column: 'scribe' }),
  Object.freeze({ key: 'patrons', column: 'patrons' }),
  Object.freeze({ key: 'architects', column: 'architects' }),
  Object.freeze({ key: 'linkcatalogs', column: 'catalogue_references' }),
  Object.freeze({ key: 'notice', column: 'notice' }),
  Object.freeze({ key: 'notice_c', column: 'external_notice' }),
  // B7 (inventory-app#2690): Sharing History's original-language name, archival reference and
  // the holding institution's own-language name, as written.
  Object.freeze({ key: 'third_name', column: 'original_name' }),
  Object.freeze({ key: 'archival', column: 'archival_reference' }),
  Object.freeze({ key: 'holding_institution_org', column: 'holder_original_name' }),
  Object.freeze({ key: 'external_sources', column: 'external_sources' }),
  // B7 (inventory-app#2690), Pascal's decision: Sharing History's other name is the item's
  // alternate name. `sources` scopes it: every other text's alternate_name is its own (mwnf3's
  // name2), selected and shipped by the exporters as before.
  Object.freeze({ key: 'second_name', column: 'alternate_name', sources: Object.freeze(['mwnf3_sharing_history:']) }),
])

/** Sharing History's display status in a text's `extra` (M17 B2), and the key the packages ship it under. */
const SH_DISPLAY_STATUS = 'sh_display_status'
const LEGACY_DISPLAY_STATUS = 'legacy_display_status'

/** The translation's legacy key, selected next to the columns under this name. */
const SOURCE = 'item_columns_source'

/** Legacy keys of the texts whose author credit was `prepared_by`. */
const PREPARED_BY_SOURCES = Object.freeze(['mwnf3_explore:', 'mwnf3_travels:'])

/** The columns only some texts gave their key to: selected under their own name, so the exporter's own stays. */
const SCOPED = Object.freeze(ITEM_TRANSLATION_COLUMNS.filter(entry => 'sources' in entry))

/** @param {string} column */
const scopedName = column => `item_columns_scoped_${column}`

const COLUMNS = [...new Set(ITEM_TRANSLATION_COLUMNS.filter(entry => !('sources' in entry)).map(({ column }) => column))]

const SCOPED_NAMES = [...new Set(SCOPED.map(({ column }) => scopedName(column)))]

/** Legacy keys of the Sharing History texts. */
const SHARING_HISTORY = 'mwnf3_sharing_history:'

/** The picture image's fields and the "a row keeps its own" flags, selected under these names. */
const PICTURE = Object.freeze({
  photographer: 'item_columns_picture_photographer',
  credit: 'item_columns_picture_credit',
  copyright: 'item_columns_picture_copyright',
  photographerKept: 'item_columns_picture_photographer_kept',
  copyrightKept: 'item_columns_picture_copyright_kept',
  // B7 (inventory-app#2690): the picture's own text in the row's language, and
  // whether the picture has per-language texts at all.
  photographerOwn: 'item_columns_picture_photographer_own',
  copyrightOwn: 'item_columns_picture_copyright_own',
  photographerPerLanguage: 'item_columns_picture_photographer_per_language',
  copyrightPerLanguage: 'item_columns_picture_copyright_per_language',
})

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * The picture's image fields, for a SELECT list. Null on a row that isn't a
 * picture's.
 *
 * @param {string} alias
 * @returns {string[]}
 */
function pictureSelect(alias) {
  /** @param {string} column */
  const image = column =>
    `(SELECT ic_ii.${column} FROM item_images ic_ii JOIN items ic_i ON ic_i.id = ic_ii.item_id AND ic_i.type = 'picture'` +
    ` WHERE ic_ii.item_id = ${alias}.item_id ORDER BY ic_ii.display_order, ic_ii.id LIMIT 1)`
  /** @param {string} key */
  const kept = key =>
    `EXISTS (SELECT 1 FROM item_translations ic_t WHERE ic_t.item_id = ${alias}.item_id` +
    ` AND JSON_CONTAINS_PATH(ic_t.extra, 'one', '$.${key}'))`
  const imageId = image('id')
  /** @param {string} column */
  const own = column =>
    `(SELECT ic_tr.${column} FROM image_translations ic_tr WHERE ic_tr.image_type = 'item_image'` +
    ` AND ic_tr.image_id = ${imageId} AND ic_tr.language_id = ${alias}.language_id LIMIT 1)`
  /** @param {string} column */
  const perLanguage = column =>
    `EXISTS (SELECT 1 FROM image_translations ic_tr WHERE ic_tr.image_type = 'item_image'` +
    ` AND ic_tr.image_id = ${imageId} AND ic_tr.${column} IS NOT NULL)`
  return [
    `${image('photographer')} AS ${PICTURE.photographer}`,
    `${image('credit')} AS ${PICTURE.credit}`,
    `${image('copyright')} AS ${PICTURE.copyright}`,
    `${kept('photographer')} AS ${PICTURE.photographerKept}`,
    `${kept('copyright')} AS ${PICTURE.copyrightKept}`,
    `${own('photographer')} AS ${PICTURE.photographerOwn}`,
    `${own('copyright')} AS ${PICTURE.copyrightOwn}`,
    `${perLanguage('photographer')} AS ${PICTURE.photographerPerLanguage}`,
    `${perLanguage('copyright')} AS ${PICTURE.copyrightPerLanguage}`,
  ]
}

/** @param {unknown} value @returns {string | null} */
const textOf = value => (typeof value === 'string' && value !== '' ? value : null)

/** @param {unknown} value */
const isSet = value => value === true || Number(value) === 1

/**
 * `copyright` as the sheets print it: without the "© " the importer added.
 *
 * @param {string | null} copyright
 * @returns {string | null}
 */
function withoutCopyrightMark(copyright) {
  if (copyright === null) return null
  return copyright.startsWith('© ') ? copyright.slice(2) : copyright
}

/** The item's catalogue link in the row's language, selected under this name. */
const CATALOGUE = 'item_columns_catalogue_link'

/**
 * @param {string} alias
 * @returns {string}
 */
function catalogueSelect(alias) {
  return (
    `(SELECT ic_l.url FROM links ic_l WHERE ic_l.linkable_type = 'item' AND ic_l.linkable_id = ${alias}.item_id` +
    ` AND ic_l.type = 'catalogue' AND ic_l.language_id = ${alias}.language_id ORDER BY ic_l.display_order, ic_l.id LIMIT 1)` +
    ` AS ${CATALOGUE}`
  )
}

/**
 * The picture texts this row gets back from its image.
 *
 * @param {Record<string, unknown>} row
 * @returns {Record<string, string>}
 */
function pictureTexts(row) {
  /** @type {Record<string, string>} */
  const texts = {}
  // B7: a picture with per-language texts gets only its own language's back,
  // as written; a language legacy left empty stays empty.
  if (isSet(row[PICTURE.photographerPerLanguage])) {
    if (typeof row[PICTURE.photographerOwn] === 'string') texts.photographer = row[PICTURE.photographerOwn]
  } else {
    const photographer = textOf(row[PICTURE.photographer])
    if (photographer !== null && !isSet(row[PICTURE.photographerKept])) texts.photographer = photographer
  }
  if (isSet(row[PICTURE.copyrightPerLanguage])) {
    if (typeof row[PICTURE.copyrightOwn] === 'string') texts.copyright = row[PICTURE.copyrightOwn]
  } else {
    const credit = textOf(row[PICTURE.credit]) ?? withoutCopyrightMark(textOf(row[PICTURE.copyright]))
    if (credit !== null && !isSet(row[PICTURE.copyrightKept])) texts.copyright = credit
  }
  return texts
}

/**
 * The columns, for a SELECT list: `it.materials, …, it.backward_compatibility AS item_columns_source`,
 * then the picture image's fields (subqueries on `item_images`).
 *
 * @param {string} alias the item_translations alias in the query
 * @returns {string}
 */
export function itemColumnsSelect(alias) {
  return [
    ...COLUMNS.map(column => `${alias}.${column}`),
    `${alias}.backward_compatibility AS ${SOURCE}`,
    ...SCOPED_NAMES.map(name => `${alias}.${name.slice('item_columns_scoped_'.length)} AS ${name}`),
    ...pictureSelect(alias),
    `${alias}.image_rights`,
    catalogueSelect(alias),
    visitInformationSelect(alias, 'item_id'),
  ].join(', ')
}

/**
 * The legacy key `author_credit` goes back under for this row.
 *
 * @param {Record<string, unknown>} row
 * @returns {string}
 */
function authorCreditKey(row) {
  return PREPARED_BY_SOURCES.some(prefix => sourceOf(row).startsWith(prefix)) ? 'prepared_by' : 'credits_as_written.author'
}

/**
 * The row's legacy key, or '' when it wasn't selected.
 *
 * @param {Record<string, unknown>} row
 * @returns {string}
 */
function sourceOf(row) {
  return typeof row[SOURCE] === 'string' ? /** @type {string} */ (row[SOURCE]) : ''
}

/**
 * A Sharing History row's "Also known as" (legacy `name2`, a listed `extra`
 * key there since its `alternate_name` holds the second name, B7) goes back to
 * the row's `alternate_name`, if the exporter selected it, and leaves `extra`.
 * Any other row is left as it is.
 *
 * @param {Record<string, unknown>} record
 */
function restoreAlsoKnownAs(record) {
  if (!sourceOf(record).startsWith(SHARING_HISTORY)) return
  const parsed = typeof record.extra === 'string' ? JSON.parse(record.extra) : record.extra
  const name2 = isObject(parsed) && Object.prototype.hasOwnProperty.call(parsed, 'name2') ? parsed.name2 : undefined
  if (Object.prototype.hasOwnProperty.call(record, 'alternate_name')) record.alternate_name = name2 ?? null
  if (name2 === undefined || !isObject(parsed)) return
  const rest = { ...parsed }
  Reflect.deleteProperty(rest, 'name2')
  record.extra = Object.keys(rest).length > 0 ? rest : null
}

/**
 * The translation's `extra` with each column that holds a text back under its
 * legacy key, in the key order MySQL gives a JSON object (an inner object
 * too), so the package reads as it did when the texts were stored there. With
 * no such column set, `extra` is returned as it came (null stays null).
 *
 * @param {unknown} extra the row's `extra`: a JSON string, an object or null
 * @param {Record<string, unknown>} row the row, holding the columns
 * @returns {unknown}
 */
export function withItemTranslationColumns(extra, row) {
  /** @type {Record<string, unknown>} */
  const texts = {}
  for (const entry of ITEM_TRANSLATION_COLUMNS) {
    const { key, column, values } = entry
    const sources = 'sources' in entry ? entry.sources : undefined
    if (sources !== undefined && !sources.some(prefix => sourceOf(row).startsWith(prefix))) continue
    let value = sources !== undefined ? row[scopedName(column)] : row[column]
    if (typeof value !== 'string') continue
    if (values !== undefined) {
      const legacy = Object.keys(values).find(legacyValue => values[legacyValue] === value)
      if (legacy === undefined) continue
      value = legacy
    }
    if (column === 'author_credit' && key !== authorCreditKey(row)) continue
    const [parent, child] = key.split('.')
    if (child === undefined) texts[parent] = value
    else texts[parent] = { ...(isObject(texts[parent]) ? texts[parent] : {}), [child]: value }
  }
  Object.assign(texts, pictureTexts(row))
  // An object's or monument's rights line (F1): its own column, not a picture's.
  if (typeof row.image_rights === 'string') texts.copyright = row.image_rights
  const catalogue = textOf(row[CATALOGUE])
  if (catalogue !== null) texts.catalogue_holding_link = catalogue
  const parsed = typeof extra === 'string' ? JSON.parse(extra) : extra
  /** @type {Record<string, unknown>} */
  const base = isObject(parsed) ? { ...parsed } : {}
  // M17 B2: Sharing History's display status goes back under its legacy name.
  if (Object.prototype.hasOwnProperty.call(base, SH_DISPLAY_STATUS)) {
    texts[LEGACY_DISPLAY_STATUS] = base[SH_DISPLAY_STATUS]
    Reflect.deleteProperty(base, SH_DISPLAY_STATUS)
  }
  if (Object.keys(texts).length === 0) return extra
  /** @type {Record<string, unknown>} */
  const merged = { ...base }
  for (const [key, value] of Object.entries(texts)) {
    const inner = base[key]
    merged[key] = isObject(value) ? mysqlJsonOrder({ ...(isObject(inner) ? inner : {}), ...value }) : value
  }
  return mysqlJsonOrder(merged)
}

/**
 * Puts the columns of each row (selected with `itemColumnsSelect`) back into
 * its `extra`, then removes them from the row, so the rest of the exporter
 * reads the row as before. The rows are changed in place and returned.
 *
 * @template {{ extra?: unknown }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function restoreItemColumns(rows) {
  for (const row of rows) {
    const record = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (row))
    record.extra = withVisitInformation(withItemTranslationColumns(record.extra, record), record)
    restoreAlsoKnownAs(record)
    for (const column of [...COLUMNS, ...SCOPED_NAMES, SOURCE, ...Object.values(PICTURE), 'image_rights', CATALOGUE, VISIT_INFORMATION_COLUMN]) delete record[column]
  }
  return rows
}
