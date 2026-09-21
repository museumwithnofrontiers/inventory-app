import { describe, expect, it, vi } from 'vitest'

import { Database, coverPictureItemId, legacyProjectKey } from '../../src/core/database.js'

/**
 * An exhibition's members are almost all borrowed from other databases — 147 of
 * this one's 171 — so the source project shown on each item sheet is per-item
 * data, resolved from the project's backward_compatibility key. The two
 * keyspaces differ in shape and case.
 */
describe('legacyProjectKey', () => {
  it('reads mwnf3 project codes', () => {
    expect(legacyProjectKey('mwnf3:projects:EXHCOLOUR')).toBe('EXHCOLOUR')
    expect(legacyProjectKey('mwnf3:projects:EPM')).toBe('EPM')
    expect(legacyProjectKey('mwnf3:projects:ISL')).toBe('ISL')
    expect(legacyProjectKey('mwnf3:projects:BAR')).toBe('BAR')
    expect(legacyProjectKey('mwnf3:projects:DCA')).toBe('DCA')
    expect(legacyProjectKey('mwnf3:projects:GALLERIES')).toBe('GALLERIES')
    expect(legacyProjectKey('mwnf3:projects:DGA')).toBe('DGA')
  })

  it('reads Sharing History project keys, which are lowercase by convention', () => {
    expect(legacyProjectKey('mwnf3_sharing_history:sh_projects:awe')).toBe('awe')
  })

  it('returns null when there is no project', () => {
    expect(legacyProjectKey(null)).toBeNull()
    expect(legacyProjectKey('')).toBeNull()
  })
})

