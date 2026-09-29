import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ExploreItineraryImporter,
  itineraryExtra,
} from '../../src/importers/phase-06/explore-itinerary-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

// Legacy rows as `explore_itineraries` holds them (checked against the dump
// and the live API on 2026-09-28): 1 is a top-level thematic itinerary (type
// 4), 3 its first sub-itinerary, and 113 a top-level route of kind 1
// ("explore") that the live itineraries page does not list.
const ROWS = [
  {
    itineraries_id: 1,
    cycle: '1',
    country: 'tn',
    regionId: '',
    locationId: '',
    monumentId: '',
    parent_itineraries_id: null,
    type: '4',
    itinorder: 9,
    location_home_link: 'N',
    path: null,
    geoCoordinates: null,
    zoom: null,
  },
  {
    itineraries_id: 113,
    cycle: '',
    country: '',
    regionId: '',
    locationId: '',
    monumentId: '',
    parent_itineraries_id: null,
    type: '1',
    itinorder: 12,
    location_home_link: 'N',
    path: null,
    geoCoordinates: null,
    zoom: null,
  },
  {
    itineraries_id: 3,
    cycle: '1',
    country: 'tn',
    regionId: '',
    locationId: '',
    monumentId: '',
    parent_itineraries_id: 1,
    type: '4',
    itinorder: 1,
    location_home_link: 'N',
    path: null,
    geoCoordinates: null,
    zoom: null,
  },
];

describe('ExploreItineraryImporter', () => {
  let tracker: UnifiedTracker;
  let context: ImportContext;
  let writeCollection: ReturnType<typeof vi.fn>;
  let getCollectionExtra: ReturnType<typeof vi.fn>;
  let setCollectionExtra: ReturnType<typeof vi.fn>;

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
    tracker.set('mwnf3_explore:context', 'explore-context-uuid', 'context');
    tracker.set('mwnf3_explore:root:explore_by_itinerary', 'itinerary-root-uuid', 'collection');
    tracker.setMetadata('default_language_id', 'eng');

    const legacyDb: ILegacyDatabase = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM mwnf3_explore.explore_itineraries')) return ROWS;
        if (sql.includes('FROM mwnf3_explore.thematiccycle')) {
          return [{ cycleLabel: 'IHM', cycleDescription: 'Islamic Heritage of the Mediterranean' }];
        }
        return [];
      }) as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeCollection = vi.fn(async (data: { backward_compatibility: string }) => `${data.backward_compatibility}-uuid`);
    getCollectionExtra = vi.fn().mockResolvedValue(null);
    setCollectionExtra = vi.fn().mockResolvedValue(undefined);

    const strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeCollection,
      writeCollectionTranslation: vi.fn().mockResolvedValue(undefined),
      getCollectionExtra,
      setCollectionExtra,
    } as unknown as IWriteStrategy;

    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  const written = (id: number) =>
    writeCollection.mock.calls
      .map(([data]) => data)
      .find((data) => data.backward_compatibility === `mwnf3_explore:itinerary:${id}`);

  it("keeps each itinerary's legacy kind, order and home-link flag on the collection", async () => {
    const result = await new ExploreItineraryImporter(context).import();

    expect(result.success).toBe(true);
    expect(JSON.parse(written(1).extra)).toEqual({
      explore_itinerary: { type: '4', order: 9, location_home_link: 'N' },
    });
    // A top-level route of another kind stays top-level, as in legacy: only its
    // kind tells the exporter that the itineraries page does not list it.
    expect(written(113)).toMatchObject({ type: 'itinerary', parent_id: 'itinerary-root-uuid' });
    expect(JSON.parse(written(113).extra).explore_itinerary.type).toBe('1');
    expect(written(3)).toMatchObject({ type: 'exhibition trail', parent_id: 'mwnf3_explore:itinerary:1-uuid' });
    expect(JSON.parse(written(3).extra).explore_itinerary.order).toBe(1);
  });

  // The title it derives from the theme's name is not legacy's: every
  // translation comes from explore_itineraries_langs (ExploreItineraryContentImporter).
  it('writes no translation', async () => {
    await new ExploreItineraryImporter(context).import();

    expect(context.strategy.writeCollectionTranslation).not.toHaveBeenCalled();
  });

  it('adds the legacy fields to an itinerary imported before they were kept, keeping its other extra', async () => {
    tracker.set('mwnf3_explore:itinerary:1', 'existing-itinerary-uuid', 'collection');
    getCollectionExtra.mockImplementation(async (id: string) =>
      id === 'existing-itinerary-uuid' ? { note: 'kept' } : null
    );

    await new ExploreItineraryImporter(context).import();

    expect(written(1)).toBeUndefined();
    expect(setCollectionExtra).toHaveBeenCalledWith(
      'existing-itinerary-uuid',
      JSON.stringify({ note: 'kept', explore_itinerary: { type: '4', order: 9, location_home_link: 'N' } })
    );
  });

  it('writes nothing to an itinerary that already carries them', async () => {
    tracker.set('mwnf3_explore:itinerary:1', 'existing-itinerary-uuid', 'collection');
    getCollectionExtra.mockResolvedValue({ explore_itinerary: itineraryExtra(ROWS[0]!) });

    await new ExploreItineraryImporter(context).import();

    expect(setCollectionExtra).not.toHaveBeenCalledWith('existing-itinerary-uuid', expect.anything());
  });
});
