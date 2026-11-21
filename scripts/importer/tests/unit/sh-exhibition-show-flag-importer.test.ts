import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import { ShExhibitionShowFlagImporter } from '../../src/importers/phase-11/sh-exhibition-show-flag-importer.js';

describe('ShExhibitionShowFlagImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let setFlagsMock: ReturnType<typeof vi.fn>;
  let setExtraMock: ReturnType<typeof vi.fn>;

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

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_sharing_history.sh_exhibitionnames')) {
        return [{ exhibition_id: 1 }, { exhibition_id: 2 }];
      }
      if (sql.includes('FROM mwnf3_sharing_history.sh_exhibitions')) {
        return [
          { exhibition_id: 1, project_id: 'AWE', show: 'y', new_status: 'new' },
          { exhibition_id: 2, project_id: 'AWE', show: 'n', new_status: null },
          { exhibition_id: 3, project_id: 'AWE', show: 'y', new_status: null },
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

    setFlagsMock = vi.fn().mockResolvedValue(undefined);
    setExtraMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      setCollectionFlags: setFlagsMock,
      setCollectionTranslationExtra: setExtraMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };

    tracker.set('mwnf3_sharing_history:sh_exhibitions:1', 'exh-1-uuid', 'collection');
    tracker.set('mwnf3_sharing_history:sh_exhibitions:2', 'exh-2-uuid', 'collection');
    tracker.set('mwnf3_sharing_history:sh_exhibitions:3', 'exh-3-uuid', 'collection');
  });

  it('sets each exhibition draft from its show flag (n is a draft)', async () => {
    const result = await new ShExhibitionShowFlagImporter(context).import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(3);
    expect(setFlagsMock).toHaveBeenCalledWith('exh-1-uuid', { draft: false });
    expect(setFlagsMock).toHaveBeenCalledWith('exh-2-uuid', { draft: true });
    expect(setFlagsMock).toHaveBeenCalledWith('exh-3-uuid', { draft: false });
  });

  it('no longer writes legacy_exhibition into the translations', async () => {
    await new ShExhibitionShowFlagImporter(context).import();

    expect(setExtraMock).not.toHaveBeenCalled();
  });

  it('skips an exhibition whose show flag is neither y nor n', async () => {
    queryMock.mockImplementation(async (sql: string) =>
      sql.includes('FROM mwnf3_sharing_history.sh_exhibitions')
        ? [{ exhibition_id: 1, project_id: 'AWE', show: null, new_status: null }]
        : []
    );

    const result = await new ShExhibitionShowFlagImporter(context).import();

    expect(result.success).toBe(true);
    expect(setFlagsMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('skips exhibitions whose collection was never imported, with a warning', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3_sharing_history.sh_exhibitions')) {
        return [{ exhibition_id: 99, project_id: 'AWE', show: 'y', new_status: null }];
      }
      return [];
    });

    const result = await new ShExhibitionShowFlagImporter(context).import();

    expect(result.success).toBe(true);
    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining('mwnf3_sharing_history:sh_exhibitions:99'),
      undefined
    );
    expect(setFlagsMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('performs no writes in dry-run mode', async () => {
    context = { ...context, dryRun: true };

    const result = await new ShExhibitionShowFlagImporter(context).import();

    expect(result.success).toBe(true);
    expect(setFlagsMock).not.toHaveBeenCalled();
    expect(result.imported).toBe(3);
  });

  it('builds the list metadata for the exhibitions that have a text', async () => {
    const entries = await new ShExhibitionShowFlagImporter(context).siteConfiguration();

    expect(entries).toEqual([
      {
        collection: 'mwnf3_sharing_history:sh_exhibitions:1',
        translationExtra: { legacy_exhibition: { project_id: 'AWE', new_status: 'new' } },
      },
      {
        collection: 'mwnf3_sharing_history:sh_exhibitions:2',
        translationExtra: { legacy_exhibition: { project_id: 'AWE' } },
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining(
        'SELECT DISTINCT exhibition_id FROM mwnf3_sharing_history.sh_exhibitionnames'
      )
    );
  });
});
