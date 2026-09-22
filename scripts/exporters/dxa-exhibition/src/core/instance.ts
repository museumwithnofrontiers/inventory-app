import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * The resolved contents of one `scripts/exporters/instances/<slug>.json` file
 * — the per-site scope this exporter takes instead of a hardcoded legacy id.
 * `kind` is always `'exhibition'` here; a `dxa-gallery` instance file (`kind:
 * 'gallery'`) is refused rather than silently accepted, because an exhibition
 * exporter would otherwise run against a collection with no curated theme
 * tree and produce an empty `themes.json`/`related_content.json` with nothing
 * to say why.
 */
export interface Instance {
  kind: 'exhibition'
  /** Kebab-case site slug — the output directory and `manifest.site.key`. */
  slug: string
  /** Display name — the banner and log lines. */
  name: string
  /** `collections.id` this exporter is pinned to for this run. */
  collectionId: string
  /** The npm package this instance publishes as. */
  packageName: string
  /**
   * Override for `exhibition.json`'s `languages_enabled` / `manifest.site.languages`
   * (2-char codes). Legacy's per-language `enabled` flag drives that list by
   * default; an instance sets this when legacy enables nothing (or the wrong
   * set) for a site that should still ship a working build.
   */
  languagesEnabled?: string[]
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PACKAGE_NAME_PATTERN = /^@museumwnf\/[a-z0-9-]+-data$/

const KNOWN_FIELDS = new Set([
  'kind',
  'slug',
  'name',
  'collection_id',
  'package_name',
  'languages_enabled',
])

/**
 * Resolves the `--instance` CLI value to a file path.
 *
 * A bare name (no `/`, no `\`, no `.json` suffix) is looked up in the shared
 * `scripts/exporters/instances/` directory next to every exporter package —
 * `resolve(process.cwd(), '..', 'instances', '<ref>.json')` — so `--instance
 * water-in-islam` finds `../instances/water-in-islam.json` regardless of
 * which exporter directory is the cwd. Anything else (a path containing `/`
 * or `\`, or already ending in `.json`) is treated as a path relative to
 * `process.cwd()` instead, so a one-off or test fixture instance file does
 * not have to live in the shared directory.
 */
export function resolveInstancePath(ref: string): string {
  const looksLikePath = ref.includes('/') || ref.includes('\\') || ref.endsWith('.json')
  if (looksLikePath) {
    return resolve(process.cwd(), ref)
  }
  return resolve(process.cwd(), '..', 'instances', `${ref}.json`)
}

/**
 * Loads and validates an instance file. Every failure — missing file,
 * malformed JSON, wrong kind, a field that fails its shape check, an unknown
 * field — throws with a message that says exactly what is wrong and, for a
 * missing file, where this looked.
 */
export function loadInstance(ref: string): Instance {
  const path = resolveInstancePath(ref)

  if (!existsSync(path)) {
    throw new Error(`Instance file not found: ${path} (looked for '${ref}')`)
  }

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Instance file is not valid JSON: ${path} (${message})`, { cause: err })
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`Instance file must contain a JSON object: ${path}`)
  }

  const data = raw as Record<string, unknown>

  const unknownFields = Object.keys(data).filter(key => !KNOWN_FIELDS.has(key))
  if (unknownFields.length > 0) {
    throw new Error(
      `Instance file has unknown field(s): ${unknownFields.join(', ')} (${path}). ` +
        `Known fields are: ${[...KNOWN_FIELDS].join(', ')}.`
    )
  }

  const kind = data['kind']
  if (kind === 'gallery') {
    throw new Error(
      `Instance file '${path}' is a gallery instance (kind: 'gallery') — ` +
        `use scripts/exporters/dxa-gallery for it instead.`
    )
  }
  if (kind !== 'exhibition') {
    throw new Error(`Instance file must have kind: 'exhibition' (got ${JSON.stringify(kind)}): ${path}`)
  }

  const slug = data['slug']
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Instance file 'slug' must be lowercase kebab-case (got ${JSON.stringify(slug)}): ${path}`
    )
  }

  const name = data['name']
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(`Instance file 'name' must be a non-empty string (got ${JSON.stringify(name)}): ${path}`)
  }

  const collectionId = data['collection_id']
  if (typeof collectionId !== 'string' || !UUID_PATTERN.test(collectionId)) {
    throw new Error(
      `Instance file 'collection_id' must be a lowercase UUID (got ${JSON.stringify(collectionId)}): ${path}`
    )
  }

  const packageName = data['package_name']
  if (typeof packageName !== 'string' || !PACKAGE_NAME_PATTERN.test(packageName)) {
    throw new Error(
      `Instance file 'package_name' must match @museumwnf/<slug>-data (got ${JSON.stringify(packageName)}): ${path}`
    )
  }

  let languagesEnabled: string[] | undefined
  if ('languages_enabled' in data) {
    const raw = data['languages_enabled']
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error(
        `Instance file 'languages_enabled' must be a non-empty array of language codes (got ${JSON.stringify(raw)}): ${path}`
      )
    }
    for (const code of raw) {
      if (typeof code !== 'string' || code === '' || code !== code.toLowerCase()) {
        throw new Error(
          `Instance file 'languages_enabled' entries must be non-empty lowercase codes (got ${JSON.stringify(code)}): ${path}`
        )
      }
    }
    if (new Set(raw).size !== raw.length) {
      throw new Error(
        `Instance file 'languages_enabled' must not contain duplicate codes (got ${JSON.stringify(raw)}): ${path}`
      )
    }
    languagesEnabled = raw as string[]
  }

  return {
    kind: 'exhibition',
    slug,
    name,
    collectionId,
    packageName,
    ...(languagesEnabled ? { languagesEnabled } : {}),
  }
}
