/**
 * The search documents of `mwnf.search/1` (ADR 005): one per item a site
 * shows, with its reference numbers, the sites that show it and its texts in
 * every language it has.
 *
 * Everything here is a pure function over database rows, so the tests need
 * no database. The rows are read by `reader.ts`.
 */

import { namesByItem } from '../../../shared/references.mjs'
import type { SiteLink } from '../../../shared/sites.mjs'

/** The schema every file of the package declares. */
export const SCHEMA = 'mwnf.search/1'

export interface ItemRow {
  id: string
  type: string
  parent_id: string | null
  backward_compatibility: string | null
  mwnf_reference: string | null
  owner_reference: string | null
  start_date: number | null
  end_date: number | null
  partner_id: string | null
  country_id: string | null
}

export interface TranslationRow {
  item_id: string
  language: string
  context_id: string
  own_context_id: string | null
  name: string | null
  alternate_name: string | null
  description: string | null
  type: string | null
  holder: string | null
  owner: string | null
  dates: string | null
  location: string | null
  place_of_production: string | null
  provenance: string | null
  /** The translation's `extra` column: a JSON object, as text or already parsed. */
  extra: string | Record<string, unknown> | null
}

export interface TagRow {
  item_id: string
  label: string
  /** The tag's language, or null for a tag of every language (type, artist, dynasty…). */
  language: string | null
}

export interface NameRow {
  id: string
  language: string
  name: string | null
}

/** The texts of one language. Every list holds distinct values, in database order. */
export interface Texts {
  /** The name the item's own site gives it in this language. */
  name: string
  /** Every other name: other contexts' names, alternate, second and third names. */
  names: string[]
  short_description: string[]
  description: string[]
  type: string[]
  holder: string[]
  dates: string[]
  place: string[]
  dynasty: string[]
  artist: string[]
  history: string[]
  keywords: string[]
  materials: string[]
  /** The item's tags in this language. */
  tags: string[]
  partner: string[]
  country: string | null
}

export interface SearchDocument {
  id: string
  type: string
  parent_id: string | null
  backward_compatibility: string | null
  mwnf_reference: string | null
  owner_reference: string | null
  start_date: number | null
  end_date: number | null
  partner_id: string | null
  country_id: string | null
  /** The item's first picture, a `/pub` rendition; null when it has none. */
  picture: string | null
  /** The sites that show the item, its home site first: a slug and the page's route. */
  sites: { site: string; path: string }[]
  /** The languages of `texts`, sorted. */
  languages: string[]
  /** The item's tags that belong to no language. */
  tags: string[]
  texts: Record<string, Texts>
}

/**
 * The `extra` keys that describe the item. Credits, copyright, contacts,
 * links, bibliography and legacy bookkeeping are left out (ADR 005).
 */
const EXTRA_FIELDS: Record<string, keyof Texts> = {
  second_name: 'names',
  third_name: 'names',
  description2: 'short_description',
  dynasty: 'dynasty',
  artist: 'artist',
  workshop: 'artist',
  patrons: 'artist',
  architects: 'artist',
  scriber: 'artist',
  province: 'place',
  history: 'history',
  period_activity: 'dates',
  keywords: 'keywords',
  materials: 'materials',
}

/** The strings in a value: a string itself, or the strings of an array or object, depth first. */
export function stringsOf(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? [] : [trimmed]
  }
  if (Array.isArray(value)) return value.flatMap(stringsOf)
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(stringsOf)
  return []
}

