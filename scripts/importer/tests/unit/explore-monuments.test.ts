import { describe, expect, it, vi } from 'vitest';
import { CollectionItemExploreMonumentsImporter } from '../../src/importers/phase-11/collection-item-explore-monuments-importer.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import {
  EXPLORE_MONUMENT_KEYS,
  exploreMonumentUuidName,
  splitExploreMonuments,
} from '../../src/utils/explore-monuments.js';

const LOCATION = 'mwnf3_explore:location:508';
const ITINERARY = 'mwnf3_explore:itinerary:12';

describe('splitExploreMonuments (M16 C4)', () => {
  it("makes a location's list one row per monument, with its coordinates and museums", () => {
    const { extra, monuments, kept } = splitExploreMonuments(
      {
        explore_geo: {
          '1275': { latitude: 34.030727, map_zoom: 16, longitude: -6.835677 },
        },
        explore_museums: { '1275': ['mwnf3:museums:Mus01_B:ma'] },
        explore_monument_ids: [1275, 1300],
      },
      LOCATION
    );
    expect(kept).toEqual([]);
    expect(extra).toBeNull();
    expect(monuments).toEqual([
      expect.objectContaining({
        position: 1,
        backward_compatibility: 'mwnf3_explore:monument:1275',
        latitude: 34.030727,
        longitude: -6.835677,
        map_zoom: 16,
        museum_keys: ['mwnf3:museums:Mus01_B:ma'],
        location_key: null,
      }),
      expect.objectContaining({
        position: 2,
        backward_compatibility: 'mwnf3_explore:monument:1300',
        latitude: null,
        museum_keys: [],
      }),
    ]);
  });

  it("makes an itinerary's monument one row with its location and references, as written", () => {
    const { extra, monuments } = splitExploreMonuments(
      {
        desc_types: 'ET#1,VM#2',
        tr_mn_desc: 'IAM;dz;III;2;b;en;1#1',
        vm_mn_desc: 'ISL;dz;Mon01;34;en;AL 43#2',
        location_id: 539,
        explore_monument_id: 1440,
        membership: 'x',
      },
      ITINERARY
    );
    expect(extra).toEqual({ membership: 'x' });
    expect(monuments).toEqual([
      expect.objectContaining({
        position: 1,
        backward_compatibility: 'mwnf3_explore:monument:1440',
        location_key: 'mwnf3_explore:location:539',
        description_types: 'ET#1,VM#2',
        travels_description_ref: 'IAM;dz;III;2;b;en;1#1',
        explore_description_ref: null,
        virtual_museum_description_ref: 'ISL;dz;Mon01;34;en;AL 43#2',
      }),
    ]);
  });

  it('keeps every key of a placement whose keys have another shape', () => {
    for (const [extra, collection] of [
      [{ explore_monument_ids: [1, 1] }, LOCATION],
      [{ explore_monument_ids: [1], explore_geo: { '2': { latitude: 1, longitude: 2, map_zoom: 3 } } }, LOCATION],
      [{ explore_monument_ids: [1], explore_geo: { '1': { latitude: 1, longitude: 2 } } }, LOCATION],
      [{ explore_monument_ids: [1], explore_museums: { '1': [] } }, LOCATION],
      [{ explore_monument_id: 1, location_id: 2 }, LOCATION],
      [{ explore_monument_ids: [1] }, ITINERARY],
      [{ explore_monument_id: 1 }, ITINERARY],
      [{ explore_monument_ids: [1] }, 'mwnf3:exhibitions:3'],
    ] as const) {
      const result = splitExploreMonuments({ ...extra }, collection);
      expect(result.monuments).toEqual([]);
      expect(result.extra).toEqual(extra);
      expect(result.kept).toHaveLength(1);
    }
  });

  it('leaves a placement without Explore keys as it is', () => {
    expect(splitExploreMonuments({ membership: 'project' }, LOCATION)).toEqual({
      extra: { membership: 'project' },
      monuments: [],
      kept: [],
    });
  });

  it('covers the C4 keys and names a row by its placement and position', () => {
    expect([...EXPLORE_MONUMENT_KEYS].sort()).toEqual(
      [
        'desc_types',
        'explore_geo',
        'explore_mn_desc',
        'explore_monument_id',
        'explore_monument_ids',
        'explore_museums',
        'location_id',
        'tr_mn_desc',
        'vm_mn_desc',
      ].sort()
    );
    expect(exploreMonumentUuidName('p-1', 2)).toBe('collection_item_explore_monument:p-1:2');
  });
});

describe('CollectionItemExploreMonumentsImporter', () => {
  function run(
    rows: Awaited<ReturnType<IWriteStrategy['findCollectionItemTextRows']>>,
    known: Record<string, string>
  ) {
    const strategy = {
      findCollectionItemTextRows: vi.fn().mockResolvedValue(rows),
      findByBackwardCompatibility: vi.fn(async (_table: string, key: string) => known[key] ?? null),
      replaceCollectionItemExploreMonuments: vi.fn().mockResolvedValue(undefined),
      setCollectionItemColumnsById: vi.fn().mockResolvedValue(undefined),
    };
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
    const context: ImportContext = {
      legacyDb: { query: vi.fn() } as unknown as ILegacyDatabase,
      strategy: strategy as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };
    return { importer: new CollectionItemExploreMonumentsImporter(context), strategy };
  }

  it('writes the rows with their resolved location and museums, then clears the keys', async () => {
    const { importer, strategy } = run(
      [
        {
          id: 'p-1',
          collection_backward_compatibility: ITINERARY,
          extra: { location_id: 539, explore_monument_id: 1440 },
        },
        {
          id: 'p-2',
          collection_backward_compatibility: LOCATION,
          extra: { explore_monument_ids: [1275], explore_museums: { '1275': ['mus-b', 'mus-a'] } },
        },
      ],
      { 'mwnf3_explore:location:539': 'loc-539', 'mus-a': 'partner-a', 'mus-b': 'partner-b' }
    );
    const result = await importer.import();
    expect(result.success).toBe(true);
    expect(result.imported).toBe(2);
    expect(strategy.replaceCollectionItemExploreMonuments).toHaveBeenCalledWith('p-1', [
      expect.objectContaining({ location_collection_id: 'loc-539', partner_ids: [] }),
    ]);
    expect(strategy.replaceCollectionItemExploreMonuments).toHaveBeenCalledWith('p-2', [
      expect.objectContaining({ location_collection_id: null, partner_ids: ['partner-b', 'partner-a'] }),
    ]);
    expect(strategy.setCollectionItemColumnsById).toHaveBeenCalledWith('p-1', {}, null);
  });

  it('keeps the keys of a placement whose museum does not resolve', async () => {
    const { importer, strategy } = run(
      [
        {
          id: 'p-3',
          collection_backward_compatibility: LOCATION,
          extra: { explore_monument_ids: [1], explore_museums: { '1': ['unknown'] } },
        },
      ],
      {}
    );
    const result = await importer.import();
    expect(result.skipped).toBe(1);
    expect(strategy.replaceCollectionItemExploreMonuments).not.toHaveBeenCalled();
    expect(strategy.setCollectionItemColumnsById).not.toHaveBeenCalled();
  });
});
