/**
 * Is a collection site's package ready to make a website from? Each check
 * asks the package for something an exhibition website needs, using the
 * model's own facts only (inventory-app#2727): no legacy key, no legacy rule.
 *
 * A finding is `error` (a page can't be built without it), `warning` (a page
 * is built but visibly lacks something) or `info` (worth knowing).
 */

export type Severity = 'error' | 'warning' | 'info'

export interface Finding {
  code: string
  severity: Severity
  message: string
  ids: string[]
}

export interface Readiness {
  languages: string[]
  counts: Record<string, number>
  textContexts: Record<string, number>
  findings: Finding[]
}

type Rec = Record<string, unknown> & { id: string }
type Texts = Record<string, Record<string, Record<string, unknown>>>

/** The package as the checks read it: entity arrays and texts by entity and language. */
export interface PackageData {
  manifest: Record<string, unknown>
  collections: Rec[]
  placements: Rec[]
  items: Rec[]
  partners: Rec[]
  timelines: Rec[]
  timeline_events: Rec[]
  texts: Record<string, Texts>
}

const has = (v: unknown) => v !== null && v !== undefined && v !== ''

/**
 * `siteLanguages` are the language builds the site offers (its own choice);
 * without them, the languages the root collection has a title in.
 */
export function checkReadiness(pkg: PackageData, siteLanguages?: string[]): Readiness {
  const grouped = new Map<string, Finding>()
  const add = (code: string, severity: Severity, message: string, ids: string[]) => {
    if (ids.length === 0) return
    const key = `${code}\u0000${message}`
    const finding = grouped.get(key) ?? { code, severity, message, ids: [] }
    finding.ids.push(...ids)
    grouped.set(key, finding)
  }
  const text = (entity: string, language: string, id: string) => pkg.texts[entity]?.[language]?.[id]
  const rootId = String(pkg.manifest['root_collection_id'])
  const root = pkg.collections.find(c => c.id === rootId)

  const titled = Object.keys(pkg.texts['collections'] ?? {})
    .filter(language => has(text('collections', language, rootId)?.['title']))
    .sort()
  const languages = siteLanguages && siteLanguages.length > 0 ? [...siteLanguages].sort() : titled
  if (!root) add('ROOT_MISSING', 'error', 'the root collection is not in the package', [rootId])
  for (const language of languages) {
    if (!titled.includes(language)) add('ROOT_TITLE', 'error', `the root collection has no title in ${language}`, [rootId])
  }
  if (languages.length === 0) add('ROOT_TITLE', 'error', 'the root collection has no title in any language', [rootId])

  // --- The root and the tree ---------------------------------------------------------------
  for (const language of languages) {
    const t = text('collections', language, rootId)
    if (!has(t?.['description']) && !has(t?.['introduction'])) {
      add('ROOT_TEXT', 'warning', `the root has no description or introduction in ${language}`, [rootId])
    }
  }
  if (root && !has(root['cover_item_id'])) add('ROOT_COVER', 'warning', 'the root has no cover item', [rootId])

  const children = new Map<string, Rec[]>()
  for (const c of pkg.collections) {
    if (typeof c['parent_id'] === 'string') {
      const list = children.get(c['parent_id']) ?? []
      list.push(c)
      children.set(c['parent_id'], list)
    }
  }
  const placementsBy = new Map<string, Rec[]>()
  for (const p of pkg.placements) {
    const list = placementsBy.get(String(p['collection_id'])) ?? []
    list.push(p)
    placementsBy.set(String(p['collection_id']), list)
  }
  const unordered = (rows: Rec[]) => {
    const orders = rows.map(r => r['display_order'])
    const dup = orders.filter((o, i) => has(o) && orders.indexOf(o) !== i)
    return rows.filter(r => !has(r['display_order']) || dup.includes(r['display_order'])).map(r => r.id)
  }

  for (const c of pkg.collections) {
    if (c.id === rootId) continue
    for (const language of languages) {
      const t = text('collections', language, c.id)
      if (!has(t?.['title'])) add('COLLECTION_TITLE', 'error', `collections without a title in ${language}`, [c.id])
      else if (!has(t?.['description']) && !has(t?.['introduction']) && !has(t?.['quote'])) {
        add('COLLECTION_TEXT', 'warning', `collections with a title but no text in ${language}`, [c.id])
      }
    }
    if (!(children.get(c.id)?.length) && !(placementsBy.get(c.id)?.length)) {
      add('COLLECTION_EMPTY', 'warning', 'collections with no placement and no sub-collection', [c.id])
    }
    if (!has(c['cover_item_id'])) add('COLLECTION_COVER', 'info', 'collections without a cover item', [c.id])
  }
  for (const list of children.values()) {
    add('COLLECTION_ORDER', 'error', 'sibling collections with no order, or the same order as another', unordered(list))
  }
  for (const [collectionId, list] of placementsBy) {
    if (list.every(p => !has(p['display_order']))) {
      add('PLACEMENT_UNORDERED', 'info', 'collections whose placements carry no order at all (an unordered set)', [collectionId])
    } else {
      add('PLACEMENT_ORDER', 'error', 'placements with no order, or the same order as another, where their siblings are ordered', unordered(list))
    }
  }

  // --- Items ------------------------------------------------------------------------------
  const itemById = new Map(pkg.items.map(i => [i.id, i]))
  const descendants = new Map<string, Rec[]>()
  for (const i of pkg.items) {
    let parent = typeof i['parent_id'] === 'string' ? itemById.get(i['parent_id']) : undefined
    while (parent) {
      const list = descendants.get(parent.id) ?? []
      list.push(i)
      descendants.set(parent.id, list)
      parent = typeof parent['parent_id'] === 'string' ? itemById.get(parent['parent_id']) : undefined
    }
  }
  const imagesOf = (i: Rec) => (Array.isArray(i['images']) ? i['images'].length : 0)
  const anyImage = (i: Rec) => imagesOf(i) > 0 || (descendants.get(i.id) ?? []).some(d => imagesOf(d) > 0)

  for (const p of pkg.placements) {
    const placed = itemById.get(String(p['item_id']))
    if (!placed || !anyImage(placed)) add('PLACEMENT_IMAGE', 'error', 'placements whose item has no image', [p.id])
  }

  const members = pkg.items.filter(i => i['member'] === true)
  const textContexts: Record<string, number> = {}
  const siteContext = pkg.manifest['context_id']
  const defaultContext = pkg.manifest['default_context_id']
  for (const m of members) {
    for (const language of languages) {
      const t = text('items', language, m.id)
      if (!t) {
        add('ITEM_TEXT', 'error', `members with no text in ${language} in the site's, their Project's or the Default Context`, [m.id])
        continue
      }
      if (!has(t['name'])) add('ITEM_NAME', 'error', `member texts without a name in ${language}`, [m.id])
      if (!has(t['description'])) add('ITEM_DESCRIPTION', 'warning', `member texts without a description in ${language}`, [m.id])
      const from = t['context_id'] === siteContext ? 'site' : t['context_id'] === defaultContext ? 'default' : 'project'
      textContexts[from] = (textContexts[from] ?? 0) + 1
    }
    if (!anyImage(m)) add('ITEM_IMAGE', 'error', 'members with no image of their own or of their pictures', [m.id])
    if (!has(m['partner_id'])) add('ITEM_HOLDER', 'warning', 'members with no holding partner', [m.id])
    if (!has(m['project_id'])) add('ITEM_PROJECT', 'warning', 'members with no Project (no copyright owner, no text fallback)', [m.id])
    if (!has(m['start_date']) && !has(m['end_date'])) add('ITEM_DATES', 'info', 'members with no start or end date', [m.id])
    if (!has(m['country_id'])) add('ITEM_COUNTRY', 'info', 'members with no country', [m.id])
  }

  // --- Partners -----------------------------------------------------------------------------
  for (const p of pkg.partners) {
    for (const language of languages) {
      if (!has(text('partners', language, p.id)?.['name'])) add('PARTNER_NAME', 'error', `partners without a name in ${language}`, [p.id])
    }
    if (!has(p['country_id'])) add('PARTNER_COUNTRY', 'info', 'partners with no country', [p.id])
  }

  // --- Timelines -------------------------------------------------------------------------------
  for (const e of pkg.timeline_events) {
    if (!has(e['year_from'])) add('EVENT_YEAR', 'error', 'timeline events with no start year', [e.id])
    for (const language of languages) {
      const t = text('timeline_events', language, e.id)
      if (!has(t?.['name']) && !has(t?.['description'])) add('EVENT_TEXT', 'warning', `timeline events with no text in ${language}`, [e.id])
    }
  }

  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 }
  const findings = [...grouped.values()].map(f => ({ ...f, ids: [...new Set(f.ids)].sort() }))
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.code.localeCompare(b.code) || a.message.localeCompare(b.message))
  return {
    languages,
    counts: {
      collections: pkg.collections.length,
      placements: pkg.placements.length,
      members: members.length,
      partners: pkg.partners.length,
      timeline_events: pkg.timeline_events.length,
    },
    textContexts,
    findings,
  }
}
