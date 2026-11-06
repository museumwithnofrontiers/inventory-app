import type { Database } from '../core/database.js'
import type { ExhibitionSite } from '../core/instance.js'

/**
 * Legacy's "On display in → Exhibition(s)" on the galleries' item sheet
 * (dxa-api `DAO/v2/{MWNF3,SH}/Objects.php` and `Monuments.php`, drawn by
 * dxa-client `DatabaseItem.vue`), as references to the pages of our sites
 * that show the item. Legacy filled it from three lists:
 *
 * - `virtual`: Discover Islamic Art's and Discover Baroque Art's virtual
 *   exhibitions (`ObjectsExhibitionLinks`), one line per exhibition, on the
 *   first page that places the item (lowest page id). The pages are our
 *   mini-sites' `/exhibition/<theme>/<page>`.
 * - `sharing_history`: Sharing History's exhibitions, every theme and
 *   subtheme whose curator kept the item (`curator_status` 'Y'). The pages
 *   are the mini-sites' `/theme/<theme>[/<subtheme>]`.
 * - `exhibition`: the online exhibitions (`ItemInOtherExhibitions`), every
 *   sub-theme placing one of the item's pictures, outside the About theme.
 *   The pages are the exhibition sites' `/theme/<theme>/<subtheme>/<picture>`.
 *
 * Only exhibitions that have a site of ours are listed, as for the galleries.
 * Titles ship in every language the inventory has; which language a line
 * prints is the site's rule, legacy's being per list.
 */
export interface ExhibitionReference {
  list: 'virtual' | 'sharing_history' | 'exhibition'
  /** The slug of the site showing the page, a sibling of the gallery's address. */
  site: string
  /** The page's route on that site. */
  path: string
  /** The exhibition's project, which legacy named above a mini-site's lines. */
  project: { id: string; name: string } | null
  exhibition: Titled
  theme: Titled
  subtheme: Titled | null
  /**
   * Legacy's order inside its list: the exhibition's id for `virtual`; the
   * theme's id, the theme before its subthemes, and the subtheme's id for
   * `sharing_history`; the theme item's id for `exhibition`, which legacy
   * sorted after the exhibition's title.
   */
  legacy_order: number[]
}

interface Titled {
  id: string
  titles: Record<string, string>
}

interface VirtualRow {
  item_id: string
  root_id: string
  theme_id: string
  theme_order: number | null
  page_bc: string | null
  page_order: number | null
}

interface SharingHistoryRow {
  item_id: string
  collection_id: string
}

interface TreeRow {
  id: string
  parent_id: string
  type: string
  display_order: number | null
  backward_compatibility: string | null
  titled_en: number | string
}

interface ExhibitionRow {
  item_id: string
  root_id: string
  theme_id: string
  theme_bc: string | null
  theme_order: number | null
  subtheme_id: string
  subtheme_order: number | null
  picture_order: number | null
  extra: unknown
}

interface TitleRow {
  collection_id: string
  language_id: string
  title: string | null
}

interface RootRow {
  id: string
  backward_compatibility: string | null
}

const VIRTUAL_ROOT = 'mwnf3:exhibitions:'
const SHARING_HISTORY_ROOT = 'mwnf3_sharing_history:sh_exhibitions:'

