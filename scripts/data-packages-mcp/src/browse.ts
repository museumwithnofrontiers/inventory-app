import { collectionTree, detectFamily, nodeTitle, type CollectionNode } from './family.js'
import { isRec, type JsonValue, type PackageView, type Rec } from './package-view.js'

export interface Page<T> {
  total: number
  page: number
  page_size: number
  pages: number
  results: T[]
}

export function paginate<T>(all: T[], page = 1, pageSize = 50): Page<T> {
  const size = Math.max(1, Math.min(pageSize, 500))
  const pages = Math.max(1, Math.ceil(all.length / size))
  const current = Math.max(1, Math.min(page, pages))
  return {
    total: all.length,
    page: current,
    page_size: size,
    pages,
    results: all.slice((current - 1) * size, current * size),
  }
}

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const lower = (value: string) => value.toLocaleLowerCase()

/**
 * A record by its inventory `id` or its legacy `backward_compatibility` key
 * (exact first, then case-insensitive: Sharing History keys are lowercase).
 */
export function findByRef(records: Rec[], ref: string, extraKeys: string[] = []): Rec | undefined {
  const keys = ['id', 'backward_compatibility', ...extraKeys]
  for (const key of keys) {
    const hit = records.find(r => r[key] === ref)
    if (hit) return hit
  }
  const wanted = lower(ref)
  return records.find(r =>
    keys.some(key => typeof r[key] === 'string' && lower(r[key] as string) === wanted)
  )
}

/** All translations of one record, by language. */
export function translationsOf(
  view: PackageView,
  entity: string,
  id: string,
  languages?: string[]
): Record<string, Rec> {
  const out: Record<string, Rec> = {}
  for (const lang of view.languagesOf(entity)) {
    if (languages && languages.length > 0 && !languages.includes(lang)) continue
    const entry = view.translations(entity, lang)[id]
    if (entry) out[lang] = entry
  }
  return out
}

/** A display name from translations (`name`, `title`, `word`…), else from the record itself. */
export function displayName(
  view: PackageView,
  entity: string,
  record: Rec,
  lang = 'en'
): string | null {
  const id = str(record.id)
  if (id) {
    for (const l of [lang, 'en', ...view.languagesOf(entity)]) {
      const entry = view.translations(entity, l)[id]
      if (!entry) continue
      for (const key of ['name', 'title', 'word']) {
        const value = entry[key]
        if (typeof value === 'string' && value !== '') return value
      }
    }
  }
  for (const key of ['internal_name', 'name', 'word', 'label', 'title', 'slug']) {
    const value = record[key]
    if (typeof value === 'string' && value !== '') return value
  }
  for (const key of ['names', 'titles']) {
    const value = record[key]
    if (isRec(value)) {
      const pick = value[lang] ?? value.en ?? Object.values(value)[0]
      if (typeof pick === 'string') return pick
    }
  }
  return null
}

