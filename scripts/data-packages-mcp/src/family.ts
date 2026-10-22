import { isRec, type PackageView, type Rec } from './package-view.js'

/**
 * The package shapes the exporters publish (scripts/exporters/README.md and
 * the specs in scripts/exporters/docs/):
 * - project: islamicart, baroqueart, sharinghistory — collections.json tree
 * - explore: the same skeleton, scoped by a collection tree, `kind: explore`
 * - dxa-gallery: gallery.json site anchor + tags.json, `kind: gallery`
 * - dxa-exhibition: exhibition.json + themes.json + related_content.json, `kind: exhibition`
 * - galleries-hub: galleries.json, no items, `kind: galleries-hub`
 */
export type Family =
  'project' | 'explore' | 'dxa-gallery' | 'dxa-exhibition' | 'galleries-hub' | 'unknown'

export function detectFamily(view: PackageView): Family {
  const kind = view.manifest()?.kind
  if (kind === 'gallery') return 'dxa-gallery'
  if (kind === 'exhibition') return 'dxa-exhibition'
  if (kind === 'galleries-hub') return 'galleries-hub'
  if (kind === 'explore') return 'explore'
  // Older or future manifests without `kind`: fall back to the file set.
  if (view.has('exhibition.json') || view.has('themes.json')) return 'dxa-exhibition'
  if (view.has('gallery.json')) return 'dxa-gallery'
  if (view.has('galleries.json')) return 'galleries-hub'
  if (view.has('collections.json') && view.has('items.json')) return 'project'
  return 'unknown'
}

/** One node of a package's collection tree, whatever the family calls it. */
export interface CollectionNode {
  id: string
  backward_compatibility: string | null
  type: string
  purpose: string | null
  parent_id: string | null
  depth: number
  child_ids: string[]
  /** Direct members: items.json ids. */
  item_ids: string[]
  /** The record as the package ships it. */
  record: Rec
  /** Where the node's texts live: `translations/<entity>.<lang>.json`, or inline `names`/`titles`. */
  textSource: { entity: string } | { inline: string } | null
}

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const idsOf = (value: unknown, key = 'id'): string[] =>
  Array.isArray(value)
    ? value.flatMap(entry => (isRec(entry) && typeof entry[key] === 'string' ? [entry[key]] : []))
    : []

/** Depth-first, keeping the package's own sibling order. */
function order(nodes: Map<string, CollectionNode>, roots: string[]): CollectionNode[] {
  const out: CollectionNode[] = []
  const seen = new Set<string>()
  const visit = (id: string, depth: number) => {
    const node = nodes.get(id)
    if (!node || seen.has(id)) return
    seen.add(id)
    node.depth = depth
    out.push(node)
    for (const child of node.child_ids) visit(child, depth + 1)
  }
  for (const id of roots) visit(id, 0)
  // Anything unreachable (a cycle, a dangling parent) still shows, at depth 0.
  for (const id of nodes.keys()) visit(id, 0)
  return out
}

function fromCollectionsJson(view: PackageView): CollectionNode[] {
  const nodes = new Map<string, CollectionNode>()
  for (const record of view.records('collections')) {
    const id = str(record.id)
    if (!id) continue
    nodes.set(id, {
      id,
      backward_compatibility: str(record.backward_compatibility),
      type: str(record.type) ?? 'collection',
      purpose: str(record.purpose),
      parent_id: str(record.parent_id),
      depth: 0,
      child_ids: [],
      item_ids: idsOf(record.items),
      record,
      textSource: { entity: 'collections' },
    })
  }
  const roots: string[] = []
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined
    if (parent) parent.child_ids.push(node.id)
    else roots.push(node.id)
  }
  return order(nodes, roots)
}

