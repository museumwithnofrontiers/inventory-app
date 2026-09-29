import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ExploreCountryImporter,
  countryGeo,
} from '../../src/importers/phase-06/explore-country-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ExploreCountryImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeCollectionMock: ReturnType<typeof vi.fn>;
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

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('mwnf3_explore:context', 'explore-context-uuid', 'context');
    tracker.set('mwnf3_explore:root:explore_by_country', 'explore-country-root-uuid', 'collection');
    tracker.setMetadata('default_language_id', 'eng');

    queryMock = vi.fn(async (sql: string, values?: unknown) => {
      if (sql.includes('SELECT DISTINCT countryId FROM mwnf3_explore.locations')) {
        // As mwnf3_explore.countries holds Austria's position.
        return [{ countryId: 'at', geoCoordinates: '48.210033, 16.363449', zoom: 7 }];
      }

      if (sql.includes('SELECT name FROM mwnf3.countries WHERE country = ? LIMIT 1')) {
        if (Array.isArray(values) && values[0] === 'at') {
          return [{ name: 'Austria' }];
        }
      }

      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeCollectionMock = vi.fn().mockResolvedValue('explore-country-uuid');
    writeCollectionTranslationMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeCollection: writeCollectionMock,
      writeCollectionTranslation: writeCollectionTranslationMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('uses the resolved legacy country name and canonical country mapping', async () => {
    const importer = new ExploreCountryImporter(context);
    const result = await importer.import();

    expect(writeCollectionMock).toHaveBeenCalledWith({
      internal_name: 'Austria',
      backward_compatibility: 'mwnf3_explore:country:at',
      context_id: 'explore-context-uuid',
      language_id: 'eng',
      parent_id: 'explore-country-root-uuid',
      type: 'collection',
      latitude: 48.210033,
      longitude: 16.363449,
      map_zoom: 7,
      country_id: 'aut',
    });
    expect(writeCollectionTranslationMock).toHaveBeenCalledWith({
      collection_id: 'explore-country-uuid',
      language_id: 'eng',
      context_id: 'explore-context-uuid',
      backward_compatibility: 'mwnf3_explore:country:at:translation:eng',
      title: 'Austria',
      description: '',
    });
    expect(logger.warning).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
  });

  it('gives a country imported before its position was kept its position, on a re-run', async () => {
    tracker.set('mwnf3_explore:country:at', 'existing-country-uuid', 'collection');
    strategy.updateCollectionGeo = vi.fn().mockResolvedValue(undefined);

    const result = await new ExploreCountryImporter(context).import();

    expect(writeCollectionMock).not.toHaveBeenCalled();
    expect(strategy.updateCollectionGeo).toHaveBeenCalledWith(
      'existing-country-uuid',
      48.210033,
      16.363449,
      7
    );
    expect(result.skipped).toBe(1);
  });

  // Legacy keeps a zoom for every country, coordinates only for some.
  it('keeps no zoom for a country legacy has no coordinates for', () => {
    expect(countryGeo({ geoCoordinates: '', zoom: 5 })).toEqual({
      latitude: null,
      longitude: null,
      map_zoom: null,
    });
    expect(countryGeo({ geoCoordinates: ' 24.774265, 46.738586', zoom: 7 })).toEqual({
      latitude: 24.774265,
      longitude: 46.738586,
      map_zoom: 7,
    });
  });

  it('uses the resolved default language id instead of a hardcoded eng value', async () => {
    tracker.setMetadata('default_language_id', 'fra');

    const importer = new ExploreCountryImporter(context);
    await importer.import();

    expect(writeCollectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        language_id: 'fra',
      })
    );
    expect(writeCollectionTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        language_id: 'fra',
        backward_compatibility: 'mwnf3_explore:country:at:translation:fra',
      })
    );
  });

  it('fails explicitly when legacy country-name lookup errors instead of masking it as missing data', async () => {
    queryMock.mockImplementationOnce(async (sql: string) => {
      if (sql.includes('SELECT DISTINCT countryId FROM mwnf3_explore.locations')) {
        return [{ countryId: 'at' }];
      }

      return [];
    });
    queryMock.mockImplementationOnce(async () => {
      throw new Error('bad legacy query');
    });

    const importer = new ExploreCountryImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(false);
    expect(result.errors).toContain(
      'Error importing country at: Failed to resolve country name for Explore country at'
    );
  });
});
