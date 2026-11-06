import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * Each project's home site: the slug of the instance file that lists the
 * project in its `project_ids` (`scripts/exporters/instances/*.json`). Explore's
 * "MWNF Database Search" opens a Virtual Museum or Sharing History record on
 * its home site's item page, as legacy opened it on its own site
 * (inventory-app#2424). The dxa-gallery exporter's `loadHomeSites` reads the
 * same files the same way.
 */
export function loadHomeSites(
  dir: string = resolve(process.cwd(), '..', 'instances')
): ReadonlyMap<string, string> {
  const byProject = new Map<string, string>()
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
    const projectIds = data['project_ids']
    if (typeof slug !== 'string' || projectIds === undefined) continue
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
  }
  return byProject
}
