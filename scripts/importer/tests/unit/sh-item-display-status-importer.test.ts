import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import { ShItemDisplayStatusImporter } from '../../src/importers/phase-11/sh-item-display-status-importer.js';

describe('ShItemDisplayStatusImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let getLanguagesMock: ReturnType<typeof vi.fn>;
  let getExtraMock: ReturnType<typeof vi.fn>;
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
      if (sql.includes(`FROM mwnf3_sharing_history.sh_objects`)) {
        return [{ project_id: 'AWE', country: 'at', number: 7 }];
      }
      if (sql.includes(`FROM mwnf3_sharing_history.sh_monuments`)) {
        return [{ project_id: 'AWE', country: 'tn', number: 2 }];
      }
      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    getLanguagesMock = vi.fn().mockResolvedValue(['eng', 'fra']);
    getExtraMock = vi.fn().mockResolvedValue(null);
    setExtraMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      getItemTranslationLanguages: getLanguagesMock,
      getItemTranslationExtraByContext: getExtraMock,
      setItemTranslationExtraByContext: setExtraMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };

    tracker.set('mwnf3_sharing_history:sh_objects:awe:at:7', 'obj-uuid', 'item');
    tracker.set('mwnf3_sharing_history:sh_monuments:awe:tn:2', 'mon-uuid', 'item');
    tracker.set('mwnf3_sharing_history:sh_projects:awe', 'awe-context-uuid', 'context');
  });

  it('queries only display_status=N rows and stamps every translation language', async () => {
    const importer = new ShItemDisplayStatusImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    const sqls = queryMock.mock.calls.map((c) => c[0] as string);
    for (const sql of sqls) {
      expect(sql).toContain(`display_status = 'N'`);
    }

    // 2 items × 2 languages
    expect(setExtraMock).toHaveBeenCalledTimes(4);
    expect(getExtraMock).toHaveBeenCalledWith('obj-uuid', 'eng', 'awe-context-uuid');
    expect(setExtraMock).toHaveBeenCalledWith(
      'obj-uuid',
      'eng',
      'awe-context-uuid',
      JSON.stringify({ sh_display_status: 'N' })
    );
    expect(setExtraMock).toHaveBeenCalledWith(
      'mon-uuid',
      'fra',
      'awe-context-uuid',
      JSON.stringify({ sh_display_status: 'N' })
    );
    expect(result.imported).toBe(2);
  });

  it('merges without clobbering existing extra fields', async () => {
    getExtraMock.mockResolvedValue({ structured_bibliography: { eng: 'bib' } });

    const importer = new ShItemDisplayStatusImporter(context);
    await importer.import();

    const extra = JSON.parse(setExtraMock.mock.calls[0][3] as string) as Record<string, unknown>;
    expect(extra.structured_bibliography).toEqual({ eng: 'bib' });
    expect(extra.sh_display_status).toBe('N');
  });

  it('skips cleanly when the SH project context is missing', async () => {
    tracker = new UnifiedTracker();
    tracker.set('mwnf3_sharing_history:sh_objects:awe:at:7', 'obj-uuid', 'item');
    tracker.set('mwnf3_sharing_history:sh_monuments:awe:tn:2', 'mon-uuid', 'item');
    context = { ...context, tracker };

    const importer = new ShItemDisplayStatusImporter(context);
    const result = await importer.import();

    expect(setExtraMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(2);
  });

  it('reads and writes only the SH project context — the resolved item can carry a sibling context\'s row for the same language', async () => {
    const importer = new ShItemDisplayStatusImporter(context);
    await importer.import();

    for (const call of getExtraMock.mock.calls) {
      expect(call[2]).toBe('awe-context-uuid');
    }
    for (const call of setExtraMock.mock.calls) {
      expect(call[2]).toBe('awe-context-uuid');
    }
  });

  it('is a no-op on a second run (flag already present)', async () => {
    getExtraMock.mockResolvedValue({ sh_display_status: 'N' });

    const importer = new ShItemDisplayStatusImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(setExtraMock).not.toHaveBeenCalled();
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(2);
  });

  it('skips unknown items with a warning', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes(`FROM mwnf3_sharing_history.sh_objects`)) {
        return [{ project_id: 'AWE', country: 'xx', number: 999 }];
      }
      return [];
    });

    const importer = new ShItemDisplayStatusImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining('mwnf3_sharing_history:sh_objects:awe:xx:999'),
      undefined
    );
    expect(setExtraMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('performs no writes in dry-run mode', async () => {
    context = { ...context, dryRun: true };

    const importer = new ShItemDisplayStatusImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(setExtraMock).not.toHaveBeenCalled();
    expect(result.imported).toBe(2);
  });
});
