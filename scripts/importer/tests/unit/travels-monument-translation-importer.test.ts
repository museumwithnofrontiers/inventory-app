import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TravelsMonumentTranslationImporter,
  monumentCredits,
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

describe('monumentCredits (M16 I1)', () => {
  it('reads a plain name as the author, as written, and keeps nothing raw', () => {
    expect(monumentCredits('  Yusuf Natsheh ')).toEqual({
      authorName: 'Yusuf Natsheh',
      textCopyEditorName: null,
      translatorName: null,
      translationCopyEditorName: null,
      keepRaw: false,
    });
    expect(monumentTextExtra({ how_to_reach: null, info: null, contact: null, prepared_by: 'Yusuf Natsheh' })).toBeNull();
  });

  it('splits a text with role labels and keeps it raw', () => {
    const text = 'Author: Comité scientifique<br>Translator: Jane Doe';
    expect(monumentCredits(text)).toMatchObject({
      authorName: 'Comité scientifique',
      translatorName: 'Jane Doe',
      keepRaw: true,
    });
    expect(monumentTextExtra({ how_to_reach: null, info: null, contact: null, prepared_by: text })).toEqual({
      prepared_by: text,
    });
  });

  it('has nothing to credit without a text', () => {
    expect(monumentCredits(null)).toBeNull();
    expect(monumentCredits('  ')).toBeNull();
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
      findAuthorByName: vi.fn().mockResolvedValue(null),
      writeAuthor: vi.fn(async (data: { name: string }) => `author:${data.name}`),
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

  it('writes a plain prepared_by as the author, not into extra', async () => {
    (context.legacyDb.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { ...castle, prepared_by: 'Mário Pereira' },
    ]);

    await new TravelsMonumentTranslationImporter(context).import();

    expect(strategy.writeItemTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        author_id: 'author:Mário Pereira',
        translator_id: null,
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
