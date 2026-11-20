import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MonumentImporter } from '../../src/importers/phase-01/monument-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import type { LegacyMonument } from '../../src/domain/types/index.js';

describe('MonumentImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeItemMock: ReturnType<typeof vi.fn>;
  let writeItemTranslationMock: ReturnType<typeof vi.fn>;
  let getExtraByContextMock: ReturnType<typeof vi.fn>;
  let setExtraByContextMock: ReturnType<typeof vi.fn>;

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

  const monumentRow = (overrides: Partial<LegacyMonument> = {}): LegacyMonument =>
    ({
      project_id: 'BAR',
      country: 'at',
      institution_id: 'Mon11',
      number: '33',
      lang: 'de',
      name: 'Pfarrkirche Anras',
      description: 'Eine Beschreibung',
      history: 'Erste Kirche<br/>zweite Zeile',
      ...overrides,
    }) as LegacyMonument;

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.set('mwnf3:projects:BAR', 'bar-context-uuid', 'context');
    tracker.set('mwnf3:projects:BAR', 'bar-collection-uuid', 'collection');
    tracker.set('mwnf3:projects:BAR', 'bar-project-uuid', 'project');
    tracker.set('mwnf3:institutions:Mon11:at', 'partner-uuid', 'partner');

    queryMock = vi.fn(async () => [monumentRow()]);

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeItemMock = vi.fn().mockResolvedValue('new-item-uuid');
    writeItemTranslationMock = vi.fn().mockResolvedValue(undefined);
    getExtraByContextMock = vi.fn().mockResolvedValue(null);
    setExtraByContextMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeItem: writeItemMock,
      writeItemTranslation: writeItemTranslationMock,
      attachItemsToCollection: vi.fn().mockResolvedValue(undefined),
      attachPartnersToCollection: vi.fn().mockResolvedValue(undefined),
      getItemTranslationExtraByContext: getExtraByContextMock,
      setItemTranslationExtraByContext: setExtraByContextMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('creates the item and its translation for a monument seen for the first time', async () => {
    const importer = new MonumentImporter(context);
    const result = await importer.import();

    expect(writeItemMock).toHaveBeenCalledTimes(1);
    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: 'new-item-uuid',
        language_id: 'deu',
        extra: JSON.stringify({ history: 'Erste Kirche  \nzweite Zeile' }),
      })
    );
    expect(setExtraByContextMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
  });

  it('leaves the item home in items.collection_id, with no collection_item row on the project collection (M16 J3)', async () => {
    const importer = new MonumentImporter(context);
    await importer.import();

    expect(writeItemMock).toHaveBeenCalledWith(
      expect.objectContaining({ collection_id: expect.any(String) })
    );
    expect(strategy.attachItemsToCollection).not.toHaveBeenCalled();
    expect(strategy.attachPartnersToCollection).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      'project'
    );
  });

  describe('when the item already exists', () => {
    beforeEach(() => {
      // writeItem/writeItemTranslation both plain INSERTs — a second run
      // must not call either. entityExistsAsync/getEntityUuidAsync check the
      // tracker first, so seeding it here is what makes the item "existing".
      tracker.set('mwnf3:monuments:BAR:at:Mon11:33', 'existing-item-uuid', 'item');
    });

    it('refreshes extra instead of skipping, converting HTML the earlier write missed', async () => {
      getExtraByContextMock.mockResolvedValue({ history: 'Erste Kirche<br/>zweite Zeile' });

      const importer = new MonumentImporter(context);
      const result = await importer.import();

      expect(writeItemMock).not.toHaveBeenCalled();
      expect(writeItemTranslationMock).not.toHaveBeenCalled();
      expect(getExtraByContextMock).toHaveBeenCalledWith(
        'existing-item-uuid',
        'deu',
        'bar-context-uuid'
      );
      expect(setExtraByContextMock).toHaveBeenCalledWith(
        'existing-item-uuid',
        'deu',
        'bar-context-uuid',
        JSON.stringify({ history: 'Erste Kirche  \nzweite Zeile' })
      );
      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
    });

    it('is a no-op when the stored extra already matches what would be written', async () => {
      getExtraByContextMock.mockResolvedValue({ history: 'Erste Kirche  \nzweite Zeile' });

      const importer = new MonumentImporter(context);
      const result = await importer.import();

      expect(setExtraByContextMock).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(1);
    });

    it('keeps the own and EPM context rows independent', async () => {
      const epmContextId = 'epm-context-uuid';
      tracker.set('mwnf3:projects:EPM', epmContextId, 'context');
      queryMock.mockResolvedValue([
        monumentRow({
          description: 'Eigener Kontext',
          description2: 'EPM-Kontext',
          history: 'Erste Kirche<br/>zweite Zeile',
        }),
      ]);
      // Own context already holds the converted value; EPM's is still stale —
      // each must be read and written through its own context, never the
      // other's.
      getExtraByContextMock.mockImplementation(
        async (_itemId: string, _languageId: string, contextId: string) =>
          contextId === epmContextId
            ? { history: 'Erste Kirche<br/>zweite Zeile' }
            : { history: 'Erste Kirche  \nzweite Zeile' }
      );

      const importer = new MonumentImporter(context);
      await importer.import();

      expect(setExtraByContextMock).toHaveBeenCalledTimes(1);
      expect(setExtraByContextMock).toHaveBeenCalledWith(
        'existing-item-uuid',
        'deu',
        epmContextId,
        JSON.stringify({ history: 'Erste Kirche  \nzweite Zeile' })
      );
    });

    it('performs no writes in dry-run mode', async () => {
      context = { ...context, dryRun: true };

      const importer = new MonumentImporter(context);
      const result = await importer.import();

      expect(getExtraByContextMock).not.toHaveBeenCalled();
      expect(setExtraByContextMock).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });
  });
});
