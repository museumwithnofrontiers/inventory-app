import { describe, expect, it, vi } from 'vitest'

import { Database, legacyProjectKey } from '../../src/core/database.js'

/**
 * A gallery's members are borrowed from other databases, so the source project
 * shown on each item sheet is per-item data, resolved from the project's
 * backward_compatibility key. The two keyspaces differ in shape and case.
 */
describe('legacyProjectKey', () => {
  it('reads mwnf3 project codes', () => {
    expect(legacyProjectKey('mwnf3:projects:DCA')).toBe('DCA')
    expect(legacyProjectKey('mwnf3:projects:EPM')).toBe('EPM')
    expect(legacyProjectKey('mwnf3:projects:ISL')).toBe('ISL')
    // Carpets also borrows from three projects amulets never saw.
    expect(legacyProjectKey('mwnf3:projects:BAR')).toBe('BAR')
    expect(legacyProjectKey('mwnf3:projects:EXTHE')).toBe('EXTHE')
    expect(legacyProjectKey('mwnf3:projects:GALLERIES')).toBe('GALLERIES')
  })

  it('reads Sharing History project keys, which are lowercase by convention', () => {
    expect(legacyProjectKey('mwnf3_sharing_history:sh_projects:awe')).toBe('awe')
  })

  it('returns null when there is no project', () => {
    expect(legacyProjectKey(null)).toBeNull()
    expect(legacyProjectKey('')).toBeNull()
  })
})

