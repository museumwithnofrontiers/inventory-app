import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollectionTranslationColumnsImporter } from '../../src/importers/phase-11/collection-translation-columns-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import {
  COLLECTION_TRANSLATION_COLUMNS,
  splitCollectionTranslationColumns,
} from '../../src/utils/collection-translation-columns.js';

describe('splitCollectionTranslationColumns', () => {
  it('maps each key to its column and keeps the other keys', () => {
    const { extra, columns, kept, conflicts } = splitCollectionTranslationColumns({
      subtitle: 'From Damascus to Cairo',
      duration: 'One day',
      introd_type: 'L',
    });
    expect(columns).toEqual({ subtitle: 'From Damascus to Cairo', duration: 'One day' });
    expect(extra).toEqual({ introd_type: 'L' });
    expect(kept).toEqual([]);
    expect(conflicts).toEqual([]);
  });

  it('puts intro_text and introduction in the one introduction column, as written', () => {
    expect(splitCollectionTranslationColumns({ intro_text: ' The **Mamluks**. ' })).toEqual({
      extra: null,
      columns: { introduction: ' The **Mamluks**. ' },
      kept: [],
      conflicts: [],
    });
    expect(splitCollectionTranslationColumns({ introduction: 'The trail.' }).columns).toEqual({
      introduction: 'The trail.',
    });
  });

  it('moves nothing when a row holds both introductions', () => {
    const row = { intro_text: 'A', introduction: 'B', subtitle: 'S' };
    const { extra, columns, conflicts } = splitCollectionTranslationColumns(row);
    expect(columns).toEqual({});
    expect(extra).toEqual(row);
    expect(conflicts).toEqual(['introduction (intro_text, introduction)']);
  });

  it('leaves a value that is not a text in extra', () => {
    const { extra, columns, kept } = splitCollectionTranslationColumns({ subtitle: { en: 'x' } });
    expect(columns).toEqual({});
    expect(extra).toEqual({ subtitle: { en: 'x' } });
    expect(kept).toEqual(['subtitle']);
  });

  it('covers the keys of E1', () => {
    expect(COLLECTION_TRANSLATION_COLUMNS.map((c) => `${c.key}→${c.column}`)).toEqual([
      'subtitle→subtitle',
      'intro_text→introduction',
      'introduction→introduction',
      'duration→duration',
    ]);
  });
});

describe('CollectionTranslationColumnsImporter', () => {
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
        findCollectionTranslationsWithExtraKeys: findMock,
        setCollectionTranslationColumnsAsStoredById: setMock,
      } as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };
  });

  const row = (id: string, extra: Record<string, unknown>) => ({
    id,
    collection_id: 'c1',
    collection_backward_compatibility: null,
    language_id: 'eng',
    context_id: 'x1',
    extra,
  });

  it('asks for the four keys and writes each row once', async () => {
    findMock.mockResolvedValue([
      row('t1', { subtitle: 'S', legacy_exhibition: { show: 'y' } }),
      row('t2', { duration: 'One day' }),
    ]);

    const result = await new CollectionTranslationColumnsImporter(context).import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(2);
    expect(findMock).toHaveBeenCalledWith(['subtitle', 'intro_text', 'introduction', 'duration']);
    expect(setMock.mock.calls).toEqual([
      ['t1', { subtitle: 'S' }, JSON.stringify({ legacy_exhibition: { show: 'y' } })],
      ['t2', { duration: 'One day' }, null],
    ]);
  });

  it('reports a row with both introductions and leaves it as it is', async () => {
    findMock.mockResolvedValue([row('t1', { intro_text: 'A', introduction: 'B' })]);

    const result = await new CollectionTranslationColumnsImporter(context).import();

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('t1');
    expect(setMock).not.toHaveBeenCalled();
  });

  it('writes nothing on a dry run', async () => {
    findMock.mockResolvedValue([row('t1', { subtitle: 'S' })]);
    context.dryRun = true;

    const result = await new CollectionTranslationColumnsImporter(context).import();

    expect(result.imported).toBe(1);
    expect(setMock).not.toHaveBeenCalled();
  });
});
