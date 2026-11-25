import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThgContributorImporter } from '../../src/importers/phase-04/thg-contributor-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ThgContributorImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeContributorMock: ReturnType<typeof vi.fn>;
  let writeContributorTranslationMock: ReturnType<typeof vi.fn>;
  let writeContributorImageMock: ReturnType<typeof vi.fn>;

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
    tracker.setMetadata('default_language_id', 'eng');
    tracker.set('en', 'eng', 'language');
    tracker.set('fr', 'fra', 'language');
    // gallery collection and context
    tracker.set('mwnf3_thematic_gallery:thg_gallery:7', 'gallery-collection-uuid', 'collection');
    // default context
    tracker.setMetadata('default_context_id', 'default-context-uuid');
    tracker.set('default', 'default-context-uuid', 'context');
    // theme collection for theme_id=3
    tracker.set('mwnf3_thematic_gallery:theme:7:3', 'theme-collection-uuid', 'collection');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.contributor_category')) {
        return [
          { category_id: 'partner', label: 'Main contributors' },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.contributor_i18n')) {
        return [
          { contributor_id: 14, language_id: 'en', context: 'English Name' },
          { contributor_id: 14, language_id: 'fr', context: 'French Name' },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.contributor')) {
        return [
          {
            contributor_id: 14,
            gallery_id: 7,
            theme_id: 0,
            category_id: 'partner',
            context: 'Contributor Name',
            src: 'logos/contrib14.png',
            href: 'https://example.com',
            alt: 'Alt text',
            display_order: 1,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner_i18n')) {
        return [];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner')) {
        return [];
      }
      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeContributorMock = vi.fn().mockResolvedValue('contributor-uuid');
    writeContributorTranslationMock = vi.fn().mockResolvedValue(undefined);
    writeContributorImageMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeContributor: writeContributorMock,
      writeContributorTranslation: writeContributorTranslationMock,
      writeContributorImage: writeContributorImageMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  describe('contributor_i18n language validation — language_id column', () => {
    it('uses language_id from contributor_i18n rows — not lang', async () => {
      const importer = new ThgContributorImporter(context);
      const result = await importer.import();

      // Two translations should be written (one per language)
      expect(writeContributorTranslationMock).toHaveBeenCalledTimes(2);
      const calls = writeContributorTranslationMock.mock.calls as { language_id: string }[][];
      const languageIds = calls.map((args) => (args[0] as { language_id: string }).language_id);
      expect(languageIds).toContain('eng');
      expect(languageIds).toContain('fra');
      expect(result.errors).toHaveLength(0);
    });

    it('skips translation when language_id is empty (null/undefined)', async () => {
      queryMock = vi.fn(async (sql: string) => {
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor_category')) {
          return [{ category_id: 'partner', label: 'Main contributors' }];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor_i18n')) {
          return [
            // language_id is null — simulates a missing value row
            { contributor_id: 14, language_id: null, context: 'Should be skipped' },
          ];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor')) {
          return [
            { contributor_id: 14, gallery_id: 7, theme_id: 0, category_id: 'partner',
              context: 'Name', src: '', href: '', alt: '', display_order: 1 },
          ];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner_i18n')) return [];
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner')) return [];
        return [];
      });
      context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

      const importer = new ThgContributorImporter(context);
      const result = await importer.import();

      // Contributor is imported but translation skipped (no error, just warning logged)
      expect(writeContributorMock).toHaveBeenCalledTimes(1);
      expect(writeContributorTranslationMock).not.toHaveBeenCalled();
      expect(result.errors).toHaveLength(0);
    });

    it('skips translation when language_id is unknown', async () => {
      queryMock = vi.fn(async (sql: string) => {
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor_category')) {
          return [{ category_id: 'partner', label: 'Main contributors' }];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor_i18n')) {
          return [
            { contributor_id: 14, language_id: 'xx', context: 'Unknown lang' },
          ];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor')) {
          return [
            { contributor_id: 14, gallery_id: 7, theme_id: 0, category_id: 'partner',
              context: 'Name', src: '', href: '', alt: '', display_order: 1 },
          ];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner_i18n')) return [];
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner')) return [];
        return [];
      });
      context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

      const importer = new ThgContributorImporter(context);
      const result = await importer.import();

      expect(writeContributorTranslationMock).not.toHaveBeenCalled();
      expect(result.errors).toHaveLength(0); // only a warning, not an error
    });
  });

  describe('contributor categories (#2795)', () => {
    it('maps each legacy key to its own category and skips an unknown one', async () => {
      queryMock = vi.fn(async (sql: string) => {
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor_category')) {
          return [
            { category_id: 'cooperator', label: 'In cooperation with' },
            { category_id: 'occasion', label: 'On the occasion of' },
            { category_id: 'partner', label: 'Main contributors' },
            { category_id: 'sponsor', label: 'With the support of' },
            { category_id: 'patron', label: 'Under the patronage of' },
          ];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor_i18n')) return [];
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor')) {
          return ['cooperator', 'occasion', 'partner', 'sponsor', 'patron'].map((key, i) => ({
            contributor_id: 20 + i, gallery_id: 7, theme_id: 0, category_id: key,
            context: `Name ${i}`, src: '', href: '', alt: '', display_order: i,
          }));
        }
        return [];
      });
      context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

      const result = await new ThgContributorImporter(context).import();

      const categories = (writeContributorMock.mock.calls as { category: string }[][]).map(
        (args) => args[0]!.category
      );
      expect(categories).toEqual([
        'in_cooperation_with',
        'on_the_occasion_of',
        'main_contributors',
        'with_the_support_of',
      ]);
      expect(result.errors).toHaveLength(0);
    });
  });
  describe('contributor BC key uses correct theme table name', () => {
    it('resolves theme collection with mwnf3_thematic_gallery:theme: prefix — not thg_theme:', async () => {
      queryMock = vi.fn(async (sql: string) => {
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor_category')) {
          return [{ category_id: 'partner', label: 'Main contributors' }];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor_i18n')) {
          return [{ contributor_id: 15, language_id: 'en', context: 'Name' }];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.contributor')) {
          return [
            // theme_id=3 — should look up mwnf3_thematic_gallery:theme:7:3
            { contributor_id: 15, gallery_id: 7, theme_id: 3, category_id: 'partner',
              context: 'Name', src: '', href: '', alt: '', display_order: 1 },
          ];
        }
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner_i18n')) return [];
        if (sql.includes('FROM mwnf3_thematic_gallery.exhibition_partner')) return [];
        return [];
      });
      context = { ...context, legacyDb: { ...legacyDb, query: queryMock as ILegacyDatabase['query'] } };

      const importer = new ThgContributorImporter(context);
      const result = await importer.import();

      // Contributor should be created with theme collection as collection_id
      expect(writeContributorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          collection_id: 'theme-collection-uuid',
        })
      );
      expect(result.errors).toHaveLength(0);
    });
  });

  it('does not query exhibition_partner tables because those import as partners elsewhere', async () => {
    const importer = new ThgContributorImporter(context);
    const result = await importer.import();

    const queriedSql = queryMock.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(queriedSql.some((sql) => sql.includes('exhibition_partner'))).toBe(false);
    expect(result.errors).toHaveLength(0);
  });
});
