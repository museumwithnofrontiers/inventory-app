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