function fromThemes(view: PackageView): CollectionNode[] {
  const nodes = new Map<string, CollectionNode>()
  const anchor = view.object('exhibition.json')
  const anchorId = anchor ? str(anchor.id) : null
  if (anchor && anchorId) {
    nodes.set(anchorId, {
      id: anchorId,
      backward_compatibility: str(anchor.backward_compatibility),
      type: 'exhibition',
      purpose: null,
      parent_id: null,
      depth: 0,
      child_ids: [],
      item_ids: view.records('items').flatMap(i => (typeof i.id === 'string' ? [i.id] : [])),
      record: anchor,
      textSource: { inline: 'titles' },
    })
  }
  const add = (record: Rec, parentId: string | null, type: string) => {
    const id = str(record.id)
    if (!id) return
    const pictures = Array.isArray(record.pictures) ? record.pictures.filter(isRec) : []
    const items = [
      ...new Set(
        pictures.flatMap(p => (typeof p.parent_item_id === 'string' ? [p.parent_item_id] : []))
      ),
    ]
    nodes.set(id, {
      id,
      backward_compatibility: str(record.backward_compatibility),
      type,
      purpose: null,
      parent_id: parentId,
      depth: 0,
      child_ids: [],
      item_ids: items,
      record,
      textSource: { entity: 'themes' },
    })
    if (parentId) nodes.get(parentId)?.child_ids.push(id)
    for (const sub of Array.isArray(record.sub_themes) ? record.sub_themes.filter(isRec) : []) {
      add(sub, id, 'sub_theme')
    }
  }
  for (const theme of view.records('themes')) add(theme, anchorId, 'theme')
  return order(nodes, anchorId ? [anchorId] : [...nodes.keys()])
}

function fromGallery(view: PackageView): CollectionNode[] {
  const anchor = view.object('gallery.json')
  const id = anchor ? str(anchor.id) : null
  if (!anchor || !id) return []
  return [
    {
      id,
      backward_compatibility: str(anchor.backward_compatibility),
      type: 'gallery',
      purpose: null,
      parent_id: null,
      depth: 0,
      child_ids: [],
      item_ids: view.records('items').flatMap(i => (typeof i.id === 'string' ? [i.id] : [])),
      record: anchor,
      textSource: { inline: 'names' },
    },
  ]
}

function fromHub(view: PackageView): CollectionNode[] {
  const hub = view.manifest()?.hub
  const hubId = isRec(hub) ? str(hub.id) : null
  const nodes = new Map<string, CollectionNode>()
  if (isRec(hub) && hubId) {
    nodes.set(hubId, {
      id: hubId,
      backward_compatibility: str(hub.backward_compatibility),
      type: 'galleries-hub',
      purpose: null,
      parent_id: null,
      depth: 0,
      child_ids: [],
      item_ids: [],
      record: hub,
      textSource: null,
    })
  }
  for (const gallery of view.records('galleries')) {
    const id = str(gallery.id)
    if (!id) continue
    nodes.set(id, {
      id,
      backward_compatibility: str(gallery.backward_compatibility),
      type: 'gallery',
      purpose: null,
      parent_id: hubId,
      depth: 0,
      child_ids: [],
      item_ids: [],
      record: gallery,
      textSource: { inline: 'names' },
    })
    if (hubId) nodes.get(hubId)?.child_ids.push(id)
  }
  return order(nodes, hubId ? [hubId] : [...nodes.keys()])
}

/** The collection tree of a package, in a family-independent shape. */
export function collectionTree(view: PackageView, family = detectFamily(view)): CollectionNode[] {
  switch (family) {
    case 'project':
    case 'explore':
      return fromCollectionsJson(view)
    case 'dxa-exhibition':
      return fromThemes(view)
    case 'dxa-gallery':
      return fromGallery(view)
    case 'galleries-hub':
      return fromHub(view)
    default:
      return view.has('collections.json') ? fromCollectionsJson(view) : []
  }
}

/** A node's title in `lang`, falling back to English, then to any language, then to its internal name. */
export function nodeTitle(view: PackageView, node: CollectionNode, lang: string): string | null {
  const source = node.textSource
  if (source && 'entity' in source) {
    for (const l of [lang, 'en', ...view.languagesOf(source.entity)]) {
      const title = view.translations(source.entity, l)[node.id]?.title
      if (typeof title === 'string' && title !== '') return title
    }
  } else if (source && 'inline' in source) {
    const names = node.record[source.inline]
    if (isRec(names)) {
      for (const l of [lang, 'en', ...Object.keys(names)]) {
        if (typeof names[l] === 'string' && names[l] !== '') return names[l] as string
      }
    }
  }
  return str(node.record.internal_name) ?? str(node.record.slug)
}
