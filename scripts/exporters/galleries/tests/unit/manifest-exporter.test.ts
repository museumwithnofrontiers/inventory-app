import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ManifestExporter } from '../../src/exporters/manifest-exporter.js'
import { LANGUAGES, context, fakeDb, tempDir } from './support.js'

describe('ManifestExporter', () => {
  let out: ReturnType<typeof tempDir>
  beforeEach(() => {
    out = tempDir()
  })
  afterEach(() => out.cleanup())

  const db = () =>
    fakeDb([
      LANGUAGES,
      [/FROM collection_translations WHERE collection_id = \?/, () => [{ language_id: 'eng', title: 'Thematic Galleries' }]],
      [/FROM language_translations/, () => [{ language_id: 'eng', name: 'English' }]],
      [
        /FROM projects WHERE id IN/,
        () => [{ id: 'galleries-project-uuid', site_url: null, related_database_url: null, artistic_introduction_url: null }],
      ],
      [/FROM projects p\s+JOIN collections/, () => [{ project_id: 'galleries-project-uuid', language_id: 'eng', title: 'MWNF Galleries' }]],
    ])

  it("describes the hub from its own collection, and names the partners' project", async () => {
    await new ManifestExporter(context(db(), out.dir)).export()

    const manifest = out.read('manifest.json') as Record<string, unknown>
    expect(manifest).toMatchObject({
      kind: 'galleries-hub',
      site: { key: 'galleries', languages: [{ code: 'en', label: 'English' }], names: { en: 'Thematic Galleries' } },
      hub: { id: 'hub-uuid', backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:45' },
      languages: ['en'],
      projects: {
        'galleries-project-uuid': {
          name: { en: 'MWNF Galleries' },
          site_url: null,
          related_database_url: null,
          artistic_introduction_url: null,
        },
      },
    })
    expect(manifest['rights']).toMatchObject({ terms_url: 'https://www.museumwnf.org/about/legal-notice' })
  })
})
