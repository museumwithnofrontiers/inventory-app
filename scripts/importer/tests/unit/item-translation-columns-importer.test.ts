import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemTranslationColumnsImporter } from '../../src/importers/phase-11/item-translation-columns-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import {
  ITEM_TRANSLATION_COLUMN_KEYS,
  ITEM_TRANSLATION_COLUMNS,
  splitItemTranslationColumns,
} from '../../src/utils/item-translation-columns.js';

describe('splitItemTranslationColumns', () => {
  it('maps each key to its column and keeps the other keys', () => {
    const { extra, columns, kept } = splitItemTranslationColumns({
      materials: 'Brass, engraved',
      description2: 'A basin.',
      province: 'Damascus',
      copyright: 'MWNF',
    });
    expect(columns).toEqual({
      materials: 'Brass, engraved',
      short_description: 'A basin.',
      region: 'Damascus',
    });
    expect(extra).toEqual({ copyright: 'MWNF' });
    expect(kept).toEqual([]);
  });

  it('keeps the text as written', () => {
    const { columns, extra } = splitItemTranslationColumns({ dynasty: ' Almohade. ' });
    expect(columns).toEqual({ dynasty: ' Almohade. ' });
    expect(extra).toBeNull();
  });

  it('leaves a value that is not a text in extra', () => {
    const { extra, columns, kept } = splitItemTranslationColumns({ history: { en: 'x' } });
    expect(columns).toEqual({});
    expect(extra).toEqual({ history: { en: 'x' } });
    expect(kept).toEqual(['history']);
  });

  it('moves the credits as written into the four columns and drops the emptied object', () => {
    const { extra, columns, kept } = splitItemTranslationColumns({
      credits_as_written: {
        author: 'Mona al-Moadin - Zena Takieddine.',
        translator: 'Hilary Kalmbach (from the Arabic).',
      },
      copyright: 'MWNF',
    });
    expect(columns).toEqual({
      author_credit: 'Mona al-Moadin - Zena Takieddine.',
      translator_credit: 'Hilary Kalmbach (from the Arabic).',
    });
    expect(extra).toEqual({ copyright: 'MWNF' });
    expect(kept).toEqual([]);
  });

  it('keeps an unknown key inside credits_as_written', () => {
    const { extra, columns } = splitItemTranslationColumns({
      credits_as_written: { author: 'Ana', note: 'x' },
    });
    expect(columns).toEqual({ author_credit: 'Ana' });
    expect(extra).toEqual({ credits_as_written: { note: 'x' } });
  });

  it('moves prepared_by into author_credit, as written', () => {
    const { extra, columns } = splitItemTranslationColumns({
      prepared_by: 'Author: Curatorial committee (Farida Benouis)',
    });
    expect(columns).toEqual({ author_credit: 'Author: Curatorial committee (Farida Benouis)' });
    expect(extra).toBeNull();
  });

  it('keeps a second author credit in extra rather than lose one', () => {
    const { extra, columns, kept } = splitItemTranslationColumns({
      credits_as_written: { author: 'Ana' },
      prepared_by: 'Bea',
    });
    expect(columns).toEqual({ author_credit: 'Ana' });
    expect(extra).toEqual({ prepared_by: 'Bea' });
    expect(kept).toEqual(['prepared_by']);
  });

  it('moves the keyword and artist lines, as written', () => {
    const extra = {
      keywords: 'Basin; ablution',
      artist: 'Muhammad ibn al-Zayn',
      period_activity: 'About 1300',
      artist_birthdate: 'Unknown',
      scriber: 'Ibn al-Bawwab',
      patrons: 'Sultan al-Nasir Muhammad',
      copyright: 'MWNF',
    };
    expect(splitItemTranslationColumns(extra)).toEqual({
      extra: { copyright: 'MWNF' },
      columns: {
        keywords: 'Basin; ablution',
        artist: 'Muhammad ibn al-Zayn',
        artist_period_of_activity: 'About 1300',
        artist_birth_date: 'Unknown',
        scribe: 'Ibn al-Bawwab',
        patrons: 'Sultan al-Nasir Muhammad',
      },
      kept: [],
    });
  });

  it('moves the catalogue references and the notices, as written', () => {
    expect(
      splitItemTranslationColumns({
        linkcatalogs: 'Ifriqiya, pp. 174-176',
        notice: 'This is an unedited Database entry.',
        notice_c: 'Cet objet est disponible aussi sur Gallica.',
      })
    ).toEqual({
      extra: null,
      columns: {
        catalogue_references: 'Ifriqiya, pp. 174-176',
        notice: 'This is an unedited Database entry.',
        external_notice: 'Cet objet est disponible aussi sur Gallica.',
      },
      kept: [],
    });
  });

  it('maps legacy_display_status N to the hidden status', () => {
    expect(splitItemTranslationColumns({ legacy_display_status: 'N', copyright: 'MWNF' })).toEqual({
      extra: { copyright: 'MWNF' },
      columns: { status: 'hidden' },
      kept: [],
    });
  });

  it('keeps a legacy_display_status it has no status for in extra', () => {
    expect(splitItemTranslationColumns({ legacy_display_status: 'A' })).toEqual({
      extra: { legacy_display_status: 'A' },
      columns: {},
      kept: ['legacy_display_status'],
    });
  });

  it('covers the keys of B1 to B6', () => {
    expect(ITEM_TRANSLATION_COLUMNS.map((c) => `${c.key}→${c.column}`)).toEqual([
      'materials→materials',
      'description2→short_description',
      'dynasty→dynasty',
      'province→region',
      'history→history',
      'credits_as_written.author→author_credit',
      'credits_as_written.copy_editor→copy_editor_credit',
      'credits_as_written.translator→translator_credit',
      'credits_as_written.translation_copy_editor→translation_copy_editor_credit',
      'prepared_by→author_credit',
      'keywords→keywords',
      'artist→artist',
      'period_activity→artist_period_of_activity',
      'artist_birthdate→artist_birth_date',
      'artist_birthplace→artist_birth_place',
      'artist_deathdate→artist_death_date',
      'artist_deathplace→artist_death_place',
      'workshop→workshop',
      'scriber→scribe',
      'patrons→patrons',
      'architects→architects',
      'linkcatalogs→catalogue_references',
      'notice→notice',
      'notice_c→external_notice',
      'legacy_display_status→status',
    ]);
    expect(ITEM_TRANSLATION_COLUMN_KEYS).toEqual([
      'materials',
      'description2',
      'dynasty',
      'province',
      'history',
      'credits_as_written',
      'prepared_by',
      'keywords',
      'artist',
      'period_activity',
      'artist_birthdate',
      'artist_birthplace',
      'artist_deathdate',
      'artist_deathplace',
      'workshop',
      'scriber',
      'patrons',
      'architects',
      'linkcatalogs',
      'notice',
      'notice_c',
      'legacy_display_status',
    ]);
  });
});

