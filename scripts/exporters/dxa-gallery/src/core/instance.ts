import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * A gallery instance — the one file that turns this exporter from a
 * single-site fork into a reusable gallery exporter. Everything site-specific
 * that used to be a hardcoded constant in `src/cli/export.ts` lives here
 * instead: which collection to export, and the identity of the package it
 * becomes.
 *
 * `kind` is checked rather than assumed so a stray `--instance <exhibition
 * file>` fails with a pointer to the right exporter instead of silently
 * exporting the wrong shape.
 */
export interface Instance {
  kind: 'gallery'
  slug: string
  name: string
  collectionId: string
  packageName: string
}

const KNOWN_FIELDS = new Set(['kind', 'slug', 'name', 'collection_id', 'package_name'])

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PACKAGE_NAME_PATTERN = /^@museumwnf\/[a-z0-9-]+-data$/

/**
 * Resolve `ref` to an instance file's path.
 *
 * A ref containing a path separator or ending in `.json` is used as-is,
 * relative to `process.cwd()`. Otherwise it is a bare name, resolved against
 * `scripts/exporters/instances/<ref>.json` — computed relative to `cwd`
 * rather than this file's own location, because the CLI always runs with
 * cwd = the exporter directory, both on the host (`npm run export`) and in
 * the container (`docker-entrypoint.sh` does `cd scripts/exporters/<dir>`
 * before invoking `npm run export`).
 */
function resolveInstancePath(ref: string): string {
  if (ref.includes('/') || ref.includes('\\') || ref.endsWith('.json')) {
    return resolve(process.cwd(), ref)
  }
  return resolve(process.cwd(), '..', 'instances', `${ref}.json`)
}

/**
 * Load and validate an instance file. Every failure names what was wrong and,
 * where useful, where the loader looked — an instance file is hand-authored,
 * so the error is the whole debugging experience.
 */
export function loadInstance(ref: string): Instance {
  const path = resolveInstancePath(ref)

  if (!existsSync(path)) {
    throw new Error(`Instance file not found: ${path} (looked for --instance ${JSON.stringify(ref)})`)
  }

  const raw = readFileSync(path, 'utf-8')
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Invalid JSON in instance file ${path}: ${message}`, { cause: err })
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error(`Instance file ${path} must contain a JSON object.`)
  }

  const record = data as Record<string, unknown>

  const unknownFields = Object.keys(record).filter(key => !KNOWN_FIELDS.has(key))
  if (unknownFields.length > 0) {
    throw new Error(
      `Instance file ${path} has unknown field(s): ${unknownFields.join(', ')}. ` +
        `A typo here would otherwise pass silently — known fields are: ${[...KNOWN_FIELDS].join(', ')}.`
    )
  }

  const kind = record['kind']
  if (kind !== 'gallery') {
    if (kind === 'exhibition') {
      throw new Error(
        `Instance file ${path} has kind "exhibition" — use the dxa-exhibition exporter for it, not dxa-gallery.`
      )
    }
    throw new Error(`Instance file ${path} must have "kind": "gallery" (got ${JSON.stringify(kind)}).`)
  }

  const slug = record['slug']
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Instance file ${path}: "slug" must match ${SLUG_PATTERN.toString()} (lowercase, hyphen-separated), got ${JSON.stringify(slug)}.`
    )
  }

  const name = record['name']
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(`Instance file ${path}: "name" must be a non-empty string.`)
  }

  const collectionId = record['collection_id']
  if (typeof collectionId !== 'string' || !UUID_PATTERN.test(collectionId)) {
    throw new Error(
      `Instance file ${path}: "collection_id" must be a lowercase UUID, got ${JSON.stringify(collectionId)}.`
    )
  }

  const packageName = record['package_name']
  if (typeof packageName !== 'string' || !PACKAGE_NAME_PATTERN.test(packageName)) {
    throw new Error(
      `Instance file ${path}: "package_name" must match ${PACKAGE_NAME_PATTERN.toString()}, got ${JSON.stringify(packageName)}.`
    )
  }

  return { kind, slug, name, collectionId, packageName }
}