function parseExtra(extra: TranslationRow['extra']): Record<string, unknown> {
  if (extra === null) return {}
  if (typeof extra === 'object') return extra
  try {
    const parsed: unknown = JSON.parse(extra)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function push(list: string[], values: string[]): void {
  for (const value of values) if (!list.includes(value)) list.push(value)
}

function emptyTexts(name: string): Texts {
  return {
    name,
    names: [],
    short_description: [],
    description: [],
    type: [],
    holder: [],
    dates: [],
    place: [],
    dynasty: [],
    artist: [],
    history: [],
    keywords: [],
    materials: [],
    tags: [],
    partner: [],
    country: null,
  }
}

/** Distinct names per (id, language), in row order. */
function namesById(rows: NameRow[]): Map<string, Map<string, string[]>> {
  const out = new Map<string, Map<string, string[]>>()
  for (const row of rows) {
    const name = row.name?.trim()
    if (!name) continue
    const byLang = out.get(row.id) ?? new Map<string, string[]>()
    const list = byLang.get(row.language) ?? []
    if (!list.includes(name)) list.push(name)
    byLang.set(row.language, list)
    out.set(row.id, byLang)
  }
  return out
}

export interface BuildInput {
  items: ItemRow[]
  translations: TranslationRow[]
  tags: TagRow[]
  partners: NameRow[]
  countries: NameRow[]
  /** Item id → `/pub` rendition path of its first picture. */
  pictures: Map<string, string>
  /** Item id → the sites that show it. */
  sites: Map<string, SiteLink[]>
  baseUrl: string
}

export interface BuildResult {
  documents: SearchDocument[]
  /** Items that no site shows, left out (Pascal, 2026-11-13). */
  excludedNoSite: number
}

/** The documents, sorted by id. An item no site shows is left out. */
export function buildDocuments(input: BuildInput): BuildResult {
  const chosen = namesByItem(input.translations)
  const partnerNames = namesById(input.partners)
  const countryNames = namesById(input.countries)

  const texts = new Map<string, Map<string, Texts>>()
  for (const row of input.translations) {
    const byLang = texts.get(row.item_id) ?? new Map<string, Texts>()
    let t = byLang.get(row.language)
    if (!t) {
      t = emptyTexts(chosen.get(row.item_id)?.[row.language] ?? '')
      byLang.set(row.language, t)
    }
    push(t.names, stringsOf(row.name))
    push(t.names, stringsOf(row.alternate_name))
    push(t.description, stringsOf(row.description))
    push(t.type, stringsOf(row.type))
    push(t.holder, [...stringsOf(row.holder), ...stringsOf(row.owner)])
    push(t.dates, stringsOf(row.dates))
    push(t.place, [...stringsOf(row.location), ...stringsOf(row.place_of_production), ...stringsOf(row.provenance)])
    const extra = parseExtra(row.extra)
    for (const [key, field] of Object.entries(EXTRA_FIELDS)) {
      push(t[field] as string[], stringsOf(extra[key]))
    }
    texts.set(row.item_id, byLang)
  }

  const commonTags = new Map<string, string[]>()
  for (const tag of input.tags) {
    const label = tag.label.trim()
    if (label === '') continue
    if (tag.language === null) {
      const list = commonTags.get(tag.item_id) ?? []
      push(list, [label])
      commonTags.set(tag.item_id, list)
      continue
    }
    const t = texts.get(tag.item_id)?.get(tag.language)
    if (t) push(t.tags, [label])
  }

  let excludedNoSite = 0
  const documents: SearchDocument[] = []
  for (const item of [...input.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    // A detail (a monument's special feature) that has no page of its own is
    // shown on its monument's page, so it opens there (Baroque Art embeds them).
    let links = input.sites.get(item.id) ?? []
    if (links.length === 0 && item.type === 'detail' && item.parent_id) links = input.sites.get(item.parent_id) ?? []
    if (links.length === 0) {
      excludedNoSite++
      continue
    }
    const byLang = texts.get(item.id) ?? new Map<string, Texts>()
    const languages = [...byLang.keys()].sort()
    const docTexts: Record<string, Texts> = {}
    for (const lang of languages) {
      const t = byLang.get(lang) as Texts
      t.names = t.names.filter(n => n !== t.name)
      if (t.name === '') t.name = t.names.shift() ?? ''
      if (item.partner_id) t.partner = partnerNames.get(item.partner_id)?.get(lang) ?? []
      if (item.country_id) t.country = countryNames.get(item.country_id)?.get(lang)?.[0] ?? null
      docTexts[lang] = t
    }
    const picture = input.pictures.get(item.id)
    documents.push({
      id: item.id,
      type: item.type,
      parent_id: item.parent_id,
      backward_compatibility: item.backward_compatibility,
      mwnf_reference: item.mwnf_reference,
      owner_reference: item.owner_reference,
      start_date: item.start_date,
      end_date: item.end_date,
      partner_id: item.partner_id,
      country_id: item.country_id,
      picture: picture ? `${input.baseUrl}/pub/${picture}` : null,
      sites: links.map(link => ({ site: link.site, path: link.path })),
      languages,
      tags: commonTags.get(item.id) ?? [],
      texts: docTexts,
    })
  }
  return { documents, excludedNoSite }
}

/** The shard of a document: the first hexadecimal digit of its id. */
export function shardOf(id: string): string {
  const first = id.charAt(0).toLowerCase()
  if (!/^[0-9a-f]$/.test(first)) throw new Error(`Item id ${JSON.stringify(id)} is not a UUID.`)
  return first
}

/** One line per document, sorted by id, each shard ending with a newline. */
export function shardDocuments(documents: SearchDocument[]): Map<string, string> {
  const shards = new Map<string, string[]>()
  for (const hex of '0123456789abcdef') shards.set(hex, [])
  for (const doc of [...documents].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    ;(shards.get(shardOf(doc.id)) as string[]).push(JSON.stringify(doc))
  }
  const out = new Map<string, string>()
  for (const [hex, lines] of shards) out.set(`documents/${hex}.ndjson`, lines.length > 0 ? lines.join('\n') + '\n' : '')
  return out
}
