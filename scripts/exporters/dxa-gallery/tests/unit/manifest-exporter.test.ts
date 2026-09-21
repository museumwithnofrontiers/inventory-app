import { describe, expect, it, vi } from 'vitest'

import { ManifestExporter } from '../../src/exporters/manifest-exporter.js'
import type { ExportContext } from '../../src/core/types.js'

/**
 * `manifest.site` is the one thing a website reads before it mounts: the
 * languages it offers, in switcher order with their native labels, and its
 * name per language. Everything else in the package is loaded lazily, so a
 * mistake here is a website that boots with no languages and no name.
 */
function contextWith(rows: Record<string, unknown[]>): ExportContext {
  const query = vi.fn(async (sql: string) => {
    // collectProjectIds' member-item project lookup.
    if (sql.includes('FROM items')) return rows.memberProjects ?? []
    // The projects-section title lookup (buildProjectsSection) and the
    // gallery-name lookup (siteLanguages/names) both touch
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
    siteKey: 'carpets',
    gallery: {
      id: 'gallery-uuid',
      backwardCompatibility: 'mwnf3_thematic_gallery:thg_gallery:9',
      slug: 'carpets',
      host: 'https://carpets.museumwnf.org',
      mwnf3ProjectId: 'DCA',
      projectId: null,
      anchor: {},
      chrome: {},
    },
    memberItemIds: ['a', 'b'],
    itemOwnContextIds: new Map(),
    baseUrl: 'https://example.org',
    logger: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() } as unknown as ExportContext['logger'],
  }
}

describe('ManifestExporter', () => {
  it('writes the site languages in switcher order with native labels, and the names', async () => {
    const context = contextWith({
      languages: [
        { id: 'eng', backward_compatibility: 'en' },
        { id: 'fra', backward_compatibility: 'fr' },
        { id: 'ara', backward_compatibility: 'ar' },
        { id: 'swa', backward_compatibility: null },
      ],
      translations: [
        { language_id: 'fra', title: 'Tapis' },
        { language_id: 'eng', title: 'Carpets' },
        { language_id: 'ara', title: 'السجاد' },
        { language_id: 'swa', title: 'ignored' },
      ],
      labels: [
        { language_id: 'eng', name: 'English' },
        { language_id: 'fra', name: 'Français' },
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
      rights: { rights_holder: string; terms_url: string; attribution: string }
    }
    expect(manifest.languages).toEqual(['ar', 'en', 'fr'])
    expect(manifest.site.key).toBe('carpets')
    expect(manifest.site.languages).toEqual([
      { code: 'ar', label: 'AR' },
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'Français' },
    ])
    expect(manifest.site.names).toEqual({ en: 'Carpets', fr: 'Tapis', ar: 'السجاد' })
  })

  // #1911: site.key comes from the instance's siteKey, not the gallery's own
  // (DB) slug — the two can differ, that is exactly why the instance file has
  // its own `slug` field.
  it('takes manifest.site.key from context.siteKey, not from gallery.slug', async () => {
    const context = contextWith({ languages: [], translations: [], labels: [] })
    context.siteKey = 'a-different-site-slug'
    const exporter = new ManifestExporter(context)
    const written: unknown[] = []
    vi.spyOn(exporter as unknown as { writeJson: (f: string, d: unknown) => Promise<void> }, 'writeJson').mockImplementation(
      async (_file, data) => {
        written.push(data)
      }
    )

    await exporter.export()

    const manifest = written[0] as { site: { key: string } }
    expect(manifest.site.key).toBe('a-different-site-slug')
    expect(manifest.site.key).not.toBe(context.gallery.slug)
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

  // Epic #1727 phase 2: a hybrid gallery's members carry several distinct
  // source projects (not a per-export constant), plus the gallery's own
  // native project even when it holds no member itself.
  it('builds manifest.projects from the member items’ source projects plus the gallery’s own', async () => {
    const context = contextWith({
      languages: [{ id: 'eng', backward_compatibility: 'en' }],
      translations: [],
      labels: [],
      memberProjects: [{ project_id: 'dca-uuid' }, { project_id: 'isl-uuid' }],
      projects: [
        {
          id: 'dca-uuid',
          backward_compatibility: 'mwnf3:projects:DCA',
          site_url: 'https://carpets.museumwnf.org',
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
      projectTitles: [{ project_id: 'dca-uuid', language_id: 'eng', title: 'Discover Carpet Art' }],
    })
    context.gallery.projectId = 'dca-uuid'
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
      'dca-uuid': {
        name: { en: 'Discover Carpet Art' },
        site_url: 'https://carpets.museumwnf.org',
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

  // Epic #1727 phase 2 follow-up: manifest.gallery carried only the legacy
  // mwnf3_project_id; consumers resolving projects by UUID (manifest.projects)
  // need the gallery's own project_id right there too.
  it('carries the gallery own project_id (UUID) alongside the legacy mwnf3_project_id', async () => {
    const context = contextWith({ languages: [], translations: [], labels: [] })
    context.gallery.projectId = 'dca-uuid'
    const exporter = new ManifestExporter(context)
    const written: unknown[] = []
    vi.spyOn(exporter as unknown as { writeJson: (f: string, d: unknown) => Promise<void> }, 'writeJson').mockImplementation(
      async (_file, data) => {
        written.push(data)
      }
    )

    await exporter.export()

    const manifest = written[0] as { gallery: { mwnf3_project_id: string | null; project_id: string | null } }
    expect(manifest.gallery.mwnf3_project_id).toBe('DCA')
    expect(manifest.gallery.project_id).toBe('dca-uuid')
  })

  it('reports an empty projects section when the gallery has no native project and no members', async () => {
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