/** The numeric id a legacy key ends with (`mwnf3:exhibition_pages:264` → 264). */
function lastId(bc: string | null | undefined): number {
  const n = Number((bc ?? '').split(':').pop())
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

/** The theme item id in `mwnf3_thematic_gallery:theme_item_i18n:<gallery>:<theme>:<item>:<lang>`. */
function themeItemId(extra: unknown): number {
  const parsed = parseJson<{ source_bc_by_language?: Record<string, string> }>(extra)
  const keys = Object.values(parsed?.source_bc_by_language ?? {})
  const parts = (keys.sort()[0] ?? '').split(':')
  const n = Number(parts[4])
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

export async function buildExhibitionReferences(
  db: Database,
  memberItemIds: string[],
  sites: ReadonlyMap<string, ExhibitionSite>,
  langCodeMap: Map<string, string>,
  placeholders: (count: number) => string
): Promise<Map<string, ExhibitionReference[]>> {
  const result = new Map<string, ExhibitionReference[]>()
  if (memberItemIds.length === 0 || sites.size === 0) return result

  const siteRootIds = [...sites.keys()].sort()
  const roots = await db.query<RootRow>(
    `SELECT id, backward_compatibility FROM collections WHERE id IN (${placeholders(siteRootIds.length)}) ORDER BY id`,
    siteRootIds
  )
  const virtualRoots = roots
    .filter(r => sites.get(r.id)?.kind === 'minisite' && r.backward_compatibility?.startsWith(VIRTUAL_ROOT))
    .map(r => r.id)
  const sharingHistoryRoots = roots
    .filter(r => sites.get(r.id)?.kind === 'minisite' && r.backward_compatibility?.startsWith(SHARING_HISTORY_ROOT))
    .map(r => r.id)
  const exhibitionRoots = roots.filter(r => sites.get(r.id)?.kind === 'exhibition').map(r => r.id)

  const memberPh = placeholders(memberItemIds.length)
  const [virtualRows, sharingHistoryRows, sharingHistoryTree, exhibitionRows] = await Promise.all([
    virtualRoots.length === 0
      ? Promise.resolve([] as VirtualRow[])
      : db.query<VirtualRow>(
          // A placement links the picture of the item legacy showed, or the
          // item itself when it showed none of its pictures.
          `SELECT CASE WHEN i.type = 'picture' AND i.parent_id IN (${memberPh}) THEN i.parent_id ELSE i.id END AS item_id,
                  th.parent_id AS root_id, th.id AS theme_id, th.display_order AS theme_order,
                  pg.backward_compatibility AS page_bc, pg.display_order AS page_order
           FROM collection_item ci
           JOIN items i ON i.id = ci.item_id
           JOIN collections pg ON pg.id = ci.collection_id
           JOIN collections th ON th.id = pg.parent_id
           WHERE th.parent_id IN (${placeholders(virtualRoots.length)})
             AND (ci.item_id IN (${memberPh}) OR (i.type = 'picture' AND i.parent_id IN (${memberPh})))
           ORDER BY item_id, root_id, pg.backward_compatibility`,
          [...memberItemIds, ...virtualRoots, ...memberItemIds, ...memberItemIds]
        ),
    sharingHistoryRoots.length === 0
      ? Promise.resolve([] as SharingHistoryRow[])
      : db.query<SharingHistoryRow>(
          `SELECT ci.item_id, ci.collection_id
           FROM collection_item ci
           JOIN collections c ON c.id = ci.collection_id
           LEFT JOIN collections p ON p.id = c.parent_id
           WHERE ci.item_id IN (${memberPh})
             AND c.type IN ('theme', 'subtheme')
             AND JSON_UNQUOTE(JSON_EXTRACT(ci.extra, '$.curator_status')) = 'Y'
             AND (c.parent_id IN (${placeholders(sharingHistoryRoots.length)})
                  OR p.parent_id IN (${placeholders(sharingHistoryRoots.length)}))
           ORDER BY ci.item_id, ci.collection_id`,
          [...memberItemIds, ...sharingHistoryRoots, ...sharingHistoryRoots]
        ),
    sharingHistoryRoots.length === 0
      ? Promise.resolve([] as TreeRow[])
      : db.query<TreeRow>(
          // The mini-site numbers its themes and subthemes among those with
          // an English title, the language its addresses are built in.
          `SELECT c.id, c.parent_id, c.type, c.display_order, c.backward_compatibility,
                  EXISTS (SELECT 1 FROM collection_translations t
                          WHERE t.collection_id = c.id AND t.language_id = 'eng'
                            AND TRIM(COALESCE(t.title, '')) <> '') AS titled_en
           FROM collections c
           LEFT JOIN collections p ON p.id = c.parent_id
           WHERE c.type IN ('theme', 'subtheme')
             AND (c.parent_id IN (${placeholders(sharingHistoryRoots.length)})
                  OR p.parent_id IN (${placeholders(sharingHistoryRoots.length)}))
           ORDER BY c.parent_id, c.display_order, c.backward_compatibility`,
          [...sharingHistoryRoots, ...sharingHistoryRoots]
        ),
    exhibitionRoots.length === 0
      ? Promise.resolve([] as ExhibitionRow[])
      : db.query<ExhibitionRow>(
          `SELECT pic.parent_id AS item_id, pt.parent_id AS root_id,
                  pt.id AS theme_id, pt.backward_compatibility AS theme_bc, pt.display_order AS theme_order,
                  st.id AS subtheme_id, st.display_order AS subtheme_order,
                  ci.display_order AS picture_order, ci.extra
           FROM collection_item ci
           JOIN items pic ON pic.id = ci.item_id AND pic.type = 'picture'
           JOIN collections st ON st.id = ci.collection_id
           JOIN collections pt ON pt.id = st.parent_id AND pt.type = 'theme'
           WHERE pt.parent_id IN (${placeholders(exhibitionRoots.length)})
             AND pic.parent_id IN (${memberPh})
           ORDER BY item_id, root_id, pt.display_order, st.display_order, ci.display_order`,
          [...exhibitionRoots, ...memberItemIds]
        ),
  ])

  const titledIds = new Set<string>()
  for (const row of virtualRows) titledIds.add(row.root_id).add(row.theme_id)
  for (const row of sharingHistoryTree) titledIds.add(row.id).add(row.parent_id)
  for (const row of exhibitionRows) titledIds.add(row.root_id).add(row.theme_id).add(row.subtheme_id)
  const titleIds = [...titledIds].sort()
  const titleRows =
    titleIds.length === 0
      ? []
      : await db.query<TitleRow>(
          `SELECT collection_id, language_id, title FROM collection_translations
           WHERE collection_id IN (${placeholders(titleIds.length)})
           ORDER BY collection_id, language_id`,
          titleIds
        )
  const titles = new Map<string, Record<string, string>>()
  for (const row of titleRows) {
    const code = langCodeMap.get(row.language_id)
    if (!code || !row.title?.trim()) continue
    const bucket = titles.get(row.collection_id) ?? {}
    bucket[code] = row.title
    titles.set(row.collection_id, bucket)
  }
  const titled = (id: string): Titled => ({ id, titles: titles.get(id) ?? {} })

  const projectIds = [...new Set([...sites.values()].map(s => s.projectId).filter((id): id is string => !!id))].sort()
  const projectRows =
    projectIds.length === 0
      ? []
      : await db.query<{ id: string; internal_name: string }>(
          `SELECT id, internal_name FROM projects WHERE id IN (${placeholders(projectIds.length)}) ORDER BY id`,
          projectIds
        )
  const projectNames = new Map(projectRows.map(r => [r.id, r.internal_name]))
  const projectOf = (rootId: string) => {
    const id = sites.get(rootId)?.projectId
    return id && projectNames.has(id) ? { id, name: projectNames.get(id)! } : null
  }

  const push = (itemId: string, entry: ExhibitionReference) => {
    const bucket = result.get(itemId)
    if (bucket) bucket.push(entry)
    else result.set(itemId, [entry])
  }

  // Virtual exhibitions: the first page of each exhibition placing the item.
  const firstPage = new Map<string, VirtualRow>()
  for (const row of virtualRows) {
    const key = `${row.item_id} ${row.root_id}`
    const seen = firstPage.get(key)
    if (!seen || lastId(row.page_bc) < lastId(seen.page_bc)) firstPage.set(key, row)
  }
  const rootBc = new Map(roots.map(r => [r.id, r.backward_compatibility]))
  for (const row of firstPage.values()) {
    if (row.theme_order === null || row.page_order === null) continue
    push(row.item_id, {
      list: 'virtual',
      site: sites.get(row.root_id)!.slug,
      path: `/exhibition/${row.theme_order}/${row.page_order}`,
      project: projectOf(row.root_id),
      exhibition: titled(row.root_id),
      theme: titled(row.theme_id),
      subtheme: null,
      legacy_order: [lastId(rootBc.get(row.root_id))],
    })
  }

  // Sharing History: each theme and subtheme, numbered as the mini-site does.
  const node = new Map(sharingHistoryTree.map(row => [row.id, row]))
  const position = new Map<string, number>()
  const listed = new Map<string, TreeRow[]>()
  for (const row of sharingHistoryTree) {
    if (!(row.titled_en === 1 || row.titled_en === '1')) continue
    const bucket = listed.get(row.parent_id) ?? []
    bucket.push(row)
    listed.set(row.parent_id, bucket)
  }
  for (const [parentId, rows] of listed) {
    const wanted = sharingHistoryRoots.includes(parentId) ? 'theme' : 'subtheme'
    rows
      .filter(row => row.type === wanted)
      .forEach((row, index) => position.set(row.id, index + 1))
  }
  for (const row of sharingHistoryRows) {
    const placed = node.get(row.collection_id)
    if (!placed || !position.has(placed.id)) continue
    const isSubtheme = !sharingHistoryRoots.includes(placed.parent_id)
    const theme = isSubtheme ? node.get(placed.parent_id) : placed
    if (!theme || !position.has(theme.id)) continue
    const rootId = theme.parent_id
    push(row.item_id, {
      list: 'sharing_history',
      site: sites.get(rootId)!.slug,
      path: isSubtheme ? `/theme/${position.get(theme.id)}/${position.get(placed.id)}` : `/theme/${position.get(theme.id)}`,
      project: projectOf(rootId),
      exhibition: titled(rootId),
      theme: titled(theme.id),
      subtheme: isSubtheme ? titled(placed.id) : null,
      legacy_order: [lastId(theme.backward_compatibility), isSubtheme ? 1 : 0, isSubtheme ? lastId(placed.backward_compatibility) : 0],
    })
  }

  // Online exhibitions: every sub-theme placing a picture of the item,
  // outside the About theme (legacy's theme 0).
  for (const row of exhibitionRows) {
    if (lastId(row.theme_bc) === 0 || row.theme_order === null || row.subtheme_order === null) continue
    push(row.item_id, {
      list: 'exhibition',
      site: sites.get(row.root_id)!.slug,
      path: `/theme/${row.theme_order - 1}/${row.subtheme_order}/${row.picture_order ?? 1}`,
      project: null,
      exhibition: titled(row.root_id),
      theme: titled(row.theme_id),
      subtheme: titled(row.subtheme_id),
      legacy_order: [themeItemId(row.extra)],
    })
  }

  const listRank = { virtual: 0, sharing_history: 1, exhibition: 2 } as const
  for (const entries of result.values()) {
    entries.sort((a, b) => {
      if (a.list !== b.list) return listRank[a.list] - listRank[b.list]
      for (let i = 0; i < Math.max(a.legacy_order.length, b.legacy_order.length); i++) {
        const d = (a.legacy_order[i] ?? 0) - (b.legacy_order[i] ?? 0)
        if (d !== 0) return d
      }
      return a.path.localeCompare(b.path)
    })
  }
  return result
}

function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(raw as string) as T
  } catch {
    return null
  }
}
