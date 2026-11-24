import { readFileSync } from 'node:fs'

/**
 * A collection site's instance file: which collection tree the site is, and
 * what its package is called. Nothing else. The site's runtime (banner,
 * palette, which pages exist, partners it hides, its welcome popup …) is the
 * site's own code, never the instance file's (inventory-app#2727).
 */
export interface CollectionSiteInstance {
  kind: 'collection'
  slug: string
  name: string
  collection_id: string
  package_name: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const PACKAGE = /^@museumwnf\/[a-z0-9-]+-data$/
const ALLOWED = new Set(['kind', 'slug', 'name', 'collection_id', 'package_name'])

/** Checks a parsed instance file, naming every problem at once. */
export function validateInstance(value: unknown, source = 'instance'): CollectionSiteInstance {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${source}: an instance file holds one JSON object`)
  }
  const raw = value as Record<string, unknown>
  const problems: string[] = []
  if (raw['kind'] !== 'collection') {
    problems.push(`kind must be "collection" (got ${JSON.stringify(raw['kind'])}); other kinds have their own exporter`)
  }
  if (typeof raw['slug'] !== 'string' || !SLUG.test(raw['slug'])) problems.push('slug must be lowercase words joined by "-"')
  if (typeof raw['name'] !== 'string' || raw['name'].trim() === '') problems.push('name must be a non-empty string')
  if (typeof raw['collection_id'] !== 'string' || !UUID.test(raw['collection_id'])) {
    problems.push('collection_id must be a collection UUID')
  }
  if (typeof raw['package_name'] !== 'string' || !PACKAGE.test(raw['package_name'])) {
    problems.push('package_name must match @museumwnf/<name>-data')
  }
  for (const key of Object.keys(raw)) {
    if (!ALLOWED.has(key)) {
      problems.push(`unknown field "${key}": a collection site's settings belong to the site's code, not its instance file`)
    }
  }
  if (problems.length > 0) throw new Error(`${source}:\n  - ${problems.join('\n  - ')}`)
  return raw as unknown as CollectionSiteInstance
}

export function loadInstance(path: string): CollectionSiteInstance {
  return validateInstance(JSON.parse(readFileSync(path, 'utf8')), path)
}
