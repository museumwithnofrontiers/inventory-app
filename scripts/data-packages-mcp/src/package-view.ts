import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type Rec = Record<string, JsonValue>

export const isRec = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Parsed JSON is shared between views of the same version: these files are immutable. */
const parsed = new Map<string, JsonValue>()
const PARSED_LIMIT = 200

/**
 * Read access to one extracted package version. Every path a caller passes is
 * checked to stay inside the package directory.
 */
export class PackageView {
  private files: string[] | null = null

  constructor(
    readonly name: string,
    readonly version: string,
    readonly root: string
  ) {}

  get label(): string {
    return `${this.name}@${this.version}`
  }

  listFiles(): string[] {
    if (this.files) return this.files
    const out: string[] = []
    const walk = (dir: string, rel: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const childRel = rel ? `${rel}/${entry.name}` : entry.name
        if (entry.isDirectory()) walk(path.join(dir, entry.name), childRel)
        else if (entry.isFile()) out.push(childRel)
      }
    }
    walk(this.root, '')
    this.files = out.sort()
    return this.files
  }

  has(file: string): boolean {
    return this.listFiles().includes(normalise(file))
  }

  resolve(file: string): string {
    const rel = normalise(file)
    const target = path.resolve(this.root, ...rel.split('/'))
    const root = path.resolve(this.root)
    if (!target.startsWith(root + path.sep)) throw new Error(`Path outside the package: "${file}"`)
    if (!this.listFiles().includes(rel)) {
      throw new Error(`${this.label} has no file "${rel}". Use list_files to see what it ships.`)
    }
    return target
  }

  size(file: string): number {
    return statSync(this.resolve(file)).size
  }

  text(file: string): string {
    return readFileSync(this.resolve(file), 'utf8')
  }

  json(file: string): JsonValue {
    const target = this.resolve(file)
    const hit = parsed.get(target)
    if (hit !== undefined) {
      parsed.delete(target)
      parsed.set(target, hit)
      return hit
    }
    let value: JsonValue
    try {
      value = JSON.parse(readFileSync(target, 'utf8')) as JsonValue
    } catch (error) {
      throw new Error(
        `${this.label}/${normalise(file)} is not valid JSON: ${(error as Error).message}`,
        { cause: error }
      )
    }
    parsed.set(target, value)
    if (parsed.size > PARSED_LIMIT) parsed.delete(parsed.keys().next().value as string)
    return value
  }

  /** `<entity>.json` as an array of records, or [] when the package does not ship it. */
  records(entity: string): Rec[] {
    const file = `${entity}.json`
    if (!this.has(file)) return []
    const value = this.json(file)
    return Array.isArray(value) ? value.filter(isRec) : []
  }

  /** A single-object file such as `manifest.json` or `gallery.json`. */
  object(file: string): Rec | null {
    if (!this.has(file)) return null
    const value = this.json(file)
    return isRec(value) ? value : null
  }

  manifest(): Rec | null {
    return this.object('manifest.json')
  }

  /** Top-level JSON files: the entity files and the site anchors. */
  topLevelJson(): string[] {
    return this.listFiles().filter(
      f => !f.includes('/') && f.endsWith('.json') && f !== 'package.json'
    )
  }

  /** `translations/<entity>.<lang>.json`, by entity then language. */
  translationFiles(): Map<string, Map<string, string>> {
    const out = new Map<string, Map<string, string>>()
    for (const file of this.listFiles()) {
      const match = /^translations\/([^/]+)\.([A-Za-z-]+)\.json$/.exec(file)
      if (!match) continue
      const byLang = out.get(match[1]) ?? new Map<string, string>()
      byLang.set(match[2], file)
      out.set(match[1], byLang)
    }
    return out
  }

  /** The translation map of an entity in one language: `{ <id>: { …fields } }`. */
  translations(entity: string, lang: string): Record<string, Rec> {
    const file = `translations/${entity}.${lang}.json`
    if (!this.has(file)) return {}
    const value = this.json(file)
    if (!isRec(value)) return {}
    const out: Record<string, Rec> = {}
    for (const [key, entry] of Object.entries(value)) if (isRec(entry)) out[key] = entry
    return out
  }

  languagesOf(entity: string): string[] {
    return [...(this.translationFiles().get(entity)?.keys() ?? [])].sort()
  }
}

export function normalise(file: string): string {
  const rel = file.replace(/\\/g, '/').replace(/^\.?\/+/, '')
  if (rel === '' || rel.split('/').some(s => s === '..' || s === '')) {
    throw new Error(`Invalid package path: "${file}"`)
  }
  return rel
}
