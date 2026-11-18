import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollectionCreditsImporter } from '../../src/importers/phase-11/collection-credits-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import {
  COLLECTION_CREDIT_KEYS,
  splitCollectionCredits,
} from '../../src/utils/collection-credits.js';

describe('splitCollectionCredits', () => {
  it('takes the credit keys off and keeps the others', () => {
    const { extra, credits, kept } = splitCollectionCredits({
      duration: '2 days',
      curated_by: 'Curated by\nGisela Helmecke',
      author: 'Mohamed Ali',
    });
    expect(extra).toEqual({ duration: '2 days' });
    expect(credits.map((c) => [c.credit.category, c.credit.field, c.text])).toEqual([
      ['author', 'name', 'Mohamed Ali'],
      ['curated_by', 'description', 'Curated by\nGisela Helmecke'],
    ]);
    expect(kept).toEqual([]);
  });

  it('moves an empty travels_author, which says the text names nobody', () => {
    const { extra, credits } = splitCollectionCredits({ travels_author: '' });
    expect(extra).toBeNull();
    expect(credits.map((c) => [c.credit.category, c.text])).toEqual([['travels_author', '']]);
  });

  it('leaves a value that is not a text in extra', () => {
    const { extra, credits, kept } = splitCollectionCredits({ credits: { en: 'x' } });
    expect(extra).toEqual({ credits: { en: 'x' } });
    expect(credits).toEqual([]);
    expect(kept).toEqual(['credits']);
  });

  it('covers the eight keys of the story', () => {
    expect([...COLLECTION_CREDIT_KEYS].sort()).toEqual(
      [
        'author',
        'travels_author',
        'credits',
        'curated_by',
        'photo_by',
        'local_coordinator',
        'prepared_by',
        'local_team',
      ].sort()
    );
  });
});

describe('CollectionCreditsImporter', () => {
  let context: ImportContext;
  let findMock: ReturnType<typeof vi.fn>;
  let setExtraMock: ReturnType<typeof vi.fn>;
  let writeContributorMock: ReturnType<typeof vi.fn>;
  let upsertMock: ReturnType<typeof vi.fn>;

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

  const row = (languageId: string, extra: Record<string, unknown>) => ({
    id: `ct-${languageId}`,
    collection_id: 'collection-uuid',
    collection_backward_compatibility: 'mwnf3_travels:trails:ISL;eg;1',
    language_id: languageId,
    context_id: 'context-uuid',
    extra,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    findMock = vi.fn().mockResolvedValue([]);
    setExtraMock = vi.fn().mockResolvedValue(undefined);
    writeContributorMock = vi.fn().mockResolvedValue('contributor-uuid');
    upsertMock = vi.fn().mockResolvedValue(undefined);

    context = {
      legacyDb,
      strategy: {
        findCollectionTranslationsWithExtraKeys: findMock,
        setCollectionTranslationExtraAsStoredById: setExtraMock,
        writeContributor: writeContributorMock,
        upsertContributorTranslationAsStored: upsertMock,
        findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      } as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };
  });

  it('makes one Contributor per collection and key, one translation per language', async () => {
    findMock.mockResolvedValue([
      row('eng', { curated_by: 'Curated by Ana', subtitle: 'The trail' }),
      row('fra', { curated_by: 'Sous la direction de Ana' }),
    ]);

    const result = await new CollectionCreditsImporter(context).import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(2);
    expect(writeContributorMock).toHaveBeenCalledTimes(1);
    expect(writeContributorMock).toHaveBeenCalledWith({
      collection_id: 'collection-uuid',
      category: 'curated_by',
      display_order: COLLECTION_CREDIT_KEYS.indexOf('curated_by') + 1,
      visible: true,
      backward_compatibility: 'mwnf3_travels:trails:ISL;eg;1#credit:curated_by',
      internal_name: 'Curated by',
    });

    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(
      upsertMock.mock.calls.map(([data]) => [data.language_id, data.name, data.description])
    ).toEqual([
      ['eng', null, 'Curated by Ana'],
      ['fra', null, 'Sous la direction de Ana'],
    ]);
    expect(upsertMock.mock.calls[0]![0].contributor_id).toBe('contributor-uuid');
    expect(upsertMock.mock.calls[0]![0].context_id).toBe('context-uuid');

    expect(setExtraMock.mock.calls).toEqual([
      ['ct-eng', JSON.stringify({ subtitle: 'The trail' })],
      ['ct-fra', null],
    ]);
  });

  it('puts a name in name, as written', async () => {
    findMock.mockResolvedValue([row('eng', { author: '  Mohamed Ali ' })]);

    await new CollectionCreditsImporter(context).import();

    expect(upsertMock.mock.calls[0]![0]).toMatchObject({
      name: '  Mohamed Ali ',
      description: null,
    });
  });

  it('writes nothing on a dry run', async () => {
    findMock.mockResolvedValue([row('eng', { author: 'Mohamed Ali' })]);
    context.dryRun = true;

    const result = await new CollectionCreditsImporter(context).import();

    expect(result.imported).toBe(1);
    expect(writeContributorMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
    expect(setExtraMock).not.toHaveBeenCalled();
  });

  it('reuses the Contributor a previous run made', async () => {
    findMock.mockResolvedValue([row('eng', { photo_by: 'Photos: Ana' })]);
    context.tracker.set(
      'mwnf3_travels:trails:ISL;eg;1#credit:photo_by',
      'existing-uuid',
      'contributor'
    );

    await new CollectionCreditsImporter(context).import();

    expect(writeContributorMock).not.toHaveBeenCalled();
    expect(upsertMock.mock.calls[0]![0].contributor_id).toBe('existing-uuid');
  });
});
