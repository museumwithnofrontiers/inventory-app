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
  scope = scopeWith({ collectionIds: ['root', 'theme-1'] })
) {
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.startsWith('SELECT id, backward_compatibility FROM languages'))
      return rows.langCodeMap ?? []
    if (sql.includes('lt.name')) return rows.siteLanguages ?? []
    if (sql.includes('FROM projects p')) return rows.projectTitles ?? []
    if (sql.includes('ct.collection_id = ?')) return rows.names ?? []
    if (sql.includes('FROM projects')) return rows.projects ?? []
    if (sql.includes('FROM languages')) return rows.languages ?? []
    throw new Error(`Unexpected query: ${sql}`)
  })
  const context = contextWith({ query } as unknown as ExportContext['db'], '/tmp/none', scope)
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
})
