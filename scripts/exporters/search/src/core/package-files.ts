/**
 * The files of @museumwnf/search-data besides the documents: `sites.json`,
 * the slug whitelist, and `manifest.json`.
 */

import { createHash } from 'crypto'
import { SLUG, type Site } from '../../../shared/sites.mjs'
import { SCHEMA, type SearchDocument } from './documents.js'

export const PACKAGE_NAME = '@museumwnf/search-data'

export interface SiteEntry {
  slug: string
  name: string
  kind: string
  parent: string | null
  origin: string
  item_path: string
}

/**
 * The whitelist of sites: the only slugs the search site turns into links,
 * and the only origins it links to. Built from the instance files alone.
 */
export function sitesFile(sites: Site[]): { schema: string; sites: SiteEntry[] } {
  const entries = sites.map(site => {
    if (!SLUG.test(site.slug)) throw new Error(`Site slug ${JSON.stringify(site.slug)} is not a valid slug.`)
    let origin: URL
    try {
      origin = new URL(site.origin)
    } catch {
      throw new Error(`Site ${site.slug}: origin ${JSON.stringify(site.origin)} is not an address.`)
    }
    if (origin.protocol !== 'https:' || origin.username !== '' || origin.password !== '' || origin.search !== '' || origin.hash !== '') {
      throw new Error(`Site ${site.slug}: origin ${JSON.stringify(site.origin)} must be a plain https address.`)
    }
    return {
      slug: site.slug,
      name: site.name ?? site.slug,
      kind: site.kind,
      parent: site.parent ?? null,
      origin: site.origin,
      item_path: site.itemPath,
    }
  })
  entries.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
  return { schema: SCHEMA, sites: entries }
}

export interface Manifest {
  schema: string
  name: string
  generatedAt: string
  languages: string[]
  counts: {
    documents: number
    excluded_no_site: number
    by_type: Record<string, number>
    by_language: Record<string, number>
    sites: number
  }
  shards: { file: string; documents: number; sha256: string }[]
}

export function manifestFile(
  documents: SearchDocument[],
  shards: Map<string, string>,
  excludedNoSite: number,
  siteCount: number
): Manifest {
  const byType: Record<string, number> = {}
  const byLanguage: Record<string, number> = {}
  for (const doc of documents) {
    byType[doc.type] = (byType[doc.type] ?? 0) + 1
    for (const lang of doc.languages) byLanguage[lang] = (byLanguage[lang] ?? 0) + 1
  }
  const sorted = (record: Record<string, number>) =>
    Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  return {
    schema: SCHEMA,
    name: PACKAGE_NAME,
    generatedAt: new Date().toISOString(),
    languages: Object.keys(byLanguage).sort(),
    counts: {
      documents: documents.length,
      excluded_no_site: excludedNoSite,
      by_type: sorted(byType),
      by_language: sorted(byLanguage),
      sites: siteCount,
    },
    shards: [...shards.entries()].map(([file, content]) => ({
      file,
      documents: content === '' ? 0 : content.split('\n').length - 1,
      sha256: createHash('sha256').update(content, 'utf-8').digest('hex'),
    })),
  }
}
