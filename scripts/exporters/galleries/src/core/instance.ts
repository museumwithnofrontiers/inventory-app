import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * The collection UUIDs of every website, read from all the instance files:
 * galleries and exhibitions alike, whichever exporter builds them. A
 * standalone site names no collection and adds none. The hub lists a gallery
 * only when it has a website.
 */
export function loadSiteCollectionIds(
  dir: string = resolve(process.cwd(), '..', 'instances')
): Set<string> {
  const ids = new Set<string>()
  for (const file of readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    const path = resolve(dir, file)
    let data: unknown
    try {
      data = JSON.parse(readFileSync(path, 'utf-8'))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Invalid JSON in instance file ${path}: ${message}`, { cause: err })
    }
    const collectionId = (data as Record<string, unknown> | null)?.['collection_id']
    if (typeof collectionId === 'string') ids.add(collectionId)
  }
  if (ids.size === 0) {
    throw new Error(`No instance file in ${dir} names a collection_id.`)
  }
  return ids
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * Where each project's records live in the new estate, as the instance files
 * say it: a standalone site lists the projects it is home to (`project_ids`),
 * and a gallery or exhibition site is home to its collection's own project,
 * which the exporter reads from the database (`bySiteCollection`). Legacy's
 * item sheet pointed at the record in its home database; the sheet now points
 * at the record on that site.
 */
export interface HomeSites {
  /** Project UUID → slug of the standalone site that is its home. */
  byProject: ReadonlyMap<string, string>
  /** Collection UUID → slug of the gallery or exhibition site built from it. */
  bySiteCollection: ReadonlyMap<string, string>
  /**
   * The root collection of every exhibition that has a site of its own, an
   * online exhibition's or a mini-site's, with the project a mini-site's
   * parent site is home to first (legacy named the exhibition's project).
   */
  exhibitionSites: ReadonlyMap<string, ExhibitionSite>
}

export interface ExhibitionSite {
  slug: string
  kind: 'exhibition' | 'minisite'
  /** A mini-site's project: the first its parent site lists; null for an online exhibition. */
  projectId: string | null
}

export function loadHomeSites(dir: string = resolve(process.cwd(), '..', 'instances')): HomeSites {
  const byProject = new Map<string, string>()
  const bySiteCollection = new Map<string, string>()
  const firstProjectBySlug = new Map<string, string>()
  const exhibitions: { collectionId: string; slug: string; kind: 'exhibition' | 'minisite'; parent: string | null }[] = []
  for (const file of readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    const path = resolve(dir, file)
    let data: Record<string, unknown>
    try {
      data = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Invalid JSON in instance file ${path}: ${message}`, { cause: err })
    }
    const slug = data['slug']
    if (typeof slug !== 'string') continue
    const projectIds = data['project_ids']
    if (projectIds !== undefined) {
      if (!Array.isArray(projectIds) || projectIds.some(id => typeof id !== 'string' || !UUID_PATTERN.test(id))) {
        throw new Error(`Instance file ${path}: "project_ids" must be an array of lowercase UUIDs.`)
      }
      for (const id of projectIds as string[]) {
        const other = byProject.get(id)
        if (other && other !== slug) {
          throw new Error(`Instance file ${path}: project ${id} is already the home of "${other}".`)
        }
        byProject.set(id, slug)
      }
      if (projectIds.length > 0) firstProjectBySlug.set(slug, projectIds[0] as string)
    }
    const kind = data['kind']
    const collectionId = data['collection_id']
    if ((kind === 'gallery' || kind === 'exhibition') && typeof collectionId === 'string') {
      bySiteCollection.set(collectionId, slug)
    }
    if ((kind === 'exhibition' || kind === 'minisite') && typeof collectionId === 'string') {
      const parent = data['parent']
      exhibitions.push({ collectionId, slug, kind, parent: typeof parent === 'string' ? parent : null })
    }
  }
  const exhibitionSites = new Map<string, ExhibitionSite>()
  for (const { collectionId, slug, kind, parent } of exhibitions) {
    exhibitionSites.set(collectionId, {
      slug,
      kind,
      projectId: kind === 'minisite' && parent ? (firstProjectBySlug.get(parent) ?? null) : null,
    })
  }
  return { byProject, bySiteCollection, exhibitionSites }
}
