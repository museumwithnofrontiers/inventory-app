import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThgGalleryTranslationImporter } from '../../src/importers/phase-10/thg-gallery-translation-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

/** A thg_gallery row with every extra field unset; override what a test cares about. */
function galleryRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
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
  };
}

/** An exhibition_i18n row; override what a test cares about. */
function i18nRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    gallery_id: 42,
    language_id: 'en',
    title: 'The Exhibition',
    subtitle: null,
    heading: null,
    about: null,
    enabled: 'Y',
    exh_img_caption: null,
    popup_logo_show: null,
    popup_logo: null,
    ...overrides,
  };
}

describe('ThgGalleryTranslationImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
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

  /** Build a legacyDb whose two queries return the given exhibition_i18n / thg_gallery rows. */
  function makeLegacyDb(
    i18nRows: Record<string, unknown>[],
    galleryRows: Record<string, unknown>[]
  ): ILegacyDatabase {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_i18n')) {
        return i18nRows;
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery')) {
        return galleryRows;
      }
      return [];
    });

    return {
      query: query as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  /** The single entry siteConfiguration() builds. */
  async function builtEntry(): Promise<{
    gallery: Record<string, unknown>;
    exhibition: Record<string, unknown> | undefined;
    serialized: string;
  }> {
    const entries = await new ThgGalleryTranslationImporter(context).siteConfiguration();
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry!.collection).toBe('mwnf3_thematic_gallery:thg_gallery:42');
    return {
      gallery: (entry!.translationExtra?.['thg_gallery'] ?? {}) as Record<string, unknown>,
      exhibition: entry!.translations?.['eng']?.['exhibition_i18n'] as
        Record<string, unknown> | undefined,
      serialized: JSON.stringify(entry),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    tracker.set('mwnf3_thematic_gallery:thg_gallery:42', 'collection-uuid-42', 'collection');
    tracker.set('mwnf3_thematic_gallery:thg_gallery:42', 'context-uuid-42', 'context');

    legacyDb = makeLegacyDb([i18nRow()], [galleryRow()]);

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

  it('stores bit(1) timeline flags as JSON booleans, not serialized Buffers', async () => {
    context = {
      ...context,
      legacyDb: makeLegacyDb(
        [i18nRow()],
        // mysql2 returns bit(1) columns as Buffers
        [galleryRow({ has_timeline: Buffer.from([1]), has_country_timeline: Buffer.from([0]) })]
      ),
    };

    const { gallery, serialized } = await builtEntry();
    expect(serialized).not.toContain('Buffer');
    expect(gallery).toMatchObject({
      has_timeline: true,
      has_country_timeline: false,
    });
  });

  it('keeps a false timeline flag rather than dropping it as an empty value', async () => {
    context = {
      ...context,
      legacyDb: makeLegacyDb(
        [i18nRow()],
        [galleryRow({ has_timeline: Buffer.from([0]), has_country_timeline: Buffer.from([0]) })]
      ),
    };

    const { gallery } = await builtEntry();
    expect(gallery).toHaveProperty('has_timeline', false);
    expect(gallery).toHaveProperty('has_country_timeline', false);
  });

  it('omits the timeline flags when the source columns are null', async () => {
    const { gallery } = await builtEntry();
    expect(gallery).not.toHaveProperty('has_timeline');
    expect(gallery).not.toHaveProperty('has_country_timeline');
  });

  it('keeps the other thg_gallery fields, and leaves out status, featured and live_date', async () => {
    context = {
      ...context,
      legacyDb: makeLegacyDb(
        [i18nRow()],
        [
          galleryRow({
            link: 'the_use_of_colours_in_art',
            status: 'A',
            featured: 'A',
            live_date: '2010-01-01',
            has_timeline: Buffer.from([1]),
          }),
        ]
      ),
    };

    const { gallery } = await builtEntry();
    expect(gallery).toEqual({ link: 'the_use_of_colours_in_art', has_timeline: true });
  });

  it('builds the exhibition_i18n fields by language, beside the gallery settings', async () => {
    context = {
      ...context,
      legacyDb: makeLegacyDb(
        [
          i18nRow({
            subtitle: 'A subtitle',
            about: 'About the exhibition.',
            exh_img_caption: 'A caption',
            popup_logo_show: 'Y',
          }),
        ],
        [galleryRow({ has_timeline: Buffer.from([1]) })]
      ),
    };

    const { gallery, exhibition } = await builtEntry();
    expect(gallery).toEqual({ has_timeline: true });
    // subtitle/heading/about are ALSO joined into the translation's
    // `description`. The join is lossy — `about` contains the same blank-line
    // separator it uses — so they are kept individually here as well, which
    // is the only way an exhibition package can render the sub-title, the
    // banner headline and the About page in the three places legacy puts them.
    expect(exhibition).toEqual({
      enabled: 'Y',
      exh_img_caption: 'A caption',
      popup_logo_show: 'Y',
      subtitle: 'A subtitle',
      about: 'About the exhibition.',
    });
  });

  it('takes language ids from the code map, not the tracker', async () => {
    context = { ...context, tracker: new UnifiedTracker() };

    const { exhibition } = await builtEntry();
    expect(exhibition).toEqual({ enabled: 'Y' });
  });

  it('writes the translation with no extra', async () => {
    context = {
      ...context,
      legacyDb: makeLegacyDb(
        [i18nRow({ subtitle: 'A subtitle', about: 'About the exhibition.' })],
        [galleryRow({ has_timeline: Buffer.from([1]) })]
      ),
    };

    const result = await new ThgGalleryTranslationImporter(context).import();

    expect(writeCollectionTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_id: 'collection-uuid-42',
        language_id: 'eng',
        context_id: 'context-uuid-42',
        title: 'The Exhibition',
        description: 'A subtitle\n\nAbout the exhibition.',
        extra: null,
        backward_compatibility: 'mwnf3_thematic_gallery:exhibition_i18n:42:en',
      })
    );
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});