describe('Database.resolveExhibition', () => {
  const exhibitionRow = {
    id: 'exhibition-uuid',
    backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:47',
    type: 'exhibition',
    extra: {
      thg_gallery: {
        slug: 'the_use_of_colours_in_art',
        host: 'https://exhibitions.museumwnf.org',
        mwnf3_project_id: 'EXHCOLOUR',
      },
    },
  }

  it('queries collections by id, not by backward_compatibility', async () => {
    const db = new Database()
    const querySpy = vi
      .spyOn(db, 'query')
      .mockResolvedValueOnce([exhibitionRow])
      .mockResolvedValueOnce([
        { language_id: 'eng', extra: { thg_gallery: { featured: 'A', status: 'A' } } },
      ])
      .mockResolvedValueOnce([{ id: 'project-exhcolour-uuid' }])

    await db.resolveExhibition('exhibition-uuid')

    const [sql, params] = querySpy.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/WHERE\s+id\s*=\s*\?/)
    expect(params).toEqual(['exhibition-uuid'])
  })

  it('reads the anchor the importer wrote to collections.extra', async () => {
    const db = new Database()
    const querySpy = vi
      .spyOn(db, 'query')
      .mockResolvedValueOnce([exhibitionRow])
      // loadExhibitionTranslationExtras — runs before the project lookup
      .mockResolvedValueOnce([
        { language_id: 'eng', extra: { thg_gallery: { featured: 'A', status: 'A' } } },
      ])
      // resolveProjectId
      .mockResolvedValueOnce([{ id: 'project-exhcolour-uuid' }])

    const exhibition = await db.resolveExhibition('exhibition-uuid')

    // The slug keeps its legacy underscores even though the package and folder
    // are the kebab-cased short form; it is the public URL path.
    expect(exhibition.slug).toBe('the_use_of_colours_in_art')
    expect(exhibition.host).toBe('https://exhibitions.museumwnf.org')
    expect(exhibition.mwnf3ProjectId).toBe('EXHCOLOUR')
    expect(exhibition.chrome.featured).toBe('A')

    // The legacy code is turned into the inventory project UUID here, so the
    // MWNF-384 partner branch compares ids rather than a hardcoded code.
    expect(exhibition.projectId).toBe('project-exhcolour-uuid')
    expect(querySpy.mock.calls[2]?.[1]).toEqual(['mwnf3:projects:EXHCOLOUR'])
  })

  /**
   * `exhibition_i18n.enabled` is the one part of the extras that is genuinely
   * per-language, and on this exhibition the two languages disagree: English is
   * published, German is not. Collapsing the block to "the first row wins", the
   * way the shared `thg_gallery` chrome is read, would publish a German build
   * whose every curated text the live instance returns as null.
   */
  it('keeps exhibition_i18n per language while chrome stays shared', async () => {
    const db = new Database()
    vi.spyOn(db, 'query')
      .mockResolvedValueOnce([exhibitionRow])
      .mockResolvedValueOnce([
        {
          language_id: 'deu',
          extra: { thg_gallery: { status: 'A' }, exhibition_i18n: { enabled: 'N' } },
        },
        {
          language_id: 'eng',
          extra: {
            thg_gallery: { status: 'A' },
            exhibition_i18n: { enabled: 'Y', subtitle: 'About Techniques' },
          },
        },
      ])
      .mockResolvedValueOnce([{ id: 'project-exhcolour-uuid' }])

    const exhibition = await db.resolveExhibition('exhibition-uuid')

    expect(exhibition.i18n.get('deu')?.enabled).toBe('N')
    expect(exhibition.i18n.get('eng')?.enabled).toBe('Y')
    expect(exhibition.i18n.get('eng')?.subtitle).toBe('About Techniques')
    expect(exhibition.chrome.status).toBe('A')
  })

  it('leaves projectId null when the project was never imported', async () => {
    const db = new Database()
    vi.spyOn(db, 'query')
      .mockResolvedValueOnce([exhibitionRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const exhibition = await db.resolveExhibition('exhibition-uuid')

    expect(exhibition.mwnf3ProjectId).toBe('EXHCOLOUR')
    expect(exhibition.projectId).toBeNull()
  })

  it('skips language rows with no thg_gallery chrome rather than returning empty', async () => {
    const db = new Database()
    vi.spyOn(db, 'query')
      .mockResolvedValueOnce([exhibitionRow])
      .mockResolvedValueOnce([
        { language_id: 'deu', extra: { something_else: true } },
        { language_id: 'eng', extra: { thg_gallery: { banner_item: 'sh#obj#AWE;pt;21' } } },
      ])
      .mockResolvedValueOnce([{ id: 'project-exhcolour-uuid' }])

    const exhibition = await db.resolveExhibition('exhibition-uuid')

    expect(exhibition.chrome.banner_item).toBe('sh#obj#AWE;pt;21')
  })

  it('fails loudly when the exhibition is absent', async () => {
    const db = new Database()
    vi.spyOn(db, 'query').mockResolvedValue([])

    await expect(db.resolveExhibition('exhibition-uuid')).rejects.toThrow(
      'Exhibition collection not found'
    )
    await expect(db.resolveExhibition('exhibition-uuid')).rejects.toThrow(
      'importer:find-collection'
    )
  })

  /**
   * Galleries live in the same table. Exporting one through this exporter would
   * produce an exhibition package with an empty theme tree and no sign that
   * anything is missing, so refusing is the only safe answer — the mirror of
   * the guard the carpets exporter has against exhibitions.
   */
  it('refuses a gallery collection', async () => {
    const db = new Database()
    vi.spyOn(db, 'query').mockResolvedValue([
      {
        ...exhibitionRow,
        type: 'gallery',
        backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery:9',
      },
    ])

    await expect(db.resolveExhibition('gallery-uuid')).rejects.toThrow(
      "is a 'gallery', not an 'exhibition'"
    )
    await expect(db.resolveExhibition('gallery-uuid')).rejects.toThrow(
      'scripts/exporters/dxa-gallery'
    )
  })
})

/**
 * Theme covers come from `extra.thg_theme.cover_picture`, which the importer
 * resolved to an item UUID at import time (gap E4). Six of this exhibition's
 * fifteen themes have no cover at all, so the absent case is the common one.
 */
describe('coverPictureItemId', () => {
  it('reads the resolved item id the importer stored', () => {
    expect(
      coverPictureItemId({
        thg_theme: {
          cover_picture: {
            item_id: 'picture-uuid',
            backward_compatibility: 'mwnf3:objects_pictures:DCA:tr:Mus31:10:1',
          },
        },
      })
    ).toBe('picture-uuid')
  })

  it('accepts the JSON-string form a driver may hand back', () => {
    expect(coverPictureItemId('{"thg_theme":{"cover_picture":{"item_id":"picture-uuid"}}}')).toBe(
      'picture-uuid'
    )
  })

  it('returns null for a theme with no cover, and for unparseable extra', () => {
    expect(coverPictureItemId(null)).toBeNull()
    expect(coverPictureItemId({})).toBeNull()
    expect(coverPictureItemId({ thg_theme: {} })).toBeNull()
    expect(coverPictureItemId('not json')).toBeNull()
  })
})

describe('Database.resolveThemes', () => {
  /**
   * The tree is two levels and both are `type = 'theme'`: a top-level theme's
   * parent is the exhibition collection, a sub-theme's parent is a theme. The
   * query therefore asks for children of the exhibition UNION children of those
   * children, and binds the exhibition id twice.
   */
  it('collects both levels by parent_id, not by collection type', async () => {
    const db = new Database()
    const querySpy = vi.spyOn(db, 'query').mockResolvedValue([
      {
        id: 'theme-11',
        internal_name: 'theme_47_11',
        backward_compatibility: 'mwnf3_thematic_gallery:theme:47:11',
        display_order: 5,
        parent_id: 'exhibition-uuid',
        extra: null,
      },
      {
        id: 'theme-12',
        internal_name: 'theme_47_12',
        backward_compatibility: 'mwnf3_thematic_gallery:theme:47:12',
        display_order: 1,
        parent_id: 'theme-11',
        extra: { thg_theme: { cover_picture: { item_id: 'cover-uuid' } } },
      },
    ])

    const themes = await db.resolveThemes('exhibition-uuid')

    expect(themes).toHaveLength(2)
    expect(themes[0]?.parentId).toBe('exhibition-uuid')
    expect(themes[1]?.parentId).toBe('theme-11')
    expect(themes[1]?.coverPictureItemId).toBe('cover-uuid')
    expect(querySpy.mock.calls[0]?.[1]).toEqual(['exhibition-uuid', 'exhibition-uuid'])
    expect(querySpy.mock.calls[0]?.[0]).toContain("c.type = 'theme'")
  })

  /**
   * The keyspace id and the display order are different numbers: theme 11 is
   * displayed fifth and theme 4 second. Ordering by the id would reorder the
   * whole exhibition.
   */
  it('orders by display_order rather than by the id in the key', async () => {
    const db = new Database()
    const querySpy = vi.spyOn(db, 'query').mockResolvedValue([])

    await db.resolveThemes('exhibition-uuid')

    expect(querySpy.mock.calls[0]?.[0]).toContain('ORDER BY c.display_order')
  })

  it('defaults a missing display_order to 0 rather than dropping the theme', async () => {
    const db = new Database()
    vi.spyOn(db, 'query').mockResolvedValue([
      {
        id: 'theme-0',
        internal_name: 'theme_47_0',
        backward_compatibility: 'mwnf3_thematic_gallery:theme:47:0',
        display_order: null,
        parent_id: 'exhibition-uuid',
        extra: null,
      },
    ])

    const themes = await db.resolveThemes('exhibition-uuid')

    expect(themes).toHaveLength(1)
    expect(themes[0]?.displayOrder).toBe(0)
  })
})

describe('Database.resolveItemProjects', () => {
  it('maps each member item to its own project key and context', async () => {
    const db = new Database()
    vi.spyOn(db, 'query').mockResolvedValue([
      {
        id: 'p-exh',
        backward_compatibility: 'mwnf3:projects:EXHCOLOUR',
        context_id: 'ctx-exh',
      },
      { id: 'p-epm', backward_compatibility: 'mwnf3:projects:EPM', context_id: 'ctx-epm' },
      {
        id: 'p-awe',
        backward_compatibility: 'mwnf3_sharing_history:sh_projects:awe',
        context_id: 'ctx-awe',
      },
    ])

    const { projectKeys, ownContextIds } = await db.resolveItemProjects([
      // A native member and two borrowed ones side by side — the case that
      // makes the per-item resolution load-bearing rather than decorative.
      { item_id: 'item-0', project_id: 'p-exh' },
      { item_id: 'item-1', project_id: 'p-epm' },
      { item_id: 'item-2', project_id: 'p-awe' },
      { item_id: 'item-3', project_id: null },
    ])

    expect(projectKeys.get('item-0')).toBe('EXHCOLOUR')
    expect(projectKeys.get('item-1')).toBe('EPM')
    expect(projectKeys.get('item-2')).toBe('awe')
    expect(projectKeys.has('item-3')).toBe(false)
    expect(ownContextIds.get('item-0')).toBe('ctx-exh')
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
