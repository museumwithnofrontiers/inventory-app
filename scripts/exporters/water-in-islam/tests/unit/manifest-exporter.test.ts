import { describe, expect, it, vi } from 'vitest'

import { ManifestExporter } from '../../src/exporters/manifest-exporter.js'
import type { ExportContext } from '../../src/core/types.js'

/**
 * `manifest.site` is the one thing a website reads before it mounts: the
 * languages it offers, in switcher order with their native labels, and its
 * name per language. For an exhibition the offered languages are the ones
 * legacy publishes (`exhibition_i18n.enabled`), not every language the
 * collection carries a title in.
 */
function contextWith(rows: Record<string, unknown[]>): ExportContext {
  const query = vi.fn(async (sql: string) => {
    // collectProjectIds' member-item project lookup.
    if (sql.includes('FROM items')) return rows.memberProjects ?? []
    // The projects-section title lookup (buildProjectsSection) and the
    // exhibition-name lookup (the top-level `rows` query) both touch
    // collection_translations, but only the former JOINs it from `projects
    // p` — check it first.
    if (sql.includes('JOIN collection_translations')) return rows.projectTitles ?? []
    if (sql.includes('FROM collection_translations')) return rows.translations
    if (sql.includes('FROM projects')) return rows.projects ?? []
    if (sql.includes('FROM languages')) return rows.languages
    if (sql.includes('FROM language_translations')) return rows.labels
    throw new Error(`Unexpected query: ${sql}`)
  })
  return {
    db: { query } as unknown as ExportContext['db'],
    outputDir: '/tmp/none',
    exhibition: {
      id: 'exhibition-uuid',
      backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:56',
      slug: 'water_in_islam',
      host: 'https://exhibitions.museumwnf.org',
      mwnf3ProjectId: 'GalEx6',
      projectId: null,
      anchor: {},
      chrome: {},
      i18n: new Map([
        ['eng', { enabled: 'Y' }],
        ['deu', { enabled: 'N' }],
      ]),
    },
    themes: [],
    memberItemIds: ['a'],
    itemProjectKeys: new Map(),
    itemOwnContextIds: new Map(),
    baseUrl: 'https://example.org',
    logger: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() } as unknown as ExportContext['logger'],
  } as unknown as ExportContext
}

describe('ManifestExporter', () => {
  it('offers only the published languages, with native labels, and names every titled one', async () => {
    const context = contextWith({
      languages: [
        { id: 'eng', backward_compatibility: 'en' },
        { id: 'deu', backward_compatibility: 'de' },
      ],
      translations: [
        { language_id: 'deu', title: 'Wasser im Islam' },
        { language_id: 'eng', title: 'Water in Islam' },
      ],
      labels: [{ language_id: 'eng', name: 'English' }],
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
      rights: { rights_holder: string; terms_url: string; attribution: string }
    }
    expect(manifest.languages).toEqual(['de', 'en'])
    expect(manifest.site.key).toBe('water-in-islam')
    expect(manifest.site.languages).toEqual([{ code: 'en', label: 'English' }])
    expect(manifest.site.names).toEqual({ en: 'Water in Islam', de: 'Wasser im Islam' })
  })

  // Story #1690: the site's "Source: <origin><path>" credit is composed from
  // this block, so the field names are a contract with viewer-core#79 — not
  // free to rename.
  it('carries the MWNF rights block', async () => {
    const context = contextWith({ languages: [], translations: [], labels: [] })
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

  // Epic #1727 phase 2: a borrowed exhibition's members carry several
  // distinct source projects (not a per-export constant), plus the
  // exhibition's own native project even when it holds no member itself.
  it('builds manifest.projects from the member items’ source projects plus the exhibition’s own', async () => {
    const context = contextWith({
      languages: [{ id: 'eng', backward_compatibility: 'en' }],
      translations: [],
      labels: [],
      memberProjects: [{ project_id: 'gex6-uuid' }, { project_id: 'isl-uuid' }],
      projects: [
        {
          id: 'gex6-uuid',
          backward_compatibility: 'mwnf3:projects:GalEx6',
          site_url: 'https://exhibitions.museumwnf.org/water-in-islam',
          related_database_url: null,
          artistic_introduction_url: null,
        },
        {
          id: 'isl-uuid',
          backward_compatibility: 'mwnf3:projects:ISL',
          site_url: null,
          related_database_url: null,
          artistic_introduction_url: null,
        },
      ],
      projectTitles: [
        { project_id: 'gex6-uuid', language_id: 'eng', title: 'Water in Islam' },
      ],
    })
    context.exhibition.projectId = 'gex6-uuid'
    const exporter = new ManifestExporter(context)
    const written: unknown[] = []
    vi.spyOn(exporter as unknown as { writeJson: (f: string, d: unknown) => Promise<void> }, 'writeJson').mockImplementation(
      async (_file, data) => {
        written.push(data)
      }
    )

    await exporter.export()

    const manifest = written[0] as {
      projects: Record<
        string,
        { name: Record<string, string>; site_url: string | null; related_database_url: string | null; artistic_introduction_url: string | null }
      >
    }
    expect(manifest.projects).toEqual({
      'gex6-uuid': {
        name: { en: 'Water in Islam' },
        site_url: 'https://exhibitions.museumwnf.org/water-in-islam',
        related_database_url: null,
        artistic_introduction_url: null,
      },
      'isl-uuid': {
        name: {},
        site_url: null,
        related_database_url: null,
        artistic_introduction_url: null,
      },
    })
  })

  it('reports an empty projects section when the exhibition has no native project and no members', async () => {
    const context = contextWith({ languages: [], translations: [], labels: [] })
    context.memberItemIds = []
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
})
