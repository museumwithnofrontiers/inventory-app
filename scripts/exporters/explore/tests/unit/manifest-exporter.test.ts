import { describe, expect, it, vi } from 'vitest'

import { ManifestExporter } from '../../src/exporters/manifest-exporter.js'
import type { ExportContext } from '../../src/core/types.js'
import { contextWith, scopeWith } from './support.js'

/**
 * `manifest.site` is the one thing a website reads before it mounts: the
 * languages it offers, in switcher order with their native labels, and its
 * name per language. Explore's monuments are other databases' records and
 * carry their languages; the site offers the languages Explore's own texts
 * are written in, and its name is the Explore root's title.
 */
function exporterWith(
  rows: Record<string, unknown[]>,
  scope = scopeWith({ collectionIds: ['root', 'theme-1'] }),
  homeSites?: ReadonlyMap<string, string>
) {
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.startsWith('SELECT id, backward_compatibility FROM languages'))
      return rows.langCodeMap ?? []
    if (sql.includes('lt.name')) return rows.siteLanguages ?? []
    if (sql.includes('FROM items')) return rows.trailKeys ?? []
    if (sql.includes('c.backward_compatibility IN')) return rows.trailTitles ?? []
    if (sql.includes('FROM projects p')) return rows.projectTitles ?? []
    if (sql.includes('ct.collection_id = ?')) return rows.names ?? []
    if (sql.includes('FROM projects')) return rows.projects ?? []
    if (sql.includes('FROM languages')) return rows.languages ?? []
    throw new Error(`Unexpected query: ${sql}`)
  })
  const context = { ...contextWith({ query } as unknown as ExportContext['db'], '/tmp/none', scope), homeSites }
  const exporter = new ManifestExporter(context)
  const written: unknown[] = []
  vi.spyOn(
    exporter as unknown as { writeJson: (f: string, d: unknown) => Promise<void> },
    'writeJson'
  ).mockImplementation(async (_file, data) => {
    written.push(data)
  })
  return { exporter, written, query }
}