/** The identity every listing leads with: inventory id + legacy key. */
function head(view: PackageView, entity: string, record: Rec, lang: string) {
  return {
    id: str(record.id),
    backward_compatibility: str(record.backward_compatibility),
    name: displayName(view, entity, record, lang),
  }
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

function treeIndex(view: PackageView) {
  const nodes = collectionTree(view)
  const byId = new Map(nodes.map(n => [n.id, n]))
  return { nodes, byId }
}

function findNode(view: PackageView, ref: string): CollectionNode | undefined {
  const { nodes } = treeIndex(view)
  const hit = findByRef(
    nodes.map(n => n.record),
    ref,
    ['slug']
  )
  return hit ? nodes.find(n => n.record === hit) : undefined
}

function descendants(byId: Map<string, CollectionNode>, node: CollectionNode): CollectionNode[] {
  const out: CollectionNode[] = []
  const stack = [...node.child_ids]
  while (stack.length) {
    const child = byId.get(stack.shift()!)
    if (!child) continue
    out.push(child)
    stack.push(...child.child_ids)
  }
  return out
}

/** Collection ids → the item ids they (and, with `deep`, their descendants) hold. */
function itemsInCollection(view: PackageView, ref: string, deep: boolean): Set<string> {
  const node = findNode(view, ref)
  if (!node) throw new Error(`No collection "${ref}" in ${view.label}`)
  const { byId } = treeIndex(view)
  const ids = new Set(node.item_ids)
  if (deep) for (const d of descendants(byId, node)) for (const id of d.item_ids) ids.add(id)
  return ids
}

export function listCollections(
  view: PackageView,
  options: {
    parent?: string
    type?: string
    text?: string
    max_depth?: number
    language?: string
    page?: number
    page_size?: number
  }
) {
  const lang = options.language ?? 'en'
  const { nodes, byId } = treeIndex(view)
  let scope = nodes
  let baseDepth = 0
  if (options.parent) {
    const parent = findNode(view, options.parent)
    if (!parent) throw new Error(`No collection "${options.parent}" in ${view.label}`)
    scope = descendants(byId, parent)
    baseDepth = parent.depth + 1
    scope = nodes.filter(n => scope.includes(n))
  }
  const text = options.text ? lower(options.text) : null
  const rows = scope
    .filter(n => options.max_depth === undefined || n.depth - baseDepth <= options.max_depth)
    .filter(n => !options.type || n.type === options.type)
    .map(n => ({
      id: n.id,
      backward_compatibility: n.backward_compatibility,
      type: n.type,
      purpose: n.purpose,
      depth: n.depth,
      parent_id: n.parent_id,
      title: nodeTitle(view, n, lang),
      children: n.child_ids.length,
      items: n.item_ids.length,
    }))
    .filter(
      r =>
        !text ||
        [r.id, r.backward_compatibility, r.title, r.purpose].some(v => v && lower(v).includes(text))
    )
  const types: Record<string, number> = {}
  for (const n of scope) types[n.type] = (types[n.type] ?? 0) + 1
  return { family: detectFamily(view), types, ...paginate(rows, options.page, options.page_size) }
}

export function getCollection(
  view: PackageView,
  ref: string,
  options: { languages?: string[]; language?: string; page?: number; page_size?: number }
) {
  const lang = options.language ?? 'en'
  const node = findNode(view, ref)
  if (!node) throw new Error(`No collection "${ref}" in ${view.label}`)
  const { byId } = treeIndex(view)
  const ancestors: { id: string; backward_compatibility: string | null; title: string | null }[] =
    []
  for (
    let p = node.parent_id ? byId.get(node.parent_id) : undefined;
    p;
    p = p.parent_id ? byId.get(p.parent_id) : undefined
  ) {
    ancestors.unshift({
      id: p.id,
      backward_compatibility: p.backward_compatibility,
      title: nodeTitle(view, p, lang),
    })
    if (ancestors.length > 50) break
  }
  const items = new Map(view.records('items').map(i => [i.id as string, i]))
  const record: Rec = { ...node.record }
  // The member list is paged below rather than dumped with the record.
  delete record.items
  const translations =
    node.textSource && 'entity' in node.textSource
      ? translationsOf(view, node.textSource.entity, node.id, options.languages)
      : {}
  if (node.textSource && 'entity' in node.textSource && node.textSource.entity === 'themes') {
    // Exhibition themes key their per-picture texts `<theme id>/<picture item id>`.
    for (const lang of view.languagesOf('themes')) {
      if (options.languages?.length && !options.languages.includes(lang)) continue
      for (const [key, entry] of Object.entries(view.translations('themes', lang))) {
        if (!key.startsWith(`${node.id}/`)) continue
        const bucket = (translations[`${lang}:pictures`] ??= {}) as Rec
        bucket[key.slice(node.id.length + 1)] = entry as JsonValue
      }
    }
  }
  const memberRows = node.item_ids.map(id => {
    const item = items.get(id)
    return item
      ? { ...head(view, 'items', item, lang), type: str(item.type) }
      : { id, backward_compatibility: null, name: null, type: null, missing_from_items_json: true }
  })
  return {
    family: detectFamily(view),
    collection: {
      id: node.id,
      backward_compatibility: node.backward_compatibility,
      type: node.type,
      purpose: node.purpose,
      title: nodeTitle(view, node, lang),
    },
    ancestors,
    children: node.child_ids.map(id => {
      const child = byId.get(id)!
      return {
        id,
        backward_compatibility: child.backward_compatibility,
        type: child.type,
        title: nodeTitle(view, child, lang),
        items: child.item_ids.length,
      }
    }),
    record,
    translations,
    members: paginate(memberRows, options.page, options.page_size),
  }
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface ItemFilters {
  type?: string
  collection?: string
  include_sub_collections?: boolean
  partner?: string
  country?: string
  has_images?: boolean
  text?: string
  language?: string
  tag?: string
  page?: number
  page_size?: number
}

function tagLabels(item: Rec, tags: Map<string, Rec>): string[] {
  const flat = Array.isArray(item.tags)
    ? item.tags.filter((t): t is string => typeof t === 'string')
    : []
  const viaIds = Array.isArray(item.tag_ids)
    ? item.tag_ids.flatMap(id => {
        const tag = typeof id === 'string' ? tags.get(id) : undefined
        return tag && typeof tag.label === 'string' ? [tag.label] : []
      })
    : []
  return [...flat, ...viaIds]
}

export function listItems(view: PackageView, filters: ItemFilters) {
  const lang = filters.language ?? 'en'
  let items = view.records('items')
  if (filters.type) items = items.filter(i => i.type === filters.type)
  if (filters.collection) {
    const ids = itemsInCollection(view, filters.collection, filters.include_sub_collections ?? true)
    items = items.filter(i => typeof i.id === 'string' && ids.has(i.id))
  }
  if (filters.partner) {
    const partner = findByRef(view.records('partners'), filters.partner)
    const partnerId = partner ? partner.id : filters.partner
    items = items.filter(i => i.partner_id === partnerId)
  }
  if (filters.country) {
    const country = lower(filters.country)
    items = items.filter(i => typeof i.country_id === 'string' && lower(i.country_id) === country)
  }
  if (filters.has_images !== undefined) {
    items = items.filter(
      i => (Array.isArray(i.images) && i.images.length > 0) === filters.has_images
    )
  }
  if (filters.language) {
    const translated = view.translations('items', filters.language)
    items = items.filter(i => typeof i.id === 'string' && translated[i.id] !== undefined)
  }
  const tags = new Map(view.records('tags').map(t => [t.id as string, t]))
  if (filters.tag) {
    const wanted = lower(filters.tag)
    items = items.filter(i => tagLabels(i, tags).some(t => lower(t) === wanted))
  }
  if (filters.text) {
    const text = lower(filters.text)
    const languages = filters.language ? [filters.language] : view.languagesOf('items')
    const maps = languages.map(l => view.translations('items', l))
    items = items.filter(i => {
      const own = [
        'id',
        'backward_compatibility',
        'internal_name',
        'mwnf_reference',
        'owner_reference',
      ]
        .map(k => i[k])
        .some(v => typeof v === 'string' && lower(v).includes(text))
      if (own) return true
      const id = i.id as string
      return maps.some(m => {
        const t = m[id]
        return (
          t !== undefined &&
          ['name', 'alternate_name'].some(
            k => typeof t[k] === 'string' && lower(t[k] as string).includes(text)
          )
        )
      })
    })
  }
  const types: Record<string, number> = {}
  for (const i of items) types[String(i.type)] = (types[String(i.type)] ?? 0) + 1
  const rows = items.map(i => ({
    ...head(view, 'items', i, lang),
    type: str(i.type),
    partner_id: str(i.partner_id),
    country_id: str(i.country_id),
    images: Array.isArray(i.images) ? i.images.length : 0,
    languages: Array.isArray(i.languages) ? i.languages : [],
  }))
  return { family: detectFamily(view), types, ...paginate(rows, filters.page, filters.page_size) }
}

export function getItem(
  view: PackageView,
  ref: string,
  options: { languages?: string[]; language?: string }
) {
  const lang = options.language ?? 'en'
  const items = view.records('items')
  const item = findByRef(items, ref)
  if (!item)
    throw new Error(
      `No item "${ref}" in ${view.label} (looked up by id and backward_compatibility)`
    )
  const id = item.id as string
  const translations = translationsOf(view, 'items', id, options.languages)
  const declared = Array.isArray(item.languages)
    ? item.languages.filter((l): l is string => typeof l === 'string')
    : []
  const actual = view
    .languagesOf('items')
    .filter(l => view.translations('items', l)[id] !== undefined)

  const partner =
    typeof item.partner_id === 'string'
      ? findByRef(view.records('partners'), item.partner_id)
      : undefined
  const projects = view.manifest()?.projects
  const project =
    isRec(projects) && typeof item.project_id === 'string' ? projects[item.project_id] : undefined
  const tags = new Map(view.records('tags').map(t => [t.id as string, t]))
  const dynasties = new Map(view.records('dynasties').map(d => [d.id as string, d]))
  const glossary = new Map(view.records('glossary').map(g => [g.id as string, g]))
  const parent = typeof item.parent_id === 'string' ? findByRef(items, item.parent_id) : undefined
  const children = items.filter(i => i.parent_id === id)
  const collections = collectionTree(view)
    .filter(n => n.item_ids.includes(id) && n.type !== 'gallery' && n.type !== 'exhibition')
    .map(n => ({
      id: n.id,
      backward_compatibility: n.backward_compatibility,
      type: n.type,
      title: nodeTitle(view, n, lang),
    }))
  const ids = (value: JsonValue | undefined) =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

  return {
    family: detectFamily(view),
    id,
    backward_compatibility: str(item.backward_compatibility),
    name: displayName(view, 'items', item, lang),
    item,
    translations,
    language_check: {
      declared,
      translated: actual,
      declared_but_missing: declared.filter(l => !actual.includes(l)),
      translated_but_undeclared: actual.filter(l => !declared.includes(l)),
    },
    resolved: {
      partner: partner
        ? head(view, 'partners', partner, lang)
        : item.partner_id
          ? { id: item.partner_id, missing_from_partners_json: true }
          : null,
      country:
        typeof item.country_id === 'string'
          ? (view.translations('countries', lang)[item.country_id]?.name ?? item.country_id)
          : null,
      project: isRec(project)
        ? {
            id: item.project_id,
            name: isRec(project.name) ? (project.name[lang] ?? project.name.en ?? null) : null,
          }
        : null,
      parent: parent ? head(view, 'items', parent, lang) : null,
      children: children.map(c => ({ ...head(view, 'items', c, lang), type: str(c.type) })),
      collections,
      tags: ids(item.tag_ids).map(t => {
        const tag = tags.get(t)
        return tag
          ? { id: t, category: tag.category ?? null, label: tag.label ?? null }
          : { id: t, missing_from_tags_json: true }
      }),
      dynasties: ids(item.dynasty_ids).map(d => {
        const dyn = dynasties.get(d)
        return dyn
          ? { id: d, name: displayName(view, 'dynasties', dyn, lang) }
          : { id: d, missing_from_dynasties_json: true }
      }),
      glossary: ids(item.glossary_ids).map(g => {
        const entry = glossary.get(g)
        return entry
          ? { id: g, word: entry.word ?? null }
          : { id: g, missing_from_glossary_json: true }
      }),
      related_items: (Array.isArray(item.related_items)
        ? item.related_items.filter(isRec)
        : []
      ).map(r => {
        const target = typeof r.id === 'string' ? findByRef(items, r.id) : undefined
        return {
          id: r.id ?? null,
          in_package: target !== undefined,
          ...(target ? { name: displayName(view, 'items', target, lang) } : {}),
        }
      }),
    },
  }
}

// ---------------------------------------------------------------------------
// Partners, glossary, timelines, any record
// ---------------------------------------------------------------------------

export function listPartners(
  view: PackageView,
  options: {
    text?: string
    type?: string
    country?: string
    language?: string
    page?: number
    page_size?: number
  }
) {
  const lang = options.language ?? 'en'
  const counts = new Map<string, number>()
  for (const i of view.records('items')) {
    if (typeof i.partner_id === 'string')
      counts.set(i.partner_id, (counts.get(i.partner_id) ?? 0) + 1)
  }
  const text = options.text ? lower(options.text) : null
  const rows = view
    .records('partners')
    .filter(p => !options.type || p.type === options.type)
    .filter(
      p =>
        !options.country ||
        (typeof p.country_id === 'string' && lower(p.country_id) === lower(options.country))
    )
    .map(p => ({
      ...head(view, 'partners', p, lang),
      type: str(p.type),
      level: str(p.level),
      country_id: str(p.country_id),
      item_count: typeof p.item_count === 'number' ? p.item_count : null,
      items_in_package: counts.get(p.id as string) ?? 0,
    }))
    .filter(
      r => !text || [r.id, r.backward_compatibility, r.name].some(v => v && lower(v).includes(text))
    )
  return paginate(rows, options.page, options.page_size)
}

export function getPartner(
  view: PackageView,
  ref: string,
  options: { languages?: string[]; language?: string }
) {
  const lang = options.language ?? 'en'
  const partner = findByRef(view.records('partners'), ref)
  if (!partner) throw new Error(`No partner "${ref}" in ${view.label}`)
  const id = partner.id as string
  const items = view.records('items').filter(i => i.partner_id === id)
  const partners = view.records('partners')
  const parent =
    typeof partner.parent_id === 'string' ? findByRef(partners, partner.parent_id) : undefined
  return {
    id,
    backward_compatibility: str(partner.backward_compatibility),
    name: displayName(view, 'partners', partner, lang),
    partner,
    translations: translationsOf(view, 'partners', id, options.languages),
    resolved: {
      parent: parent ? head(view, 'partners', parent, lang) : null,
      children: partners.filter(p => p.parent_id === id).map(p => head(view, 'partners', p, lang)),
      items_in_package: items.length,
      item_count_matches:
        typeof partner.item_count === 'number' ? partner.item_count === items.length : null,
      sample_items: items
        .slice(0, 20)
        .map(i => ({ ...head(view, 'items', i, lang), type: str(i.type) })),
    },
  }
}

export function listGlossary(
  view: PackageView,
  options: { text?: string; language?: string; page?: number; page_size?: number }
) {
  const lang = options.language ?? 'en'
  const translated = view.translations('glossary', lang)
  const text = options.text ? lower(options.text) : null
  const rows = view
    .records('glossary')
    .map(g => {
      const t = translated[g.id as string]
      return {
        id: str(g.id),
        word: str(g.word),
        spellings: Array.isArray(t?.spellings) ? t.spellings : [],
        has_definition: typeof t?.definition === 'string' && t.definition !== '',
      }
    })
    .filter(
      r =>
        !text ||
        [r.id, r.word].some(v => v && lower(v).includes(text)) ||
        r.spellings.some(s => typeof s === 'string' && lower(s).includes(text))
    )
  return { language: lang, ...paginate(rows, options.page, options.page_size) }
}

export function getGlossary(
  view: PackageView,
  ref: string,
  options: { languages?: string[]; language?: string }
) {
  const records = view.records('glossary')
  const entry = findByRef(records, ref, ['word'])
  if (!entry) throw new Error(`No glossary entry "${ref}" in ${view.label}`)
  const id = entry.id as string
  const items = view
    .records('items')
    .filter(i => Array.isArray(i.glossary_ids) && i.glossary_ids.includes(id))
  return {
    id,
    word: str(entry.word),
    entry,
    translations: translationsOf(view, 'glossary', id, options.languages),
    used_by_items: items.length,
    sample_items: items.slice(0, 20).map(i => head(view, 'items', i, options.language ?? 'en')),
  }
}

export function listTimelines(view: PackageView) {
  const events = view.records('timeline_events')
  const counts = new Map<string, number>()
  for (const e of events)
    if (typeof e.timeline_id === 'string')
      counts.set(e.timeline_id, (counts.get(e.timeline_id) ?? 0) + 1)
  const known = new Set(view.records('timelines').map(t => t.id))
  return {
    timelines: view.records('timelines').map(t => ({
      id: str(t.id),
      backward_compatibility: str(t.backward_compatibility),
      internal_name: str(t.internal_name),
      country_id: str(t.country_id),
      collection_id: str(t.collection_id),
      events: counts.get(t.id as string) ?? 0,
    })),
    orphan_events: events.filter(e => !known.has(e.timeline_id)).length,
  }
}

export function getTimeline(
  view: PackageView,
  ref: string,
  options: { language?: string; page?: number; page_size?: number }
) {
  const lang = options.language ?? 'en'
  const timeline = findByRef(view.records('timelines'), ref)
  if (!timeline) throw new Error(`No timeline "${ref}" in ${view.label}`)
  const translated = view.translations('timeline_events', lang)
  const events = view
    .records('timeline_events')
    .filter(e => e.timeline_id === timeline.id)
    .map(e => ({ ...e, text: translated[e.id as string] ?? null }))
  return { timeline, language: lang, events: paginate(events, options.page, options.page_size) }
}

/** Any record of any entity file, merged with its translations: dynasties, tags, themes, galleries… */
export function getRecord(
  view: PackageView,
  file: string,
  ref: string,
  options: { languages?: string[] }
) {
  const entity = file.replace(/\.json$/, '')
  if (!view.has(`${entity}.json`)) throw new Error(`${view.label} has no ${entity}.json`)
  const data = view.json(`${entity}.json`)
  let records: Rec[]
  if (Array.isArray(data)) {
    records = data.filter(isRec)
  } else if (isRec(data)) {
    records = [data]
  } else {
    throw new Error(`${entity}.json is not a record file`)
  }
  const flat: Rec[] = []
  const walk = (list: Rec[]) => {
    for (const r of list) {
      flat.push(r)
      if (Array.isArray(r.sub_themes)) walk(r.sub_themes.filter(isRec))
    }
  }
  walk(records)
  const record = findByRef(flat, ref, ['legacy_id', 'slug', 'word', 'label'])
  if (!record) throw new Error(`No record "${ref}" in ${entity}.json`)
  const id = str(record.id) ?? str(record.legacy_id)
  return {
    file: `${entity}.json`,
    id,
    backward_compatibility: str(record.backward_compatibility),
    record,
    translations: id ? translationsOf(view, entity, id, options.languages) : {},
  }
}
