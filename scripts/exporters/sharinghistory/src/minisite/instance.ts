import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * A mini-site instance: one of the sites a standalone virtual museum carried
 * inside it on legacy (a virtual exhibition), now a website of its own. Its
 * package is read from the database, narrowed to one collection subtree
 * (src/minisite/scope.ts): the instance names that collection and the
 * partners the mini-site credits itself (its curators) by their ids, as the
 * DXA instance files do, and the site that carried it on legacy.
 */
export interface MinisiteInstance {
  kind: 'minisite'
  slug: string
  name: string
  exporter: string
  parent: string
  collectionId: string
  partnerIds: string[]
  packageName: string
  legacyUrl: string | null
}

const KNOWN_FIELDS = new Set([
  'kind', 'slug', 'name', 'exporter', 'parent', 'collection_id', 'partner_ids', 'package_name', 'legacy_url',
])
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const PACKAGE_NAME_PATTERN = /^@museumwnf\/[a-z0-9-]+-data$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** A bare name is resolved against scripts/exporters/instances/, as the DXA exporters do. */
function resolveInstancePath(ref: string): string {
  if (ref.includes('/') || ref.includes('\\') || ref.endsWith('.json')) {
    return resolve(process.cwd(), ref)
  }
  return resolve(process.cwd(), '..', 'instances', `${ref}.json`)
}

/** Every mini-site the site `parent` carried on legacy, from scripts/exporters/instances/. */
export function loadMinisiteInstances(parent: string, dir = resolve(process.cwd(), '..', 'instances')): MinisiteInstance[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .filter(file => {
      const data = JSON.parse(readFileSync(resolve(dir, file), 'utf-8')) as Record<string, unknown>
      return data['kind'] === 'minisite' && data['parent'] === parent
    })
    .map(file => loadMinisiteInstance(resolve(dir, file)))
}

export function loadMinisiteInstance(ref: string): MinisiteInstance {
  const path = resolveInstancePath(ref)
  if (!existsSync(path)) throw new Error(`Instance file not found: ${path}`)
  let data: Record<string, unknown>
  try {
    data = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Invalid JSON in instance file ${path}: ${message}`, { cause: err })
  }
  const errors: string[] = []
  for (const key of Object.keys(data)) if (!KNOWN_FIELDS.has(key)) errors.push(`unknown field "${key}"`)
  if (data['kind'] !== 'minisite') errors.push(`"kind" must be "minisite" (got ${JSON.stringify(data['kind'])})`)
  const str = (key: string): string => {
    const value = data[key]
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`"${key}" must be a non-empty string`)
      return ''
    }
    return value
  }
  const slug = str('slug')
  const name = str('name')
  const exporter = str('exporter')
  const parent = str('parent')
  const collectionId = str('collection_id')
  const packageName = str('package_name')
  if (slug && !SLUG_PATTERN.test(slug)) errors.push(`"slug" ${JSON.stringify(slug)} is not kebab-case`)
  if (collectionId && !UUID_PATTERN.test(collectionId)) errors.push(`"collection_id" ${JSON.stringify(collectionId)} is not a UUID`)
  if (packageName && !PACKAGE_NAME_PATTERN.test(packageName)) errors.push(`"package_name" ${JSON.stringify(packageName)} must be @museumwnf/<name>-data`)
  const partnerIds = data['partner_ids'] ?? []
  if (!Array.isArray(partnerIds) || partnerIds.some(id => typeof id !== 'string' || !UUID_PATTERN.test(id))) {
    errors.push('"partner_ids" must be a list of partner UUIDs')
  }
  const legacyUrl = typeof data['legacy_url'] === 'string' ? (data['legacy_url'] as string) : null
  if (errors.length > 0) throw new Error(`Invalid instance file ${path}:\n  - ${errors.join('\n  - ')}`)
  return {
    kind: 'minisite',
    slug,
    name,
    exporter,
    parent,
    collectionId,
    partnerIds: partnerIds as string[],
    packageName,
    legacyUrl,
  }
}
