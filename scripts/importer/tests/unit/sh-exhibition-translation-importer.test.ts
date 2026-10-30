import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import {
  ShExhibitionTranslationImporter,
  extraOf,
} from '../../src/importers/phase-03/sh-exhibition-translation-importer.js';

describe('ShExhibitionTranslationImporter', () => {
  let tracker: UnifiedTracker;
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

  const rows: Record<string, unknown[]> = {
    sh_exhibitionnames: [
      {
        exhibition_id: 11,
        lang: 'en',
        title: 'Travelling',
        subtitle: '“The traveller sees what he sees.”',
        introduction: '<p>The many interconnections.</p>',
        curated_by: 'Matthias Pfaffenbichler<br/>',
        cover_images: 'Title: Posters<br/>',
        further_reading: '',
        see_also_links: null,
      },
    ],
    sh_exhibition_themenames: [
      {
        theme_id: 5,
        lang: 'en',
        title: 'Journeys',
        introduction: '<p>Overview.</p>',
        further_reading: '<p>A book.</p>',
        see_also_links: '',
      },
    ],
    sh_exhibition_subthemenames: [
      {
        subtheme_id: 7,
        lang: 'en',
        title: 'Royal visits',
        introduction: '<p>Visits.</p>',
        quotation: '<p>A quote.</p>',
        further_reading: '',
        see_also_links: '',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();

    const query = vi.fn(async (sql: string) => {
      for (const [table, result] of Object.entries(rows)) {
        if (sql.includes(`.${table}`)) return result;
      }
      if (sql.includes('FROM mwnf3_sharing_history.sh_exhibitions')) {
        return [{ exhibition_id: 11, project_id: 'AWE' }];
      }
      if (sql.includes('FROM mwnf3_sharing_history.sh_exhibition_themes')) {
        return [{ theme_id: 5, exhibition_id: 11 }];
      }
      if (sql.includes('FROM mwnf3_sharing_history.sh_exhibition_subthemes')) {
        return [{ subtheme_id: 7, theme_id: 5 }];
      }
      return [];
    });
    const legacyDb: ILegacyDatabase = {
      query: query as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeCollectionTranslationMock = vi.fn().mockResolvedValue(undefined);
    const strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeCollectionTranslation: writeCollectionTranslationMock,
    } as unknown as IWriteStrategy;

    context = { legacyDb, strategy, tracker, logger, dryRun: false };

    tracker.set('en', 'eng', 'language');
    tracker.set('mwnf3_sharing_history:sh_projects:awe', 'awe-context', 'context');
    tracker.set('mwnf3_sharing_history:sh_exhibitions:11', 'exh-11', 'collection');
    tracker.set('mwnf3_sharing_history:sh_exhibition_themes:5', 'theme-5', 'collection');
    tracker.set('mwnf3_sharing_history:sh_exhibition_subthemes:7', 'sub-7', 'collection');
  });

  const written = (collectionId: string) =>
    writeCollectionTranslationMock.mock.calls
      .map(([data]) => data)
      .find((data) => data.collection_id === collectionId);

  it("keeps an exhibition's introduction as its description and every other text in extra", async () => {
    const result = await new ShExhibitionTranslationImporter(context).import();

    expect(result.errors).toEqual([]);
    const exhibition = written('exh-11');
    expect(exhibition.title).toBe('Travelling');
    expect(exhibition.description).toBe('The many interconnections.');
    expect(JSON.parse(exhibition.extra)).toEqual({
      subtitle: '“The traveller sees what he sees.”',
      curated_by: 'Matthias Pfaffenbichler',
      cover_images: 'Title: Posters',
    });
  });

  it("keeps a theme's and a subtheme's texts each in its own field", async () => {
    await new ShExhibitionTranslationImporter(context).import();

    const theme = written('theme-5');
    expect(theme.description).toBe('Overview.');
    expect(JSON.parse(theme.extra)).toEqual({ further_reading: 'A book.' });

    const subtheme = written('sub-7');
    expect(subtheme.description).toBe('Visits.');
    expect(subtheme.quote).toBe('A quote.');
    expect(subtheme.extra).toBeNull();
  });

  it('writes no extra when every column is empty', () => {
    expect(extraOf({ subtitle: '', curated_by: null, cover_images: '  ' })).toBeNull();
  });
});
