import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { PackageData } from './readiness.js'

/** Reads an exported collection-site package back from its directory. */
export function loadPackage(dir: string): PackageData {
  const read = <T>(file: string, fallback: T): T =>
    existsSync(join(dir, file)) ? (JSON.parse(readFileSync(join(dir, file), 'utf8')) as T) : fallback
  const manifest = read<Record<string, unknown> | null>('manifest.json', null)
  if (!manifest || manifest['format'] !== 'collection-site') throw new Error(`${dir} is not a collection-site package`)
  const texts: PackageData['texts'] = {}
  if (existsSync(join(dir, 'translations'))) {
    for (const file of readdirSync(join(dir, 'translations')).sort()) {
      const match = /^(.+)\.([a-z]{3})\.json$/.exec(file)
      if (!match) continue
      const [, entity, language] = match as unknown as [string, string, string]
      ;(texts[entity] ??= {})[language] = read(join('translations', file), {})
    }
  }
  return {
    manifest,
    collections: read('collections.json', []),
    placements: read('placements.json', []),
    items: read('items.json', []),
    partners: read('partners.json', []),
    timelines: read('timelines.json', []),
    timeline_events: read('timeline_events.json', []),
    texts,
  }
}