describe('ManifestExporter', () => {
  it("offers the languages of Explore's own texts, with native labels, and the root's name", async () => {
    const { exporter, written, query } = exporterWith({
      languages: [{ backward_compatibility: 'en' }, { backward_compatibility: 'fr' }],
      siteLanguages: [
        { language_id: 'ita', code: 'it', name: 'Italiano' },
        { language_id: 'eng', code: 'en', name: 'English' },
        { language_id: 'deu', code: 'de', name: null },
      ],
      names: [{ language_id: 'en', title: 'Explore' }],
    })

    await exporter.export()

    const manifest = written[0] as {
      kind: string
      site: { key: string; languages: unknown[]; names: unknown }
      languages: string[]
    }
    expect(manifest.kind).toBe('explore')
    expect(manifest.site.key).toBe('explore')
    expect(manifest.site.languages).toEqual([
      { code: 'de', label: 'DE' },
      { code: 'en', label: 'English' },
      { code: 'it', label: 'Italiano' },
    ])
    expect(manifest.site.names).toEqual({ en: 'Explore' })
    expect(manifest.languages).toEqual(['en', 'fr'])

    const languagesQuery = query.mock.calls.find(([sql]) => String(sql).includes('lt.name'))!
    expect(languagesQuery[1]).toEqual(['root', 'theme-1', 'explore-context'])
  })

  it('builds manifest.projects for the projects the shipped items belong to', async () => {
    const { exporter, written } = exporterWith(
      {
        langCodeMap: [{ id: 'eng', backward_compatibility: 'en' }],
        projects: [
          {
            id: 'bar-uuid',
            backward_compatibility: 'mwnf3:projects:BAR',
            site_url: 'https://baroqueart.museumwnf.org',
            related_database_url: null,
            artistic_introduction_url: null,
          },
        ],
        projectTitles: [
          { project_id: 'bar-uuid', language_id: 'eng', title: 'Discover Baroque Art' },
        ],
      },
      scopeWith({ projectIds: ['bar-uuid'] })
    )

    await exporter.export()

    const manifest = written[0] as { projects: Record<string, unknown> }
    expect(manifest.projects).toEqual({
      'bar-uuid': {
        name: { en: 'Discover Baroque Art' },
        site_url: 'https://baroqueart.museumwnf.org',
        related_database_url: null,
        artistic_introduction_url: null,
        home_site: null,
      },
    })
  })

  // Story #1690: the site's "Source: <origin><path>" credit is composed from
  // this block, so the field names are a contract with viewer-core#79 — not
  // free to rename.
  it('carries the MWNF rights block', async () => {
    const { exporter, written } = exporterWith({})

    await exporter.export()

    const manifest = written[0] as {
      rights: { rights_holder: string; terms_url: string; attribution: string }
    }
    expect(manifest.rights).toEqual({
      rights_holder: 'Museum Ohne Grenzen e.V. (Museum With No Frontiers)',
      terms_url: 'https://www.museumwnf.org/about/legal-notice',
      attribution: 'Content © Museum With No Frontiers, used under the MWNF legal notice.',
    })
  })
  // Explore's "MWNF Database Search" opens a Virtual Museum or Sharing
  // History record on its home site, as legacy opened it on its own
  // (inventory-app#2424).
  it("names each project's home site, from the instance files", async () => {
    const { exporter, written } = exporterWith(
      {
        projects: [
          { id: 'isl-uuid', backward_compatibility: 'mwnf3:projects:ISL', site_url: null, related_database_url: null, artistic_introduction_url: null },
          { id: 'orphan-uuid', backward_compatibility: 'mwnf3:projects:ZZZ', site_url: null, related_database_url: null, artistic_introduction_url: null },
        ],
      },
      scopeWith({ projectIds: ['isl-uuid', 'orphan-uuid'] }),
      new Map([['isl-uuid', 'islamicart']])
    )

    await exporter.export()

    const manifest = written[0] as { projects: Record<string, { home_site: string | null }> }
    expect(manifest.projects['isl-uuid'].home_site).toBe('islamicart')
    expect(manifest.projects['orphan-uuid'].home_site).toBeNull()
  })

  // Legacy named an Exhibition Trails record "In <project> Exhibition
  // Trails", the project read off its key (inventory-app#2424).
  it('names the Exhibition Trails projects of the shipped records, by their code', async () => {
    const { exporter, written, query } = exporterWith(
      {
        langCodeMap: [
          { id: 'eng', backward_compatibility: 'en' },
          { id: 'fra', backward_compatibility: 'fr' },
        ],
        trailKeys: [
          { backward_compatibility: 'mwnf3_travels:monument:IAM:es:1:IX:1:b' },
          { backward_compatibility: 'mwnf3_travels:monument:GPA:pt:1:IV:2:a' },
          { backward_compatibility: 'mwnf3_travels:monument:IAM:tn:1:I:1:a' },
        ],
        trailTitles: [
          { backward_compatibility: 'mwnf3:projects:GPA', language_id: 'eng', title: 'The Great Patrons of the Arts' },
          { backward_compatibility: 'mwnf3:projects:IAM', language_id: 'eng', title: 'Islamic Art in the Mediterranean' },
          { backward_compatibility: 'mwnf3:projects:IAM', language_id: 'fra', title: "L'Art Islamique en Méditerranée" },
        ],
      },
      scopeWith({ itemIds: ['item-1', 'item-2'] })
    )

    await exporter.export()

    const manifest = written[0] as { trail_projects: Record<string, unknown> }
    expect(manifest.trail_projects).toEqual({
      GPA: { name: { en: 'The Great Patrons of the Arts' } },
      IAM: { name: { en: 'Islamic Art in the Mediterranean', fr: "L'Art Islamique en Méditerranée" } },
    })
    const titles = query.mock.calls.find(([sql]) => String(sql).includes('c.backward_compatibility IN'))!
    expect(titles[1]).toEqual(['mwnf3:projects:GPA', 'mwnf3:projects:IAM'])
  })

  it('ships no trail projects where no Exhibition Trails record is shipped', async () => {
    const { exporter, written } = exporterWith({}, scopeWith({ itemIds: ['item-1'] }))

    await exporter.export()

    expect((written[0] as { trail_projects: unknown }).trail_projects).toEqual({})
  })
})
