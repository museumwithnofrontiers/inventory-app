import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  legacyExhibitionMetadata,
  Mwnf3ExhibitionTranslationImporter,
} from '../../src/importers/phase-01/mwnf3-exhibition-translation-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import type { Mwnf3LegacyExhibition } from '../../src/domain/types/index.js';

const EXHIBITION_ID = 10;
const ARTINTRO_ID = 1;
const THEME_ID = 5;
const PAGE_ID = 3;

const EXHIBITION_COLLECTION_BC = `mwnf3:exhibitions:${EXHIBITION_ID}`;
const ARTINTRO_COLLECTION_BC = `mwnf3:artintros:${ARTINTRO_ID}`;
const THEME_COLLECTION_BC = `mwnf3:exhibition_themes:${THEME_ID}`;
const PAGE_COLLECTION_BC = `mwnf3:exhibition_pages:${PAGE_ID}`;
const ISL_PROJECT_BC = 'mwnf3:projects:ISL';

/** Base EAV rows for exhibition 10 with all six fields. */
const EXHIBITION_ALL_FIELDS_EAV = [
  { entity_id: EXHIBITION_ID, lang_id: 'en', field: 'exh_title', value: 'The Umayyads' },
  {
    entity_id: EXHIBITION_ID,
    lang_id: 'en',
    field: 'exh_description',
    value: 'A landing description.',
  },
  { entity_id: EXHIBITION_ID, lang_id: 'en', field: 'exh_credits', value: 'Credit text.' },
  { entity_id: EXHIBITION_ID, lang_id: 'en', field: 'exh_intro_header', value: 'Intro Header' },
  { entity_id: EXHIBITION_ID, lang_id: 'en', field: 'exh_intro_text', value: 'Intro body text.' },
  { entity_id: EXHIBITION_ID, lang_id: 'en', field: 'exh_subtitle', value: 'A subtitle' },
];

/** Base EAV rows for artintro 1 with all six fields. */
const ARTINTRO_ALL_FIELDS_EAV = [
  { entity_id: ARTINTRO_ID, lang_id: 'en', field: 'art_title', value: 'Artistic Introduction' },
  { entity_id: ARTINTRO_ID, lang_id: 'en', field: 'art_description', value: 'Main description.' },
  { entity_id: ARTINTRO_ID, lang_id: 'en', field: 'art_credits', value: 'Art credits.' },
  { entity_id: ARTINTRO_ID, lang_id: 'en', field: 'art_intro_header', value: 'Art intro header.' },
  { entity_id: ARTINTRO_ID, lang_id: 'en', field: 'art_intro_text', value: 'Art intro text.' },
  { entity_id: ARTINTRO_ID, lang_id: 'en', field: 'art_subtitle', value: 'Art subtitle.' },
];

/** Exhibition metadata row for exhibition 10. */
const EXHIBITION_META: Mwnf3LegacyExhibition = {
  exhibition_id: EXHIBITION_ID,
  project_id: 'ISL',
  name: 'The Umayyads',
  n: 5,
  show: 'y',
  new_status: 'new',
  portal_image: 'umayyads.jpg',
  exh_link: 'the_umayyads',
};

