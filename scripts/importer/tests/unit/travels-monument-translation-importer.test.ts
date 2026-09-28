import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TravelsMonumentTranslationImporter,
  monumentTextExtra,
} from '../../src/importers/phase-07/travels-monument-translation-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('monumentTextExtra', () => {
  it('keeps each of how_to_reach, info, contact and prepared_by only when set', () => {
    expect(
      monumentTextExtra({
        how_to_reach: 'The Castle is reached via Rua de Santa Maria.',
        info: ' ',
        contact: 'Câmara Municipal',
        prepared_by: null,
      })
    ).toEqual({
      how_to_reach: 'The Castle is reached via Rua de Santa Maria.',
      contact: 'Câmara Municipal',
    });
    expect(
      monumentTextExtra({ how_to_reach: '', info: null, contact: null, prepared_by: '' })
    ).toBeNull();
  });
});

describe('TravelsMonumentTranslationImporter', () => {
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

  const castle = {
    project_id: 'GPA',
    country: 'pt',
    itinerary_id: 'VIII',
    location_id: '7',
    number: 'a',
    lang: 'en',
    trail_id: 1,
    title: 'Castle',
    description: 'The Castle, like the town, was founded at the beginning of the 12th century.',
    how_to_reach: 'The Castle is reached via Rua de Santa Maria.',
    info: 'Designated a National Monument.',
    contact: '',
    prepared_by: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const tracker = new UnifiedTracker();
    tracker.set('mwnf3_travels:context', 'travels-context-uuid', 'context');
    tracker.set('mwnf3_travels:monument:GPA:pt:1:VIII:7:a', 'castle-uuid', 'item');
    tracker.set('en', 'eng', 'language');
    existing = new Set();

    strategy = {
      findByBackwardCompatibility: vi.fn(async (_table: string, bc: string) =>
        existing.has(bc) ? 'translation-uuid' : null
      ),
      writeItemTranslation: vi.fn().mockResolvedValue(undefined),
      setItemTranslationDescriptionByContext: vi.fn().mockResolvedValue(undefined),
      getItemTranslationExtraByContext: vi.fn().mockResolvedValue({ note: 'kept' }),
      setItemTranslationExtraByContext: vi.fn().mockResolvedValue(undefined),
    } as unknown as IWriteStrategy;

    context = {
      legacyDb: {
        query: vi.fn(async (sql: string) =>
          sql.includes('FROM mwnf3_travels.tr_monuments') ? [castle] : []
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

  it('imports the text and the visitor fields with the title', async () => {
    const result = await new TravelsMonumentTranslationImporter(context).import();

    expect(result.imported).toBe(1);
    expect(strategy.writeItemTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: 'castle-uuid',
        context_id: 'travels-context-uuid',
        name: 'Castle',
        description: castle.description,
        extra: JSON.stringify({ how_to_reach: castle.how_to_reach, info: castle.info }),
      })
    );
  });

  it('fills the text in on a translation imported before it was carried, in its own context only', async () => {
    existing.add('mwnf3_travels:monument:GPA:pt:1:VIII:7:a:translation:en');

    const result = await new TravelsMonumentTranslationImporter(context).import();

    expect(result.skipped).toBe(1);
    expect(strategy.writeItemTranslation).not.toHaveBeenCalled();
    expect(strategy.setItemTranslationDescriptionByContext).toHaveBeenCalledWith(
      'castle-uuid',
      'eng',
      'travels-context-uuid',
      castle.description
    );
    expect(strategy.setItemTranslationExtraByContext).toHaveBeenCalledWith(
      'castle-uuid',
      'eng',
      'travels-context-uuid',
      JSON.stringify({ note: 'kept', how_to_reach: castle.how_to_reach, info: castle.info })
    );
  });
});
