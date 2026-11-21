import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThgGalleryImporter } from '../../src/importers/phase-10/thg-gallery-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ThgGalleryImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeCollectionMock: ReturnType<typeof vi.fn>;
  let setCollectionExtraMock: ReturnType<typeof vi.fn>;

  const logger: ILogger = {
    info: vi.fn(),
    warning: vi.fn(),
    skip: vi.fn(),
    error: vi.fn(),
    exception: vi.fn(),
    showProgress: vi.fn(),
    showSkipped: vi.fn(),
    showError: vi.fn(),
    showSummary: vi.fn(),
  };

  /** Returns rows for the queries ThgGalleryImporter issues. */
  function buildQueryMock(overrides: {
    galleries?: Record<string, unknown>[];
    projectTypes?: Record<string, unknown>[];
    exhibitionI18nGalleryIds?: number[];
    galleryUrls?: Record<string, unknown>[];
  }) {
    const galleries = overrides.galleries ?? [
      {
        gallery_id: 10,
        project_id: 'THG',
        name: 'Islamic Art',
        link: 'islamic-art',
        sort_order: 1,
        status: 'A',
        mwnf3_project_id: 'ISL',
        i18n_group_id: 21,
        i18n_common_group_id: 59,
      },
    ];
    const projectTypes = overrides.projectTypes ?? [
      { project_id: 'THG', type_id: 1, is_gallery: 1, is_exhibition: 0 },
    ];
    const exhibitionGalleryIds = overrides.exhibitionI18nGalleryIds ?? [];
    const galleryUrls = overrides.galleryUrls ?? [
      { gallery_id: 10, link: 'https://islamic-art.museumwnf.org' },
    ];

    return vi.fn(async (sql: string) => {
      if (sql.includes('thg_gallery_url')) {
        return galleryUrls;
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery') && !sql.includes('thg_projects')) {
        return galleries;
      }
      if (sql.includes('thg_projects') && sql.includes('thg_project_type')) {
        return projectTypes;
      }
      if (sql.includes('exhibition_i18n')) {
        return exhibitionGalleryIds.map((id) => ({ gallery_id: id }));
      }
      return [];
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.set('eng', 'eng', 'language'); // default language
    tracker.set('mwnf3_thematic_gallery:galleries_root', 'galleries-root-uuid', 'collection');
    tracker.set('mwnf3_thematic_gallery:exhibitions_root', 'exhibitions-root-uuid', 'collection');
    // Context for gallery 10
    tracker.set('mwnf3_thematic_gallery:thg_gallery:10', 'context-uuid-10', 'context');

    queryMock = buildQueryMock({});

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeCollectionMock = vi.fn().mockResolvedValue('collection-uuid-10');

    setCollectionExtraMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeCollection: writeCollectionMock,
      getCollectionExtra: vi.fn().mockResolvedValue(null),
      setCollectionExtra: setCollectionExtraMock,
      setCollectionFlags: vi.fn().mockResolvedValue(undefined),
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  describe('project type classification', () => {
    it('classifies a gallery correctly when is_gallery=1 and no exhibition_i18n rows', async () => {
      const importer = new ThgGalleryImporter(context);
      const result = await importer.import();

      expect(writeCollectionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'gallery',
          parent_id: 'galleries-root-uuid',
        })
      );
      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('classifies an exhibition correctly when is_exhibition=1 and exhibition_i18n rows exist', async () => {
      queryMock = buildQueryMock({
        galleries: [{ gallery_id: 20, project_id: 'EXH', name: 'My Exhibition', link: null, sort_order: 1, status: 'A' }],
        projectTypes: [{ project_id: 'EXH', type_id: 2, is_gallery: 0, is_exhibition: 1 }],
        exhibitionI18nGalleryIds: [20],
      });
      tracker.set('mwnf3_thematic_gallery:thg_gallery:20', 'context-uuid-20', 'context');
      context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

      const importer = new ThgGalleryImporter(context);
      const result = await importer.import();

      expect(writeCollectionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'exhibition',
          parent_id: 'exhibitions-root-uuid',
        })
      );
      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('errors when project_id is null', async () => {
      queryMock = buildQueryMock({
        galleries: [{ gallery_id: 99, project_id: null, name: 'No Project', link: null, sort_order: 1, status: 'A' }],
        projectTypes: [],
        exhibitionI18nGalleryIds: [],
      });
      tracker.set('mwnf3_thematic_gallery:thg_gallery:99', 'context-uuid-99', 'context');
      context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

      const importer = new ThgGalleryImporter(context);
      const result = await importer.import();

      expect(writeCollectionMock).not.toHaveBeenCalled();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/project_id is null/);
    });

    it('errors when project_id not found in thg_projects', async () => {
      queryMock = buildQueryMock({
        galleries: [{ gallery_id: 10, project_id: 'UNKNOWN', name: 'Gallery', link: null, sort_order: 1, status: 'A' }],
        projectTypes: [],
        exhibitionI18nGalleryIds: [],
      });
      context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

      const importer = new ThgGalleryImporter(context);
      const result = await importer.import();

      expect(writeCollectionMock).not.toHaveBeenCalled();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/not found in thg_projects/);
    });

    it('errors when gallery project type has exhibition_i18n rows (is_gallery=1 but has exhibition_i18n)', async () => {
      // Gallery type but exhibition_i18n rows exist → data conflict
      queryMock = buildQueryMock({
        galleries: [{ gallery_id: 10, project_id: 'THG', name: 'Gallery', link: null, sort_order: 1, status: 'A' }],
        projectTypes: [{ project_id: 'THG', type_id: 1, is_gallery: 1, is_exhibition: 0 }],
        exhibitionI18nGalleryIds: [10], // conflict: gallery type but has exhibition_i18n
      });
      context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

      const importer = new ThgGalleryImporter(context);
      const result = await importer.import();

      expect(writeCollectionMock).not.toHaveBeenCalled();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/gallery.*exhibition_i18n rows exist/i);
    });

    it('errors when exhibition project type has no exhibition_i18n rows', async () => {
      queryMock = buildQueryMock({
        galleries: [{ gallery_id: 20, project_id: 'EXH', name: 'Exhibition', link: null, sort_order: 1, status: 'A' }],
        projectTypes: [{ project_id: 'EXH', type_id: 2, is_gallery: 0, is_exhibition: 1 }],
        exhibitionI18nGalleryIds: [], // no exhibition_i18n rows → conflict
      });
      tracker.set('mwnf3_thematic_gallery:thg_gallery:20', 'context-uuid-20', 'context');
      context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

      const importer = new ThgGalleryImporter(context);
      const result = await importer.import();

      expect(writeCollectionMock).not.toHaveBeenCalled();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/exhibition.*no exhibition_i18n rows/i);
    });

    it('errors when project type flags are ambiguous (is_gallery=1 and is_exhibition=1)', async () => {
      queryMock = buildQueryMock({
        galleries: [{ gallery_id: 10, project_id: 'BOTH', name: 'Gallery', link: null, sort_order: 1, status: 'A' }],
        projectTypes: [{ project_id: 'BOTH', type_id: 3, is_gallery: 1, is_exhibition: 1 }],
        exhibitionI18nGalleryIds: [],
      });
      context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

      const importer = new ThgGalleryImporter(context);
      const result = await importer.import();

      expect(writeCollectionMock).not.toHaveBeenCalled();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/ambiguous type flags/);
    });
  });

  it('skips gallery when context is not found', async () => {
    // Remove context from tracker
    tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.set('mwnf3_thematic_gallery:galleries_root', 'galleries-root-uuid', 'collection');
    tracker.set('mwnf3_thematic_gallery:exhibitions_root', 'exhibitions-root-uuid', 'collection');
    context = { ...context, tracker };

    const importer = new ThgGalleryImporter(context);
    const result = await importer.import();

    expect(writeCollectionMock).not.toHaveBeenCalled();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Context not found/);
  });

  it('skips already-imported gallery', async () => {
    tracker.set('mwnf3_thematic_gallery:thg_gallery:10', 'existing-uuid', 'collection');
    context = { ...context, tracker };

    const importer = new ThgGalleryImporter(context);
    const result = await importer.import();

    expect(writeCollectionMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  describe('gallery anchor (site configuration, M16 E4b)', () => {
    it('builds project code, slug, host and i18n groups for the instance file', async () => {
      const entries = await new ThgGalleryImporter(context).siteConfiguration();

      expect(entries).toEqual([
        {
          collection: 'mwnf3_thematic_gallery:thg_gallery:10',
          extra: {
            thg_gallery: {
              mwnf3_project_id: 'ISL',
              slug: 'islamic-art',
              host: 'https://islamic-art.museumwnf.org',
              i18n_group_id: 21,
              i18n_common_group_id: 59,
            },
          },
        },
      ]);
    });

    it('omits the host for exhibitions, which have no thg_gallery_url row', async () => {
      queryMock = buildQueryMock({
        galleries: [
          {
            gallery_id: 20,
            project_id: 'EXH',
            name: 'My Exhibition',
            link: 'the_use_of_colours_in_art',
            sort_order: 1,
            status: 'A',
            mwnf3_project_id: 'EXHCOLOUR',
            i18n_group_id: 65,
            i18n_common_group_id: 59,
          },
        ],
        projectTypes: [{ project_id: 'EXH', type_id: 2, is_gallery: 0, is_exhibition: 1 }],
        exhibitionI18nGalleryIds: [20],
        galleryUrls: [],
      });
      context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

      const [entry] = await new ThgGalleryImporter(context).siteConfiguration();
      const anchor = entry!.extra!['thg_gallery'] as Record<string, unknown>;

      expect(anchor.host).toBeUndefined();
      // The slug is load-bearing for exhibitions: it IS the public URL segment
      expect(anchor.slug).toBe('the_use_of_colours_in_art');
    });

    it('writes no anchor to the inventory', async () => {
      await new ThgGalleryImporter(context).import();

      const call = writeCollectionMock.mock.calls[0][0] as Record<string, unknown>;
      expect(call.extra).toBeNull();
      expect(setCollectionExtraMock).not.toHaveBeenCalled();
    });

    it("writes neither an already-imported gallery's extra nor any flag (M17 A2: featured and live_date are site configuration)", async () => {
      tracker.set('mwnf3_thematic_gallery:thg_gallery:10', 'existing-uuid', 'collection');
      context = { ...context, tracker };

      await new ThgGalleryImporter(context).import();

      expect(setCollectionExtraMock).not.toHaveBeenCalled();
      expect(strategy.setCollectionFlags).not.toHaveBeenCalled();
    });

    it('writes no flag on a new gallery', async () => {
      await new ThgGalleryImporter(context).import();

      expect(strategy.setCollectionFlags).not.toHaveBeenCalled();
    });
  });
});