describe('Mwnf3ExhibitionTranslationImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeCollectionTranslationMock: ReturnType<typeof vi.fn>;
  let setCollectionFlagsMock: ReturnType<typeof vi.fn>;

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

  /**
   * Creates a queryMock that returns EAV rows for exhibition_fields only,
   * exhibition metadata from mwnf3.exhibitions, and empty arrays for all
   * other tables queried by the importer.
   */
  function makeExhibitionOnlyQueryMock(
    eavRows: typeof EXHIBITION_ALL_FIELDS_EAV,
    metaRows: (typeof EXHIBITION_META)[] = [EXHIBITION_META]
  ): ReturnType<typeof vi.fn> {
    return vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3.exhibition_fields')) return eavRows;
      if (sql.includes('FROM mwnf3.exhibitions')) return metaRows;
      // All other tables return empty (no theme, page, artintro rows)
      return [];
    });
  }

  /**
   * Creates a queryMock for artintro_fields only.
   */
  function makeArtintroOnlyQueryMock(
    eavRows: typeof ARTINTRO_ALL_FIELDS_EAV
  ): ReturnType<typeof vi.fn> {
    return vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3.artintro_fields')) return eavRows;
      if (sql.includes('FROM mwnf3.exhibitions')) return [EXHIBITION_META];
      return [];
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    tracker.set(EXHIBITION_COLLECTION_BC, 'exhibition-uuid', 'collection');
    tracker.set(ISL_PROJECT_BC, 'isl-context-uuid', 'context');
    tracker.set(ARTINTRO_COLLECTION_BC, 'artintro-uuid', 'collection');

    queryMock = makeExhibitionOnlyQueryMock(EXHIBITION_ALL_FIELDS_EAV);

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeCollectionTranslationMock = vi.fn().mockResolvedValue(undefined);
    setCollectionFlagsMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeCollectionTranslation: writeCollectionTranslationMock,
      setCollectionFlags: setCollectionFlagsMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  // ==========================================================================
  // Exhibition field mapping (Issue #1216)
  // ==========================================================================

  describe('importExhibitionTranslations — complete field mapping', () => {
    it('writes one collection translation with all six fields mapped correctly', async () => {
      const importer = new Mwnf3ExhibitionTranslationImporter(context);
      const result = await importer.import();

      expect(writeCollectionTranslationMock).toHaveBeenCalledTimes(1);
      const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;

      expect(call.collection_id).toBe('exhibition-uuid');
      expect(call.language_id).toBe('eng');
      expect(call.context_id).toBe('isl-context-uuid');
      expect(call.title).toBe('The Umayyads');
      expect(call.description).toBe('A landing description.');
      expect(call.backward_compatibility).toBe(`mwnf3:exhibition_fields:${EXHIBITION_ID}:en`);

      expect(call.extra).toBeDefined();
      const extra = JSON.parse(call.extra as string) as Record<string, unknown>;
      expect(extra.credits).toBe('Credit text.');
      expect(extra.intro_header).toBe('Intro Header');
      expect(extra.intro_text).toBe('Intro body text.');
      expect(extra.subtitle).toBe('A subtitle');
      expect(extra.legacy_exhibition).toBeUndefined();

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('does not set description to quote or mix fields between columns', async () => {
      const importer = new Mwnf3ExhibitionTranslationImporter(context);
      await importer.import();

      const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;
      // quote is not set for exhibition translations
      expect(call.quote).toBeUndefined();
      // description is only from exh_description, not intro_text
      expect(call.description).toBe('A landing description.');
    });

    it('skips and logs a warning when exh_title is missing', async () => {
      const eavWithoutTitle = EXHIBITION_ALL_FIELDS_EAV.filter((r) => r.field !== 'exh_title');
      context = {
        ...context,
        legacyDb: {
          ...legacyDb,
          query: makeExhibitionOnlyQueryMock(eavWithoutTitle) as ILegacyDatabase['query'],
        },
      };

      const importer = new Mwnf3ExhibitionTranslationImporter(context);
      const result = await importer.import();

      expect(writeCollectionTranslationMock).not.toHaveBeenCalled();
      expect(result.skipped).toBeGreaterThan(0);
      expect(logger.warning).toHaveBeenCalled();
    });

    it('skips and logs a warning when exh_title is blank after trimming', async () => {
      const eavWithBlankTitle = EXHIBITION_ALL_FIELDS_EAV.map((r) =>
        r.field === 'exh_title' ? { ...r, value: '   ' } : r
      );
      context = {
        ...context,
        legacyDb: {
          ...legacyDb,
          query: makeExhibitionOnlyQueryMock(eavWithBlankTitle) as ILegacyDatabase['query'],
        },
      };

      const importer = new Mwnf3ExhibitionTranslationImporter(context);
      const result = await importer.import();

      expect(writeCollectionTranslationMock).not.toHaveBeenCalled();
      expect(result.skipped).toBeGreaterThan(0);
      expect(logger.warning).toHaveBeenCalled();
    });

    it('omits extra fields when their source values are empty', async () => {
      const eavTitleOnly = [
        {
          entity_id: EXHIBITION_ID,
          lang_id: 'en',
          field: 'exh_title',
          value: 'Minimal Exhibition',
        },
      ];
      context = {
        ...context,
        legacyDb: {
          ...legacyDb,
          query: makeExhibitionOnlyQueryMock(eavTitleOnly) as ILegacyDatabase['query'],
        },
      };

      const importer = new Mwnf3ExhibitionTranslationImporter(context);
      await importer.import();

      const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;
      expect(call.extra).toBeNull();
    });
  });

  // ==========================================================================
  // Legacy exhibition metadata: site configuration (Issue #1218, M16 E4b)
  // ==========================================================================

  describe('legacy_exhibition metadata', () => {
    const withMeta = (meta: Mwnf3LegacyExhibition) => {
      context = {
        ...context,
        legacyDb: {
          ...legacyDb,
          query: makeExhibitionOnlyQueryMock(EXHIBITION_ALL_FIELDS_EAV, [
            meta,
          ]) as ILegacyDatabase['query'],
        },
      };
    };

    it('builds the list metadata for the exhibition translations', async () => {
      const entries = await new Mwnf3ExhibitionTranslationImporter(context).siteConfiguration();

      expect(entries).toEqual([
        {
          collection: EXHIBITION_COLLECTION_BC,
          translationExtra: {
            legacy_exhibition: {
              project_id: 'ISL',
              display_order: 5,
              new_status: 'new',
              portal_image: 'umayyads.jpg',
              exh_link: 'the_umayyads',
            },
          },
        },
      ]);
    });

    it('keeps display_order when n is zero', () => {
      expect(legacyExhibitionMetadata({ ...EXHIBITION_META, n: 0 }).display_order).toBe(0);
    });

    it('omits null optional fields', () => {
      expect(
        legacyExhibitionMetadata({
          ...EXHIBITION_META,
          portal_image: null,
          exh_link: null,
          new_status: null,
        })
      ).toEqual({ project_id: 'ISL', display_order: 5 });
    });

    it('builds nothing for an exhibition without a title', async () => {
      context = {
        ...context,
        legacyDb: {
          ...legacyDb,
          query: makeExhibitionOnlyQueryMock(
            EXHIBITION_ALL_FIELDS_EAV.filter((r) => r.field !== 'exh_title')
          ) as ILegacyDatabase['query'],
        },
      };

      const entries = await new Mwnf3ExhibitionTranslationImporter(context).siteConfiguration();

      expect(entries).toEqual([]);
    });

    it('no longer writes legacy_exhibition into the translation', async () => {
      await new Mwnf3ExhibitionTranslationImporter(context).import();

      const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;
      const extra = JSON.parse(call.extra as string) as Record<string, unknown>;
      expect(extra.legacy_exhibition).toBeUndefined();
    });

    it('leaves the collection out of draft when legacy shows the exhibition', async () => {
      await new Mwnf3ExhibitionTranslationImporter(context).import();

      expect(setCollectionFlagsMock).toHaveBeenCalledWith('exhibition-uuid', { draft: false });
    });

    it('makes the collection a draft when legacy does not show the exhibition', async () => {
      withMeta({ ...EXHIBITION_META, show: 'n' });

      await new Mwnf3ExhibitionTranslationImporter(context).import();

      expect(setCollectionFlagsMock).toHaveBeenCalledWith('exhibition-uuid', { draft: true });
    });

    it('leaves the flag alone when the show value is neither y nor n', async () => {
      withMeta({ ...EXHIBITION_META, show: '' as unknown as Mwnf3LegacyExhibition['show'] });

      await new Mwnf3ExhibitionTranslationImporter(context).import();

      expect(setCollectionFlagsMock).not.toHaveBeenCalled();
      expect(writeCollectionTranslationMock).toHaveBeenCalledTimes(1);
    });

    it('theme translations do not receive legacy_exhibition in extra', async () => {
      tracker.set(THEME_COLLECTION_BC, 'theme-uuid', 'collection');
      tracker.set(`mwnf3:exhibition_themes:${THEME_ID}`, 'theme-uuid', 'collection');

      const themeEavRows = [
        { entity_id: THEME_ID, lang_id: 'en', field: 'theme_title', value: 'Theme Title' },
      ];

      queryMock = vi.fn(async (sql: string) => {
        if (sql.includes('FROM mwnf3.exhibition_fields')) return [];
        if (sql.includes('FROM mwnf3.exhibition_theme_fields')) return themeEavRows;
        if (sql.includes('FROM mwnf3.exhibition_themes')) {
          return [{ theme_id: THEME_ID, exhibition_id: EXHIBITION_ID }];
        }
        if (sql.includes('FROM mwnf3.exhibitions')) return [EXHIBITION_META];
        return [];
      });

      context = {
        ...context,
        legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] },
      };

      const importer = new Mwnf3ExhibitionTranslationImporter(context);
      await importer.import();

      expect(writeCollectionTranslationMock).toHaveBeenCalledTimes(1);
      const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;

      if (call.extra) {
        const extra = JSON.parse(call.extra as string) as Record<string, unknown>;
        expect(extra.legacy_exhibition).toBeUndefined();
      }
    });

    it('page translations do not receive legacy_exhibition in extra', async () => {
      tracker.set(PAGE_COLLECTION_BC, 'page-uuid', 'collection');

      const pageEavRows = [
        { entity_id: PAGE_ID, lang_id: 'en', field: 'page_title', value: 'Page Title' },
      ];

      queryMock = vi.fn(async (sql: string) => {
        if (sql.includes('FROM mwnf3.exhibition_fields')) return [];
        if (sql.includes('FROM mwnf3.exhibition_theme_fields')) return [];
        if (sql.includes('FROM mwnf3.exhibition_page_fields')) return pageEavRows;
        if (sql.includes('FROM mwnf3.exhibition_pages')) {
          return [{ page_id: PAGE_ID, theme_id: THEME_ID }];
        }
        if (sql.includes('FROM mwnf3.exhibition_themes')) {
          return [{ theme_id: THEME_ID, exhibition_id: EXHIBITION_ID }];
        }
        if (sql.includes('FROM mwnf3.exhibitions')) return [EXHIBITION_META];
        return [];
      });

      context = {
        ...context,
        legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] },
      };

      const importer = new Mwnf3ExhibitionTranslationImporter(context);
      await importer.import();

      expect(writeCollectionTranslationMock).toHaveBeenCalledTimes(1);
      const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;

      if (call.extra) {
        const extra = JSON.parse(call.extra as string) as Record<string, unknown>;
        expect(extra.legacy_exhibition).toBeUndefined();
      }
    });
  });

  // ==========================================================================
  // Artintro field mapping (Issue #1219)
  // ==========================================================================

  describe('importArtintroTranslations — complete field mapping', () => {
    it('writes one collection translation with all six artintro fields mapped correctly', async () => {
      context = {
        ...context,
        legacyDb: {
          ...legacyDb,
          query: makeArtintroOnlyQueryMock(ARTINTRO_ALL_FIELDS_EAV) as ILegacyDatabase['query'],
        },
      };

      const importer = new Mwnf3ExhibitionTranslationImporter(context);
      const result = await importer.import();

      expect(writeCollectionTranslationMock).toHaveBeenCalledTimes(1);
      const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;

      expect(call.collection_id).toBe('artintro-uuid');
      expect(call.language_id).toBe('eng');
      expect(call.context_id).toBe('isl-context-uuid');
      expect(call.title).toBe('Artistic Introduction');
      expect(call.description).toBe('Main description.');
      expect(call.backward_compatibility).toBe(`mwnf3:artintro_fields:${ARTINTRO_ID}:en`);

      expect(call.extra).toBeDefined();
      const extra = JSON.parse(call.extra as string) as Record<string, unknown>;
      expect(extra.credits).toBe('Art credits.');
      expect(extra.intro_header).toBe('Art intro header.');
      expect(extra.intro_text).toBe('Art intro text.');
      expect(extra.subtitle).toBe('Art subtitle.');

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('stores art_intro_text only in extra.intro_text, not appended to description', async () => {
      context = {
        ...context,
        legacyDb: {
          ...legacyDb,
          query: makeArtintroOnlyQueryMock(ARTINTRO_ALL_FIELDS_EAV) as ILegacyDatabase['query'],
        },
      };

      const importer = new Mwnf3ExhibitionTranslationImporter(context);
      await importer.import();

      const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;

      // description is only from art_description
      expect(call.description).toBe('Main description.');
      // art_intro_text must NOT appear in description
      expect((call.description as string) ?? '').not.toContain('Art intro text.');

      // art_intro_text must appear in extra.intro_text
      const extra = JSON.parse(call.extra as string) as Record<string, unknown>;
      expect(extra.intro_text).toBe('Art intro text.');
    });

    it('description is only from art_description when art_intro_text is absent', async () => {
      const eavWithoutIntroText = ARTINTRO_ALL_FIELDS_EAV.filter(
        (r) => r.field !== 'art_intro_text'
      );
      context = {
        ...context,
        legacyDb: {
          ...legacyDb,
          query: makeArtintroOnlyQueryMock(eavWithoutIntroText) as ILegacyDatabase['query'],
        },
      };

      const importer = new Mwnf3ExhibitionTranslationImporter(context);
      await importer.import();

      const call = writeCollectionTranslationMock.mock.calls[0][0] as Record<string, unknown>;
      expect(call.description).toBe('Main description.');
      const extra = JSON.parse(call.extra as string) as Record<string, unknown>;
      expect(extra.intro_text).toBeUndefined();
    });

    it('skips and logs a warning when art_title is missing', async () => {
      const eavWithoutTitle = ARTINTRO_ALL_FIELDS_EAV.filter((r) => r.field !== 'art_title');
      context = {
        ...context,
        legacyDb: {
          ...legacyDb,
          query: makeArtintroOnlyQueryMock(eavWithoutTitle) as ILegacyDatabase['query'],
        },
      };

      const importer = new Mwnf3ExhibitionTranslationImporter(context);
      const result = await importer.import();

      expect(writeCollectionTranslationMock).not.toHaveBeenCalled();
      expect(result.skipped).toBeGreaterThan(0);
      expect(logger.warning).toHaveBeenCalled();
    });
  });
});
