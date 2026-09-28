import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ExploreLocationTranslationImporter,
  historicalBackgroundKeys,
  parseTravelsReferences,
  uniqueContacts,
} from '../../src/importers/phase-06/explore-location-translation-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('parseTravelsReferences', () => {
  it('reads a picked Travels location as the key TravelsLocationImporter records', () => {
    expect(parseTravelsReferences('IAM;jo;V;1;en;1#1')).toEqual([
      'mwnf3_travels:location:IAM:jo:1:V:1',
    ]);
  });

  it('keeps the picks in their order, an unnumbered one last', () => {
    expect(
      parseTravelsReferences('GPA;pt;XII;5;en;1#-,IAM;pt;I;1;en;1#2,IAM;pt;II;3;en;1#1')
    ).toEqual([
      'mwnf3_travels:location:IAM:pt:1:II:3',
      'mwnf3_travels:location:IAM:pt:1:I:1',
      'mwnf3_travels:location:GPA:pt:1:XII:5',
    ]);
  });

  it('reads nothing from an empty or malformed value', () => {
    expect(parseTravelsReferences(null)).toEqual([]);
    expect(parseTravelsReferences('')).toEqual([]);
    expect(parseTravelsReferences('IAM;jo#1')).toEqual([]);
  });
});

describe('historicalBackgroundKeys', () => {
  const picked = 'mwnf3_travels:location:IAM:dz:1:IV:1';
  const matched = 'mwnf3_travels:location:IAM:dz:1:I:6';

  it('shows the picked Travels locations that have a text', () => {
    expect(historicalBackgroundKeys([picked], new Set([picked]), [matched])).toEqual([picked]);
  });

  it('shows nothing when the picked location has no text, rather than the name match', () => {
    expect(historicalBackgroundKeys([picked], new Set(), [matched])).toEqual([]);
  });

  it('falls back on the name match when nothing was picked', () => {
    expect(historicalBackgroundKeys([], new Set([picked]), [matched])).toEqual([matched]);
  });
});

describe('ExploreLocationTranslationImporter', () => {
  let tracker: UnifiedTracker;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let translationExtra: Record<string, unknown> | null;

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
    tracker.set('en', 'eng', 'language');
    for (const id of [16, 108, 209]) {
      tracker.set(`mwnf3_explore:location:${id}`, `location-${id}-uuid`, 'collection');
    }
    translationExtra = null;

    const query = vi.fn(async (sql: string) => {
      if (
        sql.includes('FROM mwnf3_explore.locationtranslated') &&
        sql.includes('spelling, description')
      ) {
        return [
          {
            locationId: 108,
            langId: 'en',
            spelling: 'Lamego',
            description: 'The city was important in distant times.',
            how_to_reach: null,
            info: null,
            contact: null,
            description_1: null,
            prepared_by: 'Pedro Dias',
          },
        ];
      }
      if (sql.includes('FROM mwnf3_explore.locations_contact')) {
        return [
          {
            locationId: 108,
            name: 'Tourist office',
            address: null,
            phone: '123',
            fax: null,
            email: null,
            website: null,
          },
        ];
      }
      if (sql.includes('SELECT locationId, et_loc_introduction')) {
        return [
          { locationId: 16, et_loc_introduction: 'IAM;jo;V;1;en;1#1' },
          // Picked, but its Travels location has no text: legacy shows none.
          { locationId: 209, et_loc_introduction: 'IAM;tr;I;9;en;1#1' },
        ];
      }
      if (sql.includes('SELECT DISTINCT project_id')) {
        return [{ project_id: 'IAM', country: 'jo', trail_id: 1, itinerary_id: 'V', number: '1' }];
      }
      if (sql.includes('JOIN mwnf3_travels.tr_locations trl')) {
        return [
          {
            locationId: 108,
            project_id: 'GPA',
            country: 'pt',
            trail_id: 1,
            itinerary_id: 'IV',
            number: '2',
          },
        ];
      }
      return [];
    });

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      getCollectionTranslationExtra: vi.fn(async () => translationExtra),
      // Stored the way the database gives it back: its JSON keeps an object's
      // keys in its own order, not the order they were written in.
      setCollectionTranslationExtra: vi.fn(async (_c: string, _l: string, extra: string) => {
        translationExtra = JSON.parse(extra, (_key, value) =>
          value && typeof value === 'object' && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).reverse())
            : value
        );
      }),
      setCollectionTranslationDescriptionByKey: vi.fn().mockResolvedValue(undefined),
      writeCollectionTranslation: vi.fn().mockResolvedValue(undefined),
      getCollectionExtra: vi.fn(async (id: string) =>
        id === 'location-16-uuid' ? { additional_regions: ['r1'] } : null
      ),
      setCollectionExtra: vi.fn().mockResolvedValue(undefined),
    } as unknown as IWriteStrategy;

    context = {
      legacyDb: {
        query: query as ILegacyDatabase['query'],
        execute: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      },
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it("gives the English row the location's own text", async () => {
    await new ExploreLocationTranslationImporter(context).import();

    expect(strategy.setCollectionTranslationDescriptionByKey).toHaveBeenCalledWith(
      'location-108-uuid',
      'eng',
      'explore-context-uuid',
      'The city was important in distant times.'
    );
    expect(translationExtra).toMatchObject({ prepared_by: 'Pedro Dias' });
  });

  it('records the historical background on the location, keeping its other extra', async () => {
    await new ExploreLocationTranslationImporter(context).import();

    const written = new Map(
      vi
        .mocked(strategy.setCollectionExtra)
        .mock.calls.map(([id, extra]) => [id, JSON.parse(extra)])
    );
    expect(written.get('location-16-uuid')).toEqual({
      additional_regions: ['r1'],
      historical_background: ['mwnf3_travels:location:IAM:jo:1:V:1'],
    });
    expect(written.get('location-108-uuid')).toEqual({
      historical_background: ['mwnf3_travels:location:GPA:pt:1:IV:2'],
    });
    expect(written.has('location-209-uuid')).toBe(false);
  });

  it('does not add a contact twice when run again', async () => {
    await new ExploreLocationTranslationImporter(context).import();
    await new ExploreLocationTranslationImporter(context).import();

    expect(translationExtra?.contacts).toEqual([{ name: 'Tourist office', phone: '123' }]);
  });

  it('drops the copy of a contact an earlier run added', async () => {
    const contact = { phone: '123', name: 'Tourist office' };
    translationExtra = { contacts: [contact, contact] };

    await new ExploreLocationTranslationImporter(context).import();

    expect(translationExtra?.contacts).toEqual([{ name: 'Tourist office', phone: '123' }]);
  });
});

describe('uniqueContacts', () => {
  it('treats contacts holding the same values in another key order as one', () => {
    expect(
      uniqueContacts([
        { name: 'Comune di Ariccia', phone: '+39 06 93 48 51' },
        { phone: '+39 06 93 48 51', name: 'Comune di Ariccia' },
        { name: 'Comune di Ariccia', phone: '+39 06 00 00 00' },
      ])
    ).toEqual([
      { name: 'Comune di Ariccia', phone: '+39 06 93 48 51' },
      { name: 'Comune di Ariccia', phone: '+39 06 00 00 00' },
    ]);
  });
});