describe('Database.resolveGallery', () => {
  const collectionId = '743fd119-f663-54ae-b92a-933fc1fdbfd8'
  const galleryRow = {
    id: collectionId,
    backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:9',
    type: 'gallery',
    extra: {
      thg_gallery: {
        slug: 'carpets',
        host: 'https://carpets.museumwnf.org',
        mwnf3_project_id: 'DCA',
      },
    },
  }

  it('resolves by collections.id, not by backward_compatibility', async () => {
    const db = new Database()
    const querySpy = vi
      .spyOn(db, 'query')
      .mockResolvedValueOnce([galleryRow])
      .mockResolvedValueOnce([{ id: 'project-dca-uuid' }])
      .mockResolvedValueOnce([{ extra: { thg_gallery: { featured: 'A', status: 'A' } } }])

    await db.resolveGallery(collectionId)

    // The instance file supplies the collection UUID directly — the query
    // must key on `id`, never fall back to the legacy backward_compatibility
    // lookup the single-site forks used.
    expect(querySpy.mock.calls[0]?.[0]).toMatch(/WHERE\s+id\s*=\s*\?/)
    expect(querySpy.mock.calls[0]?.[1]).toEqual([collectionId])
  })

  it('reads the anchor the importer wrote to collections.extra', async () => {
    const db = new Database()
    const querySpy = vi
      .spyOn(db, 'query')
      .mockResolvedValueOnce([galleryRow])
      // resolveProjectId
      .mockResolvedValueOnce([{ id: 'project-dca-uuid' }])
      // loadGalleryChrome
      .mockResolvedValueOnce([{ extra: { thg_gallery: { featured: 'A', status: 'A' } } }])

    const gallery = await db.resolveGallery(collectionId)

    // The DB slug still comes from the data, never from the instance file's
    // own (site-facing) slug.
    expect(gallery.slug).toBe('carpets')
    expect(gallery.host).toBe('https://carpets.museumwnf.org')
    expect(gallery.mwnf3ProjectId).toBe('DCA')
    expect(gallery.chrome.featured).toBe('A')

    // The legacy code is turned into the inventory project UUID here, so the
    // MWNF-384 partner branch compares ids rather than a hardcoded 'DCA'.
    expect(gallery.projectId).toBe('project-dca-uuid')
    expect(querySpy.mock.calls[1]?.[1]).toEqual(['mwnf3:projects:DCA'])
  })

  it('leaves projectId null when the gallery has no mwnf3 project', async () => {
    const db = new Database()
    vi.spyOn(db, 'query')
      .mockResolvedValueOnce([{ ...galleryRow, extra: { thg_gallery: { slug: 'galleries' } } }])
      .mockResolvedValueOnce([])

    const gallery = await db.resolveGallery(collectionId)

    // A gallery with no mwnf3_project_id at all — the lookup must be skipped
    // entirely rather than searching for 'mwnf3:projects:null'.
    expect(gallery.mwnf3ProjectId).toBeNull()
    expect(gallery.projectId).toBeNull()
  })

  it('leaves projectId null when the project was never imported', async () => {
    const db = new Database()
    vi.spyOn(db, 'query')
      .mockResolvedValueOnce([galleryRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const gallery = await db.resolveGallery(collectionId)

    expect(gallery.mwnf3ProjectId).toBe('DCA')
    expect(gallery.projectId).toBeNull()
  })

  it('skips language rows with no thg_gallery chrome rather than returning empty', async () => {
    const db = new Database()
    vi.spyOn(db, 'query')
      .mockResolvedValueOnce([galleryRow])
      .mockResolvedValueOnce([{ id: 'project-dca-uuid' }])
      .mockResolvedValueOnce([
        { extra: { something_else: true } },
        { extra: { thg_gallery: { banner_item: 'mwnf#obj#DCA;uk;Mus31;19' } } },
      ])

    const gallery = await db.resolveGallery(collectionId)

    expect(gallery.chrome.banner_item).toBe('mwnf#obj#DCA;uk;Mus31;19')
  })

  it('fails loudly when the gallery is absent', async () => {
    const db = new Database()
    vi.spyOn(db, 'query').mockResolvedValue([])

    await expect(db.resolveGallery(collectionId)).rejects.toThrow('Gallery collection not found')
  })

  /**
   * Exhibitions live in the same table and would otherwise export as a
   * half-empty gallery package — no themes, no curated texts, no sign anything
   * is missing. Refusing is the only safe answer.
   */
  it('refuses an exhibition collection, pointing at dxa-exhibition', async () => {
    const db = new Database()
    vi.spyOn(db, 'query').mockResolvedValue([{ ...galleryRow, type: 'exhibition' }])

    await expect(db.resolveGallery(collectionId)).rejects.toThrow(
      "is a 'exhibition', not a 'gallery'"
    )
    vi.spyOn(db, 'query').mockResolvedValue([{ ...galleryRow, type: 'exhibition' }])
    await expect(db.resolveGallery(collectionId)).rejects.toThrow('dxa-exhibition')
  })
})

describe('Database.resolveItemProjects', () => {
  it('maps each member item to its own project key and context', async () => {
    const db = new Database()
    vi.spyOn(db, 'query').mockResolvedValue([
      { id: 'p-dca', backward_compatibility: 'mwnf3:projects:DCA', context_id: 'ctx-dca' },
      { id: 'p-epm', backward_compatibility: 'mwnf3:projects:EPM', context_id: 'ctx-epm' },
      { id: 'p-awe', backward_compatibility: 'mwnf3_sharing_history:sh_projects:awe', context_id: 'ctx-awe' },
    ])

    const { projectKeys, ownContextIds } = await db.resolveItemProjects([
      // A native member and a borrowed one side by side — the hybrid case that
      // makes the per-item resolution load-bearing rather than decorative.
      { item_id: 'item-0', project_id: 'p-dca' },
      { item_id: 'item-1', project_id: 'p-epm' },
      { item_id: 'item-2', project_id: 'p-awe' },
      { item_id: 'item-3', project_id: null },
    ])

    expect(projectKeys.get('item-0')).toBe('DCA')
    expect(projectKeys.get('item-1')).toBe('EPM')
    expect(projectKeys.get('item-2')).toBe('awe')
    expect(projectKeys.has('item-3')).toBe(false)
    expect(ownContextIds.get('item-0')).toBe('ctx-dca')
    expect(ownContextIds.get('item-1')).toBe('ctx-epm')
    expect(ownContextIds.get('item-2')).toBe('ctx-awe')
  })

  it('does not query when no member has a project', async () => {
    const db = new Database()
    const querySpy = vi.spyOn(db, 'query')

    const { projectKeys } = await db.resolveItemProjects([{ item_id: 'item-1', project_id: null }])

    expect(projectKeys.size).toBe(0)
    expect(querySpy).not.toHaveBeenCalled()
  })
})
