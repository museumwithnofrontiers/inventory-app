import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollectionRelationsImporter } from '../../src/importers/phase-11/collection-relations-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import {
  backgroundKeysOf,
  countryIdsOf,
  coverPictureOf,
  daysOf,
  legacyKeysOf,
  roundTripCountryId,
} from '../../src/utils/collection-relations.js';

describe('collection relation values', () => {
  it('maps the country codes in use to ISO3, in order', () => {
    expect(countryIdsOf(['jo', 'pa', 'it', 'ab'])).toEqual(['jor', 'pse', 'ita', 'alb']);
  });

  it('keeps a list with an alias code, an unknown code or a repeat', () => {
    expect(roundTripCountryId('ix')).toBeNull();
    expect(roundTripCountryId('px')).toBeNull();
    expect(countryIdsOf(['it', 'ix'])).toBeNull();
    expect(countryIdsOf(['zz'])).toBeNull();
    expect(countryIdsOf(['jo', 'jo'])).toBeNull();
    expect(countryIdsOf([])).toBeNull();
  });

  it('gives the legacy keys of Explore ids, in order', () => {
    expect(legacyKeysOf([10, 23], 'mwnf3_explore:location:')).toEqual([
      'mwnf3_explore:location:10',
      'mwnf3_explore:location:23',
    ]);
    expect(legacyKeysOf(['10'], 'mwnf3_explore:location:')).toBeNull();
    expect(legacyKeysOf([], 'mwnf3_explore:location:')).toBeNull();
  });

  it('reads the background keys, the cover picture and the days', () => {
    expect(backgroundKeysOf(['mwnf3_travels:location:IAM:tn:1:III:5'])).toEqual([
      'mwnf3_travels:location:IAM:tn:1:III:5',
    ]);
    expect(coverPictureOf({ cover_picture: { item_id: 'i1', backward_compatibility: 'k' } })).toEqual({
      item_id: 'i1',
      backward_compatibility: 'k',
    });
    expect(coverPictureOf({ cover_picture: { item_id: 'i1', backward_compatibility: 'k' }, x: 1 })).toBeNull();
    expect(daysOf(3)).toBe(3);
    expect(daysOf('3')).toBeNull();
  });
});

describe('CollectionRelationsImporter', () => {
  let context: ImportContext;
  let strategy: Record<string, ReturnType<typeof vi.fn>>;

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

  const known: Record<string, string> = {
    'mwnf3_explore:location:10': 'loc-10',
    'mwnf3_explore:location:23': 'loc-23',
    'mwnf3_travels:location:IAM:tn:1:III:5': 'bg-1',
    'mwnf3:objects_pictures:X:1': 'item-1',
  };

  const translation = (id: string, extra: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
    id,
    collection_id: 'c1',
    collection_backward_compatibility: 'mwnf3_explore:itinerary:1',
    collection_context_id: 'x-explore',
    language_id: 'eng',
    context_id: 'x-explore',
    extra,
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = {
      findCollectionTranslationsWithExtraKeys: vi.fn().mockResolvedValue([]),
      findCollectionsWithExtraKeys: vi.fn().mockResolvedValue([]),
      findByBackwardCompatibility: vi.fn(async (_table: string, key: string) => known[key] ?? null),
      replaceCollectionCountries: vi.fn(),
      replaceCollectionLinks: vi.fn(),
      setCollectionTranslationExtraAsStoredById: vi.fn(),
      setCollectionRelationColumnsAsStored: vi.fn(),
    };
    context = {
      legacyDb,
      strategy: strategy as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };
  });

  it('moves the lists of the English text in its own context', async () => {
    strategy.findCollectionTranslationsWithExtraKeys!.mockResolvedValue([
      translation('t1', { country_ids: ['jo'], location_ids: [10, 23], introd_type: 'L' }),
    ]);

    const result = await new CollectionRelationsImporter(context).import();

    expect(result.success).toBe(true);
    expect(strategy.replaceCollectionCountries).toHaveBeenCalledWith('c1', ['jor']);
    expect(strategy.replaceCollectionLinks).toHaveBeenCalledWith('c1', 'location', ['loc-10', 'loc-23']);
    expect(strategy.setCollectionTranslationExtraAsStoredById).toHaveBeenCalledWith(
      't1',
      JSON.stringify({ introd_type: 'L' })
    );
  });

  it('keeps an alias-coded list or an id that resolves to nothing in extra', async () => {
    strategy.findCollectionTranslationsWithExtraKeys!.mockResolvedValue([
      translation('t1', { country_ids: ['ix'], location_ids: [99] }),
    ]);

    const result = await new CollectionRelationsImporter(context).import();

    expect(result.skipped).toBe(1);
    expect(strategy.replaceCollectionCountries).not.toHaveBeenCalled();
    expect(strategy.replaceCollectionLinks).not.toHaveBeenCalled();
    expect(strategy.setCollectionTranslationExtraAsStoredById).not.toHaveBeenCalled();
    expect(logger.warning).toHaveBeenCalledTimes(2);
  });

  it('reports a list on another translation and leaves it', async () => {
    strategy.findCollectionTranslationsWithExtraKeys!.mockResolvedValue([
      translation('t1', { country_ids: ['jo'] }, { language_id: 'spa' }),
    ]);

    const result = await new CollectionRelationsImporter(context).import();

    expect(result.success).toBe(false);
    expect(strategy.replaceCollectionCountries).not.toHaveBeenCalled();
  });

  it('moves the background, cover picture and days of a collection', async () => {
    strategy.findCollectionsWithExtraKeys!.mockResolvedValue([
      {
        id: 'c2',
        extra: {
          historical_background: ['mwnf3_travels:location:IAM:tn:1:III:5'],
          thg_theme: { cover_picture: { item_id: 'item-1', backward_compatibility: 'mwnf3:objects_pictures:X:1' } },
          days: 2,
          logos: [{ file: 'a.png' }],
        },
      },
    ]);

    const result = await new CollectionRelationsImporter(context).import();

    expect(result.success).toBe(true);
    expect(strategy.replaceCollectionLinks).toHaveBeenCalledWith('c2', 'historical_background', ['bg-1']);
    expect(strategy.setCollectionRelationColumnsAsStored).toHaveBeenCalledWith(
      'c2',
      { cover_item_id: 'item-1', days: 2 },
      JSON.stringify({ logos: [{ file: 'a.png' }] })
    );
  });

  it('keeps a cover picture whose legacy key resolves to another item', async () => {
    strategy.findCollectionsWithExtraKeys!.mockResolvedValue([
      { id: 'c2', extra: { thg_theme: { cover_picture: { item_id: 'other', backward_compatibility: 'mwnf3:objects_pictures:X:1' } } } },
    ]);

    const result = await new CollectionRelationsImporter(context).import();

    expect(result.skipped).toBe(1);
    expect(strategy.setCollectionRelationColumnsAsStored).not.toHaveBeenCalled();
  });

  it('writes nothing on a dry run', async () => {
    strategy.findCollectionTranslationsWithExtraKeys!.mockResolvedValue([translation('t1', { country_ids: ['jo'] })]);
    strategy.findCollectionsWithExtraKeys!.mockResolvedValue([{ id: 'c2', extra: { days: 2 } }]);
    context.dryRun = true;

    const result = await new CollectionRelationsImporter(context).import();

    expect(result.imported).toBe(2);
    expect(strategy.replaceCollectionCountries).not.toHaveBeenCalled();
    expect(strategy.setCollectionRelationColumnsAsStored).not.toHaveBeenCalled();
  });
});
