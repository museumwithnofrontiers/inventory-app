import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TravelsLocationTranslationImporter,
  locationTextExtra,
} from '../../src/importers/phase-07/travels-location-translation-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('locationTextExtra', () => {
  it('keeps each of author, about and prepared_by only when set', () => {
    expect(locationTextExtra({ author: 'Fawzi Zayadine', about: ' ', prepared_by: null })).toEqual({
      author: 'Fawzi Zayadine',
    });
    expect(locationTextExtra({ author: null, about: null, prepared_by: '' })).toBeNull();
  });
});

describe('TravelsLocationTranslationImporter', () => {
  let tracker: UnifiedTracker;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let existing: Set<string>;

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

  const zoar = {
    project_id: 'IAM',
    country: 'jo',
    itinerary_id: 'V',
    number: 1,
    trail_id: 1,
    title: 'GHAWR AL-SAFI (ZOAR)',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('mwnf3_travels:context', 'travels-context-uuid', 'context');
    tracker.set('mwnf3_travels:location:IAM:jo:1:V:1', 'zoar-uuid', 'collection');
    tracker.set('en', 'eng', 'language');
    tracker.set('it', 'ita', 'language');
    existing = new Set();

    strategy = {
      findByBackwardCompatibility: vi.fn(async (_table: string, bc: string) =>
        existing.has(bc) ? 'translation-uuid' : null
      ),
      writeCollectionTranslation: vi.fn().mockResolvedValue(undefined),
      getCollectionTranslationByKey: vi
        .fn()
        .mockResolvedValue({ id: 'translation-uuid', extra: { note: 'kept' } }),
      setCollectionTranslationDescriptionByKey: vi.fn().mockResolvedValue(undefined),
      setCollectionTranslationExtraByKey: vi.fn().mockResolvedValue(undefined),
    } as unknown as IWriteStrategy;

    context = {
      legacyDb: {
        query: vi.fn(async (sql: string) =>
          sql.includes('FROM mwnf3_travels.tr_locations')
            ? [
                {
                  ...zoar,
                  lang: 'en',
                  description: 'The site of ancient Zoar is located at Khirbat Sheikh ‘Isa.',
                  author: 'Fawzi Zayadine',
                  about: null,
                  prepared_by: null,
                },
                {
                  ...zoar,
                  lang: 'it',
                  description: '',
                  author: null,
                  about: null,
                  prepared_by: null,
                },
              ]
            : []
        ) as ILegacyDatabase['query'],
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

  it('imports the introduction and its author with the title', async () => {
    const result = await new TravelsLocationTranslationImporter(context).import();

    expect(result.imported).toBe(2);
    expect(strategy.writeCollectionTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        language_id: 'eng',
        title: 'GHAWR AL-SAFI (ZOAR)',
        description: 'The site of ancient Zoar is located at Khirbat Sheikh ‘Isa.',
        extra: JSON.stringify({ author: 'Fawzi Zayadine' }),
      })
    );
    expect(strategy.writeCollectionTranslation).toHaveBeenCalledWith(
      expect.objectContaining({ language_id: 'ita', description: null, extra: null })
    );
  });

  it('fills the text in on a translation imported before it was carried', async () => {
    existing.add('mwnf3_travels:location:IAM:jo:1:V:1:translation:en');
    existing.add('mwnf3_travels:location:IAM:jo:1:V:1:translation:it');

    const result = await new TravelsLocationTranslationImporter(context).import();

    expect(result.skipped).toBe(2);
    expect(strategy.writeCollectionTranslation).not.toHaveBeenCalled();
    expect(strategy.setCollectionTranslationDescriptionByKey).toHaveBeenCalledTimes(1);
    expect(strategy.setCollectionTranslationDescriptionByKey).toHaveBeenCalledWith(
      'zoar-uuid',
      'eng',
      'travels-context-uuid',
      'The site of ancient Zoar is located at Khirbat Sheikh ‘Isa.'
    );
    expect(strategy.setCollectionTranslationExtraByKey).toHaveBeenCalledWith(
      'zoar-uuid',
      'eng',
      'travels-context-uuid',
      JSON.stringify({ note: 'kept', author: 'Fawzi Zayadine' })
    );
  });
});