describe('ItemTranslationColumnsImporter', () => {
  let context: ImportContext;
  let findMock: ReturnType<typeof vi.fn>;
  let setMock: ReturnType<typeof vi.fn>;

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

  beforeEach(() => {
    vi.clearAllMocks();
    findMock = vi.fn().mockResolvedValue([]);
    setMock = vi.fn().mockResolvedValue(undefined);
    context = {
      legacyDb,
      strategy: {
        findItemTranslationsWithExtraKeys: findMock,
        setItemTranslationColumnsAsStoredById: setMock,
      } as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };
  });

  it('asks for every mapped key and writes each row once', async () => {
    findMock.mockResolvedValue([
      { id: 't1', extra: { materials: 'Glass', copyright: 'MWNF' } },
      { id: 't2', extra: { history: 'Built in 1277.' } },
    ]);

    const result = await new ItemTranslationColumnsImporter(context).import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(2);
    expect(findMock).toHaveBeenCalledWith(ITEM_TRANSLATION_COLUMN_KEYS);
    expect(setMock.mock.calls).toEqual([
      ['t1', { materials: 'Glass' }, JSON.stringify({ copyright: 'MWNF' })],
      ['t2', { history: 'Built in 1277.' }, null],
    ]);
  });

  it('skips a row whose keys are not texts', async () => {
    findMock.mockResolvedValue([{ id: 't1', extra: { dynasty: ['Mamluk'] } }]);

    const result = await new ItemTranslationColumnsImporter(context).import();

    expect(result.skipped).toBe(1);
    expect(setMock).not.toHaveBeenCalled();
    expect(logger.warning).toHaveBeenCalled();
  });

  it('writes nothing on a dry run', async () => {
    findMock.mockResolvedValue([{ id: 't1', extra: { materials: 'Glass' } }]);
    context.dryRun = true;

    const result = await new ItemTranslationColumnsImporter(context).import();

    expect(result.imported).toBe(1);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('reports a failed row and carries on', async () => {
    findMock.mockResolvedValue([
      { id: 't1', extra: { materials: 'Glass' } },
      { id: 't2', extra: { materials: 'Wood' } },
    ]);
    setMock.mockRejectedValueOnce(new Error('lock wait timeout'));

    const result = await new ItemTranslationColumnsImporter(context).import();

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Item translation t1: lock wait timeout']);
    expect(setMock).toHaveBeenCalledTimes(2);
  });
});
