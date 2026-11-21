import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThgGalleryLangImporter } from '../../src/importers/phase-10/thg-gallery-lang-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

const GALLERY_KEY = 'mwnf3_thematic_gallery:thg_gallery:42';

const langRow = (overrides: Record<string, unknown> = {}) => ({
  gallery_id: 42,
  lang: 'en',
  title: 'The Gallery',
  long_title: 'The Extended Title',
  short_text: 'A short description.',
  mouse_over_text: null,
  keywords: null,
  ...overrides,
});

const galleryRow = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

describe('ThgGalleryLangImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeCollectionTranslationMock: ReturnType<typeof vi.fn>;
  let getCollectionTranslationByKeyMock: ReturnType<typeof vi.fn>;
  let setCollectionTranslationExtraByKeyMock: ReturnType<typeof vi.fn>;

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

  /** Legacy holds these lang and gallery rows. */
  const legacyRows = (
    lang: Array<Record<string, unknown>> = [langRow()],
    gallery: Array<Record<string, unknown>> = [galleryRow()]
  ) => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery_lang')) return lang;
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery')) return gallery;
      return [];
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    tracker.set(GALLERY_KEY, 'collection-uuid-42', 'collection');
    tracker.set(GALLERY_KEY, 'context-uuid-42', 'context');

    queryMock = vi.fn();
    legacyRows();

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeCollectionTranslationMock = vi.fn().mockResolvedValue(undefined);
    getCollectionTranslationByKeyMock = vi.fn().mockResolvedValue(null);
    setCollectionTranslationExtraByKeyMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeCollectionTranslation: writeCollectionTranslationMock,
      getCollectionTranslationByKey: getCollectionTranslationByKeyMock,
      setCollectionTranslationExtraByKey: setCollectionTranslationExtraByKeyMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  describe('import', () => {
    it('queries long_title, short_text, mouse_over_text, and keywords — not subtitle or description', async () => {
      await new ThgGalleryLangImporter(context).import();

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
      const result = await new ThgGalleryLangImporter(context).import();

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

    it('writes the translation with no extra, even when legacy has settings for it', async () => {
      legacyRows(
        [langRow({ mouse_over_text: 'Hover text', keywords: 'art, history' })],
        [galleryRow({ image: 'header.jpg', has_timeline: 1 })]
      );

      await new ThgGalleryLangImporter(context).import();

      const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;
      expect(call.extra).toBeNull();
    });

    it('skips a row when the gallery collection is not in the tracker', async () => {
      tracker = new UnifiedTracker();
      tracker.set('en', 'eng', 'language');

      const result = await new ThgGalleryLangImporter({ ...context, tracker }).import();

      expect(writeCollectionTranslationMock).not.toHaveBeenCalled();
      expect(result.skipped).toBeGreaterThan(0);
    });

    it('skips a row when the language code is unknown', async () => {
      legacyRows([langRow({ lang: 'xx', title: 'Unknown lang' })], []);

      const result = await new ThgGalleryLangImporter(context).import();

      expect(writeCollectionTranslationMock).not.toHaveBeenCalled();
      expect(result.skipped).toBeGreaterThan(0);
    });

    it('skips an existing translation without merging anything into its extra', async () => {
      getCollectionTranslationByKeyMock.mockResolvedValue({
        id: 'existing-translation-uuid',
        extra: JSON.stringify({ thg_gallery: { status: 'A' } }),
      });
      legacyRows([langRow({ mouse_over_text: 'Hover text' })]);

      const result = await new ThgGalleryLangImporter(context).import();

      expect(writeCollectionTranslationMock).not.toHaveBeenCalled();
      expect(getCollectionTranslationByKeyMock).toHaveBeenCalled();
      expect(setCollectionTranslationExtraByKeyMock).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('siteConfiguration', () => {
    it("builds each text's mouse_over_text and keywords, by language", async () => {
      legacyRows([langRow({ mouse_over_text: 'Hover text', keywords: 'art, history' })]);

      const entries = await new ThgGalleryLangImporter(context).siteConfiguration();

      expect(entries).toEqual([
        {
          collection: GALLERY_KEY,
          translations: {
            eng: { thg_gallery_lang: { mouse_over_text: 'Hover text', keywords: 'art, history' } },
          },
        },
      ]);
    });

    it("builds the gallery's non-empty settings, the same on every text", async () => {
      legacyRows(
        [langRow()],
        [
          galleryRow({
            image: 'header.jpg',
            has_timeline: 1,
            status: 'A',
            featured: 'A',
            live_date: new Date('2010-01-01T00:00:00.000Z'),
          }),
        ]
      );

      const entries = await new ThgGalleryLangImporter(context).siteConfiguration();

      expect(entries).toEqual([
        {
          collection: GALLERY_KEY,
          // Legacy's live/hidden status is the old sites' runtime state: it
          // isn't built. The featured flag and live date are how the gallery's
          // site behaves (M17 A2): they are built with the other settings.
          translationExtra: {
            thg_gallery: {
              image: 'header.jpg',
              has_timeline: true,
              featured: 'A',
              live_date: new Date('2010-01-01T00:00:00.000Z'),
            },
          },
        },
      ]);
    });

    it('leaves the gallery identity attributes to the collection-level anchor', async () => {
      legacyRows(
        [langRow()],
        [galleryRow({ link: 'islamic-art', image: 'header.jpg', mwnf3_project_id: 'DCA' })]
      );

      const [entry] = await new ThgGalleryLangImporter(context).siteConfiguration();

      expect(entry!.translationExtra).toEqual({ thg_gallery: { image: 'header.jpg' } });
    });

    it('stores bit(1) timeline flags as JSON booleans, not serialized Buffers', async () => {
      legacyRows(
        [langRow()],
        // mysql2 returns bit(1) columns as Buffers
        [galleryRow({ has_timeline: Buffer.from([1]), has_country_timeline: Buffer.from([0]) })]
      );

      const [entry] = await new ThgGalleryLangImporter(context).siteConfiguration();

      expect(JSON.stringify(entry)).not.toContain('Buffer');
      expect(entry!.translationExtra).toEqual({
        thg_gallery: { has_timeline: true, has_country_timeline: false },
      });
    });

    it('builds nothing when legacy has no settings for the text', async () => {
      expect(await new ThgGalleryLangImporter(context).siteConfiguration()).toEqual([]);
    });

    it('takes language ids from the code map, not the tracker, and skips unknown codes', async () => {
      legacyRows([
        langRow({ lang: 'fr', keywords: 'art' }),
        langRow({ lang: 'xx', keywords: 'art' }),
      ]);

      const entries = await new ThgGalleryLangImporter({
        ...context,
        tracker: new UnifiedTracker(),
      }).siteConfiguration();

      expect(entries).toEqual([
        {
          collection: GALLERY_KEY,
          translations: { fra: { thg_gallery_lang: { keywords: 'art' } } },
        },
      ]);
    });
  });
});
