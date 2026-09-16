import { describe, expect, it, vi } from 'vitest'

import { ManifestExporter } from '../../src/exporters/manifest-exporter.js'
import type { ExportContext } from '../../src/core/types.js'

/**
 * `manifest.site` is the one thing a website reads before it mounts: the
 * languages it offers, in switcher order with their native labels, and its
 * name per language. For a project website the offered languages are the
 * ones at least one exported item is translated in — the manifest's
 * `languages` list is every language in the database, and most of them have
 * no content here.
 */
function contextWith(rows: Record<string, unknown[]>): ExportContext {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('FROM item_translations')) return rows.itemLanguages
    // buildLangCodeMap's own unconditional `id, backward_compatibility`
    // select — distinct from the top-level `languages` list query below.
    if (sql.startsWith('SELECT id, backward_compatibility FROM languages')) return rows.langCodeMap ?? []
    // The primary-project-name lookup (siteNames) and the projects-section
    // title lookup (buildProjectsSection) both join collection_translations,
    // but only the latter starts from `projects p` — check it first.
    if (sql.includes('JOIN collection_translations')) return rows.projectTitles ?? []
    if (sql.includes('FROM collection_translations')) return rows.names
    if (sql.includes('FROM projects')) return rows.projects ?? []
    if (sql.includes('FROM languages')) return rows.languages
    throw new Error(`Unexpected query: ${sql}`)
  })
  return {
    db: { query } as unknown as ExportContext['db'],
    outputDir: '/tmp/none',
    projectIds: ['isl-uuid', 'epm-uuid'],
    contextIds: ['isl-context', 'epm-context'],
    projectKeys: ['ISL', 'EPM'],
    baseUrl: 'https://example.org',
    logger: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() } as unknown as ExportContext['logger'],
  }
}

