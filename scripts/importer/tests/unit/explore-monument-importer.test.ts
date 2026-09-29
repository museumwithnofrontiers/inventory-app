import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExploreMonumentImporter } from '../../src/importers/phase-06/explore-monument-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ExploreMonumentImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeItemMock: ReturnType<typeof vi.fn>;
  let writeCollectionItemMock: ReturnType<typeof vi.fn>;

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
    tracker.set('mwnf3_explore:location:2', 'location-collection-uuid', 'collection');
    tracker.set('mwnf3:monuments:IAM:eg:Mus01:5', 'canonical-item-uuid', 'item');
    tracker.setMetadata('default_language_id', 'eng');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_explore.exploremonument_vm')) {
        return [
          {
            monumentId: 123,
            REF_monuments_project_id: 'IAM',
            REF_monuments_country: 'eg',
            REF_monuments_institution_id: 'Mus01',
            REF_monuments_number: 5,
          },
        ];
      }

      if (sql.includes('FROM mwnf3_explore.exploremonument_tr')) {
        return [];
      }

      if (sql.includes('FROM mwnf3_explore.exploremonument_sh')) {
        return [];
      }

      if (sql.includes('FROM mwnf3_explore.exploremonumentext')) {
        return [
          {
            monumentId: 123,
            langId: 'en',
            name: 'Referenced monument',
          },
        ];
      }

      if (sql.includes('FROM mwnf3_explore.exploremonument')) {
        return [
          {
            monumentId: 123,
            locationId: 2,
            title: 'Referenced monument',
            geoCoordinates: null,
            zoom: null,
            special_monument: null,
            related_monument: null,
            countryId: 'eg',
            REF_tr_monuments_project_id: null,
            REF_tr_monuments_country: null,
            REF_tr_monuments_itinerary_id: null,
            REF_tr_monuments_location_id: null,
            REF_tr_monuments_number: null,
            REF_tr_monuments_lang: null,
            REF_tr_monuments_trail_id: null,
            REF_monuments_project_id: null,
            REF_monuments_country: null,
            REF_monuments_institution_id: null,
            REF_monuments_number: null,
            REF_monuments_lang: null,
          },
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

    writeItemMock = vi.fn();
    writeCollectionItemMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeItem: writeItemMock,
      writeCollectionItem: writeCollectionItemMock,
      getCollectionItemExtra: vi.fn().mockResolvedValue(null),
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('reuses the canonical source item for referenced Explore monuments instead of creating a shell item', async () => {
    const importer = new ExploreMonumentImporter(context);
    const result = await importer.import();

    expect(writeItemMock).not.toHaveBeenCalled();
    expect(writeCollectionItemMock).toHaveBeenCalledWith({
      collection_id: 'location-collection-uuid',
      item_id: 'canonical-item-uuid',
      display_order: null,
      extra: { explore_monument_ids: [123] },
    });
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
  });

  // The reused record's own key says nothing of Explore, so the location
  // membership is where legacy's monument id survives; the upsert replaces
  // `extra`, so what the membership already holds is merged, not lost.
  it("keeps legacy's monument id on the membership, merged with what it already holds", async () => {
    vi.mocked(strategy.getCollectionItemExtra).mockResolvedValue({ explore_monument_ids: [456], note: 'kept' });

    await new ExploreMonumentImporter(context).import();

    expect(writeCollectionItemMock).toHaveBeenCalledWith({
      collection_id: 'location-collection-uuid',
      item_id: 'canonical-item-uuid',
      display_order: null,
      extra: { explore_monument_ids: [123, 456], note: 'kept' },
    });
  });

  // The reused record's position is its own database's, if any: Explore's
  // position of the monument survives on the membership too, by monument id.
  it("keeps legacy's position of the monument on the membership, next to another monument's", async () => {
    const rows = queryMock.getMockImplementation() as (sql: string) => Promise<unknown>;
    queryMock.mockImplementation(async (sql: string) => {
      const result = (await rows(sql)) as Array<Record<string, unknown>>;
      return sql.includes('FROM mwnf3_explore.exploremonument m')
        ? result.map((row) => ({ ...row, geoCoordinates: '39.8584, -4.0236', zoom: 17 }))
        : result;
    });
    vi.mocked(strategy.getCollectionItemExtra).mockResolvedValue({
      explore_monument_ids: [456],
      explore_geo: { '456': { latitude: 1, longitude: 2, map_zoom: null } },
    });

    await new ExploreMonumentImporter(context).import();

    expect(writeCollectionItemMock).toHaveBeenCalledWith({
      collection_id: 'location-collection-uuid',
      item_id: 'canonical-item-uuid',
      display_order: null,
      extra: {
        explore_monument_ids: [123, 456],
        explore_geo: {
          '123': { latitude: 39.8584, longitude: -4.0236, map_zoom: 17 },
          '456': { latitude: 1, longitude: 2, map_zoom: null },
        },
      },
    });
  });

  it('drops a position legacy no longer has', async () => {
    vi.mocked(strategy.getCollectionItemExtra).mockResolvedValue({
      explore_monument_ids: [123],
      explore_geo: { '123': { latitude: 1, longitude: 2, map_zoom: null } },
    });

    await new ExploreMonumentImporter(context).import();

    expect(writeCollectionItemMock).toHaveBeenCalledWith(
      expect.objectContaining({ extra: { explore_monument_ids: [123] } })
    );
  });

  /**
   * The dedup guard for #1593. A referenced monument reuses an existing
   * BAR/Travels/Sharing-History item whose `country_id` is authoritative —
   * the Explore-derived country ('eg' on this row) must never be written over
   * it. The guard is structural: the referenced path never writes an item at
   * all, and nothing else may start writing a country there.
   */
  it('never writes a country onto the item a referenced monument reuses', async () => {
    const importer = new ExploreMonumentImporter(context);
    await importer.import();

    expect(writeItemMock).not.toHaveBeenCalled();
    expect(writeCollectionItemMock).toHaveBeenCalledTimes(1);
    expect(writeCollectionItemMock.mock.calls[0]![0]).not.toHaveProperty('country_id');
  });

  // Monument 777 matches no cross-reference table → native creation path.
  const nativeMonumentQuery = async (sql: string) => {
    if (
      sql.includes('FROM mwnf3_explore.exploremonument_vm') ||
      sql.includes('FROM mwnf3_explore.exploremonument_tr') ||
      sql.includes('FROM mwnf3_explore.exploremonument_sh')
    ) {
      return [];
    }
    if (sql.includes('FROM mwnf3_explore.exploremonumentext')) {
      return [{ monumentId: 777, langId: 'en', name: 'Native monument' }];
    }
    if (sql.includes('FROM mwnf3_explore.exploremonument')) {
      return [
        {
          monumentId: 777,
          locationId: 2,
          title: 'Native monument',
          geoCoordinates: null,
          zoom: null,
          special_monument: null,
          related_monument: null,
          countryId: 'in',
          REF_tr_monuments_project_id: null,
          REF_tr_monuments_country: null,
          REF_tr_monuments_itinerary_id: null,
          REF_tr_monuments_location_id: null,
          REF_tr_monuments_number: null,
          REF_tr_monuments_lang: null,
          REF_tr_monuments_trail_id: null,
          REF_monuments_project_id: null,
          REF_monuments_country: null,
          REF_monuments_institution_id: null,
          REF_monuments_number: null,
          REF_monuments_lang: null,
        },
      ];
    }
    return [];
  };

  it('links a monument imported before the Explore id was kept, on a re-run', async () => {
    tracker.set('mwnf3_explore:monument:777', 'native-item-uuid', 'item');
    queryMock = vi.fn(nativeMonumentQuery);
    context = {
      ...context,
      legacyDb: { query: queryMock as ILegacyDatabase['query'], execute: vi.fn(), connect: vi.fn(), disconnect: vi.fn() },
    };

    const result = await new ExploreMonumentImporter(context).import();

    expect(writeItemMock).not.toHaveBeenCalled();
    expect(writeCollectionItemMock).toHaveBeenCalledWith({
      collection_id: 'location-collection-uuid',
      item_id: 'native-item-uuid',
      display_order: null,
      extra: { explore_monument_ids: [777] },
    });
    expect(result.skipped).toBe(1);
  });

  it('derives country_id from the joined location for a natively created monument', async () => {
    queryMock = vi.fn(nativeMonumentQuery);

    context = {
      ...context,
      legacyDb: {
        query: queryMock as ILegacyDatabase['query'],
        execute: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      },
    };
    writeItemMock.mockResolvedValue('native-item-uuid');

    const result = await new ExploreMonumentImporter(context).import();

    expect(writeItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        backward_compatibility: 'mwnf3_explore:monument:777',
        country_id: 'ind',
      })
    );
    expect(writeCollectionItemMock).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: 'native-item-uuid', extra: { explore_monument_ids: [777] } })
    );
    expect(result.success).toBe(true);
  });

  it('joins the monument location so the legacy country code is available', async () => {
    await new ExploreMonumentImporter(context).import();

    const monumentCall = queryMock.mock.calls.find(
      (args: unknown[]) =>
        (args[0] as string).includes('FROM mwnf3_explore.exploremonument m') &&
        (args[0] as string).includes('LEFT JOIN mwnf3_explore.locations')
    );
    expect(monumentCall).toBeDefined();
    expect(monumentCall![0] as string).toContain('l.countryId');
  });

  it('logs info (not warning) when a monument resolves to multiple source candidates', async () => {
    // Monument 500 appears in both vm and travels tables → resolvedCandidates mode
    tracker.set('mwnf3:monuments:IAM:eg:Mus01:7', 'vm-candidate-uuid', 'item');
    tracker.set('mwnf3_travels:monument:IAM:pt:1:I:1:c', 'travels-candidate-uuid', 'item');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_explore.exploremonument_vm')) {
        return [
          {
            monumentId: 500,
            REF_monuments_project_id: 'IAM',
            REF_monuments_country: 'eg',
            REF_monuments_institution_id: 'Mus01',
            REF_monuments_number: 7,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_explore.exploremonument_tr')) {
        return [
          {
            monumentId: 500,
            REF_tr_monuments_project_id: 'IAM',
            REF_tr_monuments_country: 'pt',
            REF_tr_monuments_itinerary_id: 'I',
            REF_tr_monuments_location_id: '1',
            REF_tr_monuments_number: 'c',
            REF_tr_monuments_trail_id: 1,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_explore.exploremonument_sh')) return [];
      if (sql.includes('FROM mwnf3_explore.exploremonumentext')) {
        return [{ monumentId: 500, langId: 'en', name: 'Multi-candidate monument' }];
      }
      if (sql.includes('FROM mwnf3_explore.exploremonument')) {
        return [
          {
            monumentId: 500,
            locationId: 2,
            title: 'Multi-candidate monument',
            geoCoordinates: null,
            zoom: null,
            special_monument: null,
            related_monument: null,
            countryId: 'eg',
            REF_tr_monuments_project_id: null,
            REF_tr_monuments_country: null,
            REF_tr_monuments_itinerary_id: null,
            REF_tr_monuments_location_id: null,
            REF_tr_monuments_number: null,
            REF_tr_monuments_lang: null,
            REF_tr_monuments_trail_id: null,
            REF_monuments_project_id: null,
            REF_monuments_country: null,
            REF_monuments_institution_id: null,
            REF_monuments_number: null,
            REF_monuments_lang: null,
          },
        ];
      }
      return [];
    });

    context = {
      ...context,
      legacyDb: {
        query: queryMock as ILegacyDatabase['query'],
        execute: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      },
    };

    const importer = new ExploreMonumentImporter(context);
    await importer.import();

    // resolvedCandidates must NOT trigger a warning — it's expected multi-link behavior
    expect(logger.warning).not.toHaveBeenCalledWith(
      expect.stringContaining('resolves to multiple source items'),
      undefined
    );
    // But it should be logged at info level
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('resolves to multiple source items')
    );
  });
});