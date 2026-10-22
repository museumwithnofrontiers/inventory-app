import { detectFamily } from './family.js'
import { isRec, type JsonValue, type PackageView, type Rec } from './package-view.js'

/** Absent, null, an empty string, an empty array or an empty object. */
export function isEmpty(value: JsonValue | undefined): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (isRec(value)) return Object.keys(value).length === 0
  return false
}

/** Per field: how many records leave it empty. Fields always filled are left out. */
function emptyFields(records: Rec[]): Record<string, number> {
  const fields = new Set<string>()
  for (const r of records) for (const k of Object.keys(r)) fields.add(k)
  const out: Record<string, number> = {}
  for (const field of [...fields].sort()) {
    const empty = records.filter(r => isEmpty(r[field])).length
    if (empty > 0) out[field] = empty
  }
  return out
}

const pct = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 10

function countBy(records: Rec[], key: string): Record<string, number> | undefined {
  if (!records.some(r => typeof r[key] === 'string')) return undefined
  const out: Record<string, number> = {}
  for (const r of records) {
    const value = typeof r[key] === 'string' ? (r[key] as string) : '(none)'
    out[value] = (out[value] ?? 0) + 1
  }
  return out
}

function translationCoverage(view: PackageView, entity: string, ids: string[]) {
  const out: Record<string, { records: number; coverage_pct: number | null; orphans: number }> = {}
  const known = new Set(ids)
  for (const lang of view.languagesOf(entity)) {
    const map = view.translations(entity, lang)
    const keys = Object.keys(map).filter(k => !k.includes('/'))
    const covered = keys.filter(k => known.has(k)).length
    out[lang] = {
      records: keys.length,
      coverage_pct: pct(covered, ids.length),
      orphans: keys.length - covered,
    }
  }
  return out
}

function itemChecks(view: PackageView) {
  const items = view.records('items')
  if (items.length === 0) return undefined
  const languages = view.languagesOf('items')
  const maps = languages.map(l => [l, view.translations('items', l)] as const)
  const partners = new Set(view.records('partners').map(p => p.id))
  const ids = new Set(items.map(i => i.id))
  let noTranslation = 0
  let mismatch = 0
  let noName = 0
  const sample = {
    without_images: [] as string[],
    without_translation: [] as string[],
    language_mismatch: [] as string[],
  }
  for (const item of items) {
    const id = item.id as string
    const actual = maps.filter(([, m]) => m[id] !== undefined).map(([l]) => l)
    if (actual.length === 0) {
      noTranslation++
      if (sample.without_translation.length < 10) sample.without_translation.push(id)
    }
    if (!maps.some(([, m]) => typeof m[id]?.name === 'string' && m[id].name !== '')) noName++
    const declared = Array.isArray(item.languages)
      ? item.languages.filter(l => typeof l === 'string')
      : []
    if (declared.length !== actual.length || declared.some(l => !actual.includes(l as string))) {
      mismatch++
      if (sample.language_mismatch.length < 10) sample.language_mismatch.push(id)
    }
    if (
      !(Array.isArray(item.images) && item.images.length > 0) &&
      sample.without_images.length < 10
    ) {
      sample.without_images.push(id)
    }
  }
  return {
    count: items.length,
    without_images: items.filter(i => !(Array.isArray(i.images) && i.images.length > 0)).length,
    without_any_translation: noTranslation,
    without_a_name_in_any_language: noName,
    declared_languages_differ_from_translations: mismatch,
    without_partner: items.filter(i => typeof i.partner_id !== 'string').length,
    partner_not_in_package: items.filter(
      i => typeof i.partner_id === 'string' && !partners.has(i.partner_id)
    ).length,
    parent_not_in_package: items.filter(
      i => typeof i.parent_id === 'string' && !ids.has(i.parent_id)
    ).length,
    sample_ids: sample,
  }
}

function partnerChecks(view: PackageView) {
  const partners = view.records('partners')
  if (partners.length === 0 || !view.has('items.json')) return undefined
  const counts = new Map<string, number>()
  for (const i of view.records('items')) {
    if (typeof i.partner_id === 'string')
      counts.set(i.partner_id, (counts.get(i.partner_id) ?? 0) + 1)
  }
  const mismatched = partners.filter(
    p => typeof p.item_count === 'number' && p.item_count !== (counts.get(p.id as string) ?? 0)
  )
  return {
    count: partners.length,
    item_count_differs_from_items_json: mismatched.length,
    holding_no_item_in_package: partners.filter(p => !counts.has(p.id as string)).length,
    sample_mismatches: mismatched.slice(0, 10).map(p => ({
      id: p.id,
      backward_compatibility: p.backward_compatibility ?? null,
      item_count: p.item_count,
      items_in_package: counts.get(p.id as string) ?? 0,
    })),
  }
}

/**
 * Import-quality figures for one package version: record counts per type,
 * translation coverage per language, and fields left empty.
 */
export function packageStats(view: PackageView) {
  const entities: Record<string, unknown> = {}
  for (const f of view.topLevelJson()) {
    const value = view.json(f)
    if (!Array.isArray(value)) continue
    const records = value.filter(isRec)
    const entity = f.replace(/\.json$/, '')
    const ids = records.flatMap(r => (typeof r.id === 'string' ? [r.id] : []))
    entities[entity] = {
      count: records.length,
      by_type: countBy(records, 'type') ?? countBy(records, 'category'),
      empty_fields: emptyFields(records),
      translations: view.languagesOf(entity).length
        ? translationCoverage(view, entity, ids)
        : undefined,
    }
  }
  const files = view.listFiles()
  return {
    package: view.label,
    family: detectFamily(view),
    files: files.length,
    bytes: files.reduce((sum, f) => sum + view.size(f), 0),
    entities,
    checks: { items: itemChecks(view), partners: partnerChecks(view) },
  }
}

/**
 * One entity in depth, including per-language field fill rates. Accepts
 * `items`, `items.json` or a translation file such as `translations/items.fr.json`.
 */
export function entityStats(view: PackageView, name: string) {
  const entity = name
    .replace(/^translations\//, '')
    .replace(/\.json$/, '')
    .replace(/\.[A-Za-z-]+$/, '')
  const file = `${entity}.json`
  const value = view.has(file) ? view.json(file) : null
  const records = Array.isArray(value) ? value.filter(isRec) : isRec(value) ? [value] : []
  const ids = records.flatMap(r => (typeof r.id === 'string' ? [r.id] : []))
  const languages: Record<string, unknown> = {}
  for (const lang of view.languagesOf(entity)) {
    const map = view.translations(entity, lang)
    const entries = Object.values(map)
    const fields = new Set<string>()
    for (const e of entries) for (const k of Object.keys(e)) fields.add(k)
    const filled: Record<string, number | null> = {}
    for (const field of [...fields].sort()) {
      filled[field] = pct(entries.filter(e => !isEmpty(e[field])).length, entries.length)
    }
    languages[lang] = {
      records: entries.length,
      coverage_pct: pct(ids.filter(id => map[id] !== undefined).length, ids.length),
      field_filled_pct: filled,
    }
  }
  return {
    package: view.label,
    entity,
    count: records.length,
    by_type: countBy(records, 'type') ?? countBy(records, 'category'),
    empty_fields: emptyFields(records),
    translations: languages,
  }
}
