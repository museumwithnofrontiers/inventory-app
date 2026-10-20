import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThgGalleryLangImporter } from '../../src/importers/phase-10/thg-gallery-lang-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ThgGalleryLangImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeCollectionTranslationMock: ReturnType<typeof vi.fn>;

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

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    tracker.set('mwnf3_thematic_gallery:thg_gallery:42', 'collection-uuid-42', 'collection');
    tracker.set('mwnf3_thematic_gallery:thg_gallery:42', 'context-uuid-42', 'context');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery_lang')) {
        return [
          {
            gallery_id: 42,
            lang: 'en',
            title: 'The Gallery',
            long_title: 'The Extended Title',
            short_text: 'A short description.',
            mouse_over_text: null,
            keywords: null,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery')) {
        return [
          {
            gallery_id: 42,
            link: null,
            image: null,
            banner_image: null,
            banner_item: null,
            new_expire_date: null,
            landing_url: null,
            portal_image: null,
            live_date: null,
            homepage_image: null,
            homepage_item: null,
            has_timeline: null,
            has_country_timeline: null,
            featured: null,
            status: null,
            mwnf3_project_id: null,
          },
        ];
      }
      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeCollectionTranslationMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeCollectionTranslation: writeCollectionTranslationMock,
      getCollectionTranslationByKey: vi.fn().mockResolvedValue(null),
      setCollectionTranslationExtraByKey: vi.fn().mockResolvedValue(undefined),
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('queries long_title, short_text, mouse_over_text, and keywords — not subtitle or description', async () => {
    const importer = new ThgGalleryLangImporter(context);
    await importer.import();

    const langSqlCall = queryMock.mock.calls.find((args: unknown[]) =>
      (args[0] as string).includes('FROM mwnf3_thematic_gallery.thg_gallery_lang')
    );
    expect(langSqlCall).toBeDefined();
    const sql: string = langSqlCall![0] as string;
    expect(sql).toContain('long_title');
    expect(sql).toContain('short_text');
    expect(sql).toContain('mouse_over_text');
    expect(sql).toContain('keywords');
    expect(sql).not.toContain('subtitle');
    expect(sql).not.toContain('description');
  });

  it('writes a collection translation combining long_title and short_text as description', async () => {
    const importer = new ThgGalleryLangImporter(context);
    const result = await importer.import();

    expect(writeCollectionTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_id: 'collection-uuid-42',
        language_id: 'eng',
        context_id: 'context-uuid-42',
        title: 'The Gallery',
        description: 'The Extended Title\n\nA short description.',
        backward_compatibility: 'mwnf3_thematic_gallery:thg_gallery_lang:42:en',
      })
    );
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('includes mouse_over_text and keywords in extra.thg_gallery_lang when non-empty', async () => {
    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery_lang')) {
        return [
          {
            gallery_id: 42,
            lang: 'en',
            title: 'The Gallery',
            long_title: null,
            short_text: null,
            mouse_over_text: 'Hover text',
            keywords: 'art, history',
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery')) {
        return [{ gallery_id: 42, link: null, image: null, banner_image: null,
                  banner_item: null, new_expire_date: null, landing_url: null,
                  portal_image: null, live_date: null, homepage_image: null,
                  homepage_item: null, has_timeline: null, has_country_timeline: null,
                  featured: null, status: null, mwnf3_project_id: null }];
      }
      return [];
    });
    context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

    const importer = new ThgGalleryLangImporter(context);
    await importer.import();

    const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.extra).toBeDefined();
    const extra = JSON.parse(call.extra as string) as Record<string, unknown>;
    expect(extra.thg_gallery_lang).toEqual({ mouse_over_text: 'Hover text', keywords: 'art, history' });
  });

  it('includes thg_gallery extra fields in extra.thg_gallery when non-empty', async () => {
    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery_lang')) {
        return [
          {
            gallery_id: 42,
            lang: 'en',
            title: 'The Gallery',
            long_title: null,
            short_text: null,
            mouse_over_text: null,
            keywords: null,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery')) {
        return [{
          gallery_id: 42,
          link: 'islamic-art',
          image: 'header.jpg',
          banner_image: null,
          banner_item: null,
          new_expire_date: null,
          landing_url: null,
          portal_image: null,
          live_date: null,
          homepage_image: null,
          homepage_item: null,
          has_timeline: 1,
          has_country_timeline: null,
          featured: null,
          status: 'A',
          mwnf3_project_id: 7,
        }];
      }
      return [];
    });
    context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

    const importer = new ThgGalleryLangImporter(context);
    await importer.import();

    const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.extra).toBeDefined();
    const extra = JSON.parse(call.extra as string) as Record<string, unknown>;
    expect(extra.thg_gallery).toMatchObject({ image: 'header.jpg', has_timeline: true });
    // Legacy's live/hidden status is the old sites' runtime state: not imported.
    expect(extra.thg_gallery).not.toHaveProperty('status');
    expect((extra.thg_gallery as Record<string, unknown>).banner_image).toBeUndefined();
  });

  it('leaves the gallery identity attributes to the collection-level anchor', async () => {
    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery_lang')) {
        return [
          {
            gallery_id: 42,
            lang: 'en',
            title: 'The Gallery',
            long_title: null,
            short_text: null,
            mouse_over_text: null,
            keywords: null,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery')) {
        return [{
          gallery_id: 42,
          link: 'islamic-art',
          image: 'header.jpg',
          banner_image: null,
          banner_item: null,
          new_expire_date: null,
          landing_url: null,
          portal_image: null,
          live_date: null,
          homepage_image: null,
          homepage_item: null,
          has_timeline: null,
          has_country_timeline: null,
          featured: null,
          status: null,
          mwnf3_project_id: 'DCA',
        }];
      }
      return [];
    });
    context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

    const importer = new ThgGalleryLangImporter(context);
    await importer.import();

    const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;
    const extra = JSON.parse(call.extra as string) as Record<string, unknown>;
    const galleryExtra = extra.thg_gallery as Record<string, unknown>;

    // Per-gallery identity lives on collections.extra, not on every language row
    expect(galleryExtra.link).toBeUndefined();
    expect(galleryExtra.mwnf3_project_id).toBeUndefined();
    expect(galleryExtra.image).toBe('header.jpg');
  });

  it('stores bit(1) timeline flags as JSON booleans, not serialized Buffers', async () => {
    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery_lang')) {
        return [
          {
            gallery_id: 42,
            lang: 'en',
            title: 'The Gallery',
            long_title: null,
            short_text: null,
            mouse_over_text: null,
            keywords: null,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery')) {
        return [{
          gallery_id: 42,
          link: null,
          image: null,
          banner_image: null,
          banner_item: null,
          new_expire_date: null,
          landing_url: null,
          portal_image: null,
          live_date: null,
          homepage_image: null,
          homepage_item: null,
          // mysql2 returns bit(1) columns as Buffers
          has_timeline: Buffer.from([1]),
          has_country_timeline: Buffer.from([0]),
          featured: null,
          status: null,
          mwnf3_project_id: null,
        }];
      }
      return [];
    });
    context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

    const importer = new ThgGalleryLangImporter(context);
    await importer.import();

    const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;
    const serialized = call.extra as string;
    expect(serialized).not.toContain('Buffer');

    const extra = JSON.parse(serialized) as Record<string, unknown>;
    expect(extra.thg_gallery).toMatchObject({
      has_timeline: true,
      has_country_timeline: false,
    });
  });

  it('extra is null when thg_gallery has no non-empty extra fields and no thg_gallery_lang extras', async () => {
    const importer = new ThgGalleryLangImporter(context);
    await importer.import();

    const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.extra).toBeNull();
  });

  it('skips a row when the gallery collection is not in the tracker', async () => {
    tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    // no collection registered for gallery 42

    context = { ...context, tracker };
    const importer = new ThgGalleryLangImporter(context);
    const result = await importer.import();

    expect(writeCollectionTranslationMock).not.toHaveBeenCalled();
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('skips a row when the language code is unknown', async () => {
    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery_lang')) {
        return [
          {
            gallery_id: 42,
            lang: 'xx',
            title: 'Unknown lang',
            long_title: null,
            short_text: null,
            mouse_over_text: null,
            keywords: null,
          },
        ];
      }
      return [];
    });
    legacyDb = { ...legacyDb, query: queryMock as ILegacyDatabase['query'] };
    context = { ...context, legacyDb };

    const importer = new ThgGalleryLangImporter(context);
    const result = await importer.import();

    expect(writeCollectionTranslationMock).not.toHaveBeenCalled();
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('skips writeCollectionTranslation and merges extra when translation with same key already exists', async () => {
    const existingExtra = JSON.stringify({ thg_gallery: { status: 'A' } });
    const getCollectionTranslationByKeyMock = vi.fn().mockResolvedValue({
      id: 'existing-translation-uuid',
      extra: existingExtra,
    });
    const setCollectionTranslationExtraByKeyMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeCollectionTranslation: writeCollectionTranslationMock,
      getCollectionTranslationByKey: getCollectionTranslationByKeyMock,
      setCollectionTranslationExtraByKey: setCollectionTranslationExtraByKeyMock,
    } as unknown as IWriteStrategy;

    // Use a queryMock that returns non-null mouse_over_text so buildExtra returns non-null
    const langWithExtra = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery_lang')) {
        return [
          {
            gallery_id: 42,
            lang: 'en',
            title: 'The Gallery',
            long_title: 'The Extended Title',
            short_text: 'A short description.',
            mouse_over_text: 'Hover text',
            keywords: null,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery')) {
        return [{ gallery_id: 42, link: null, image: null, banner_image: null,
                  banner_item: null, new_expire_date: null, landing_url: null,
                  portal_image: null, live_date: null, homepage_image: null,
                  homepage_item: null, has_timeline: null, has_country_timeline: null,
                  featured: null, status: null, mwnf3_project_id: null }];
      }
      return [];
    });

    context = {
      ...context,
      strategy,
      legacyDb: { ...legacyDb, query: langWithExtra as ILegacyDatabase['query'] },
    };

    const importer = new ThgGalleryLangImporter(context);
    const result = await importer.import();

    expect(writeCollectionTranslationMock).not.toHaveBeenCalled();
    expect(getCollectionTranslationByKeyMock).toHaveBeenCalled();
    expect(setCollectionTranslationExtraByKeyMock).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
