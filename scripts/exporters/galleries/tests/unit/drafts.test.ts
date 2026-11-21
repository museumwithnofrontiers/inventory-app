import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Database } from '../../src/core/database.js'
import { GalleriesExporter } from '../../src/exporters/galleries-exporter.js'
import { itemShipped } from '../../../shared/drafts.mjs'
import { LANGUAGES, context, fakeDb, tempDir } from './support.js'

describe('drafts in the galleries hub (M17 B3)', () => {
  let out: ReturnType<typeof tempDir>
  beforeEach(() => {
    out = tempDir()
  })
  afterEach(() => out.cleanup())

  it('asks only for shipped hub objects', async () => {
    const db = new Database()
    const query = vi.spyOn(db, 'query').mockResolvedValue([])
    await db.resolveHubMembers('galleries-project-uuid')
    expect(query.mock.calls[0]?.[0]).toContain(itemShipped('i'))
  })

  it('lists no draft gallery', async () => {
    const row = (id: string, legacyId: number) => ({
      id,
      backward_compatibility: `mwnf3_thematic_gallery:thg_gallery:${legacyId}`,
      extra: { thg_gallery: { slug: id } },
    })
    const db = fakeDb([
      LANGUAGES,
      [
        /SELECT id, parent_id, draft FROM collections/,
        () => [
          { id: 'carpets', parent_id: 'root', draft: 0 },
          { id: 'amulets', parent_id: 'root', draft: 1 },
        ],
      ],
      [/FROM collections g\s+JOIN collections root/, () => [row('carpets', 9), row('amulets', 4)]],
      [
        /FROM collection_translations/,
        () => [
          { collection_id: 'carpets', language_id: 'eng', title: 'Carpets', extra: null },
          { collection_id: 'amulets', language_id: 'eng', title: 'Amulets', extra: null },
        ],
      ],
    ])
    await new GalleriesExporter(context(db, out.dir)).export()
    expect((out.read('galleries.json') as { id: string }[]).map(g => g.id)).toEqual(['carpets'])
  })
})
