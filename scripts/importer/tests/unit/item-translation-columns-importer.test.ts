import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemTranslationColumnsImporter } from '../../src/importers/phase-11/item-translation-columns-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import {
  ITEM_TRANSLATION_COLUMNS,
  splitItemTranslationColumns,
} from '../../src/utils/item-translation-columns.js';

describe('splitItemTranslationColumns', () => {
  it('maps each key to its column and keeps the other keys', () => {
    const { extra, columns, kept } = splitItemTranslationColumns({
      materials: 'Brass, engraved',
      description2: 'A basin.',
      province: 'Damascus',
      keywords: 'basin; brass',
    });
    expect(columns).toEqual({
      materials: 'Brass, engraved',
      short_description: 'A basin.',
      region: 'Damascus',
    });
    expect(extra).toEqual({ keywords: 'basin; brass' });
    expect(kept).toEqual([]);
  });

  it('keeps the text as written', () => {
    const { columns, extra } = splitItemTranslationColumns({ dynasty: ' Almohade. ' });
    expect(columns).toEqual({ dynasty: ' Almohade. ' });
    expect(extra).toBeNull();
  });

  it('leaves a value that is not a text in extra', () => {
    const { extra, columns, kept } = splitItemTranslationColumns({ history: { en: 'x' } });
    expect(columns).toEqual({});
    expect(extra).toEqual({ history: { en: 'x' } });
    expect(kept).toEqual(['history']);
  });

  it('covers the five keys of B1', () => {
    expect(ITEM_TRANSLATION_COLUMNS.map((c) => `${c.key}→${c.column}`)).toEqual([
      'materials→materials',
      'description2→short_description',
      'dynasty→dynasty',
      'province→region',
      'history→history',
    ]);
  });
});

describe('ItemTranslationColumnsImporter', () => {
  let context: ImportContext;
  let findMock: ReturnType<typeof vi.fn>;
  let setMock: ReturnType<typeof vi.fn>;

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

  const legacyDb: ILegacyDatabase = {
    query: vi.fn().mockResolvedValue([]) as ILegacyDatabase['query'],
    execute: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    findMock = vi.fn().mockResolvedValue([]);
    setMock = vi.fn().mockResolvedValue(undefined);
    context = {
      legacyDb,
      strategy: {
        findItemTranslationsWithExtraKeys: findMock,
        setItemTranslationColumnsAsStoredById: setMock,
      } as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };
  });

  it('asks for the five keys and writes each row once', async () => {
    findMock.mockResolvedValue([
      { id: 't1', extra: { materials: 'Glass', copyright: 'MWNF' } },
      { id: 't2', extra: { history: 'Built in 1277.' } },
    ]);

    const result = await new ItemTranslationColumnsImporter(context).import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(2);
    expect(findMock).toHaveBeenCalledWith([
      'materials',
      'description2',
      'dynasty',
      'province',
      'history',
    ]);
    expect(setMock.mock.calls).toEqual([
      ['t1', { materials: 'Glass' }, JSON.stringify({ copyright: 'MWNF' })],
      ['t2', { history: 'Built in 1277.' }, null],
    ]);
  });

  it('skips a row whose keys are not texts', async () => {
    findMock.mockResolvedValue([{ id: 't1', extra: { dynasty: ['Mamluk'] } }]);

    const result = await new ItemTranslationColumnsImporter(context).import();

    expect(result.skipped).toBe(1);
    expect(setMock).not.toHaveBeenCalled();
    expect(logger.warning).toHaveBeenCalled();
  });

  it('writes nothing on a dry run', async () => {
    findMock.mockResolvedValue([{ id: 't1', extra: { materials: 'Glass' } }]);
    context.dryRun = true;

    const result = await new ItemTranslationColumnsImporter(context).import();

    expect(result.imported).toBe(1);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('reports a failed row and carries on', async () => {
    findMock.mockResolvedValue([
      { id: 't1', extra: { materials: 'Glass' } },
      { id: 't2', extra: { materials: 'Wood' } },
    ]);
    setMock.mockRejectedValueOnce(new Error('lock wait timeout'));

    const result = await new ItemTranslationColumnsImporter(context).import();

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Item translation t1: lock wait timeout']);
    expect(setMock).toHaveBeenCalledTimes(2);
  });
});