describe('ManifestExporter', () => {
  it('offers the languages the items carry, with native labels, and names the primary project', async () => {
    const context = contextWith({
      languages: [
        { backward_compatibility: 'en' },
        { backward_compatibility: 'fr' },
        { backward_compatibility: 'fa' },
      ],
      itemLanguages: [
        { language_id: 'fra', code: 'fr', name: 'Français' },
        { language_id: 'eng', code: 'en', name: 'English' },
        { language_id: 'ara', code: 'ar', name: null },
      ],
      names: [
        { language_id: 'en', title: 'Discover Islamic Art' },
        { language_id: 'fr', title: 'Découvrir l’art islamique' },
      ],
    })
    const exporter = new ManifestExporter(context)
    const written: unknown[] = []
    vi.spyOn(exporter as unknown as { writeJson: (f: string, d: unknown) => Promise<void> }, 'writeJson').mockImplementation(
      async (_file, data) => {
        written.push(data)
      }
    )

    await exporter.export()

    const manifest = written[0] as {
      site: { key: string; languages: unknown[]; names: unknown }
      languages: string[]
      projectKeys: string[]
      rights: { rights_holder: string; terms_url: string; attribution: string }
    }
    expect(manifest.languages).toEqual(['en', 'fr', 'fa'])
    expect(manifest.projectKeys).toEqual(['ISL', 'EPM'])
    expect(manifest.site.key).toBe('baroqueart')
    expect(manifest.site.languages).toEqual([
      { code: 'ar', label: 'AR' },
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'Français' },
    ])
    expect(manifest.site.names).toEqual({ en: 'Discover Islamic Art', fr: 'Découvrir l’art islamique' })
  })

  // Epic #1727 phase 2: the manifest carries one `projects` entry per
  // referenced project UUID — for a project-scoped exporter that is exactly
  // `context.projectIds`, additive alongside the untouched `projectKeys`/
  // `projectIds` arrays.
  it('builds manifest.projects with per-language names and the three URL columns', async () => {
    const context = contextWith({
      languages: [],
      itemLanguages: [],
      names: [],
      langCodeMap: [
        { id: 'eng', backward_compatibility: 'en' },
        { id: 'fra', backward_compatibility: 'fr' },
      ],
      projects: [
        {
          id: 'isl-uuid',
          backward_compatibility: 'mwnf3:projects:ISL',
          site_url: 'https://islamicart.museumwnf.org',
          related_database_url: null,
          artistic_introduction_url: 'https://islamicart.museumwnf.org/gai/ISL/',
        },
        {
          id: 'epm-uuid',
          backward_compatibility: 'mwnf3:projects:EPM',
          site_url: null,
          related_database_url: null,
          artistic_introduction_url: null,
        },
      ],
      projectTitles: [
        { project_id: 'isl-uuid', language_id: 'eng', title: 'Discover Islamic Art' },
        { project_id: 'isl-uuid', language_id: 'fra', title: 'Découvrir l’art islamique' },
        { project_id: 'epm-uuid', language_id: 'eng', title: null },
      ],
    })
    const exporter = new ManifestExporter(context)
    const written: unknown[] = []
    vi.spyOn(exporter as unknown as { writeJson: (f: string, d: unknown) => Promise<void> }, 'writeJson').mockImplementation(
      async (_file, data) => {
        written.push(data)
      }
    )

    await exporter.export()

    const manifest = written[0] as {
      projectKeys: string[]
      projectIds: string[]
      projects: Record<
        string,
        {
          name: Record<string, string>
          site_url: string | null
          related_database_url: string | null
          artistic_introduction_url: string | null
        }
      >
    }
    // Additive: the legacy arrays stay untouched.
    expect(manifest.projectKeys).toEqual(['ISL', 'EPM'])
    expect(manifest.projectIds).toEqual(['isl-uuid', 'epm-uuid'])
    expect(manifest.projects).toEqual({
      'isl-uuid': {
        name: { en: 'Discover Islamic Art', fr: 'Découvrir l’art islamique' },
        site_url: 'https://islamicart.museumwnf.org',
        related_database_url: null,
        artistic_introduction_url: 'https://islamicart.museumwnf.org/gai/ISL/',
      },
      'epm-uuid': {
        // Project has no translation title in this fixture (null tolerated).
        name: {},
        site_url: null,
        related_database_url: null,
        artistic_introduction_url: null,
      },
    })
  })

  it('reports an empty projects section when there are no projects in scope', async () => {
    const context = contextWith({ languages: [], itemLanguages: [], names: [] })
    context.projectIds = []
    const exporter = new ManifestExporter(context)
    const written: unknown[] = []
    vi.spyOn(exporter as unknown as { writeJson: (f: string, d: unknown) => Promise<void> }, 'writeJson').mockImplementation(
      async (_file, data) => {
        written.push(data)
      }
    )

    await exporter.export()

    const manifest = written[0] as { projects: Record<string, unknown> }
    expect(manifest.projects).toEqual({})
  })

  // Story #1690: the site's "Source: <origin><path>" credit is composed from
  // this block, so the field names are a contract with viewer-core#79 — not
  // free to rename.
  it('carries the MWNF rights block', async () => {
    const context = contextWith({
      languages: [],
      itemLanguages: [],
      names: [],
    })
    const exporter = new ManifestExporter(context)
    const written: unknown[] = []
    vi.spyOn(exporter as unknown as { writeJson: (f: string, d: unknown) => Promise<void> }, 'writeJson').mockImplementation(
      async (_file, data) => {
        written.push(data)
      }
    )

    await exporter.export()

    const manifest = written[0] as { rights: { rights_holder: string; terms_url: string; attribution: string } }
    expect(manifest.rights).toEqual({
      rights_holder: 'Museum Ohne Grenzen e.V. (Museum With No Frontiers)',
      terms_url: 'https://www.museumwnf.org/about/legal-notice',
      attribution: 'Content © Museum With No Frontiers, used under the MWNF legal notice.',
    })
  })
})
