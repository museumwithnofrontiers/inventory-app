import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShMonumentImporter } from '../../src/importers/phase-03/sh-monument-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import type { ShLegacyMonument, ShLegacyMonumentText } from '../../src/domain/types/index.js';

describe('ShMonumentImporter', () => {
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

  const monument: ShLegacyMonument = {
    project_id: 'AWE',
    country: 'pt',
    number: 51,
    partners_id: null,
  };

  const monumentText = (overrides: Partial<ShLegacyMonumentText> = {}): ShLegacyMonumentText =>
    ({
      project_id: 'AWE',
      country: 'pt',
      number: 51,
      lang: 'en',
      name: 'Belmonte Pessoa Manor House',
      description: 'A description',
      notice: 'This is an unedited Database entry<br/>and may contain errors.',
      architects: 'Francisco Silva Rocha',
      address: 'Aveiro',
      ...overrides,
    }) as ShLegacyMonumentText;

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.set('mwnf3_sharing_history:sh_projects:awe', 'awe-context-uuid', 'context');
    tracker.set('mwnf3_sharing_history:sh_projects:awe', 'awe-collection-uuid', 'collection');
    tracker.set('mwnf3_sharing_history:sh_projects:awe', 'awe-project-uuid', 'project');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_sharing_history.sh_monuments_texts')) {
        return [monumentText()];
      }
      if (sql.includes('FROM mwnf3_sharing_history.sh_monuments')) {
        return [monument];
      }
      return [];
    });

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
    const importer = new ShMonumentImporter(context);
    const result = await importer.import();

    expect(writeItemMock).toHaveBeenCalledTimes(1);
    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: 'new-item-uuid',
        context_id: 'awe-context-uuid',
        language_id: 'eng',
      })
    );
    expect(setExtraByContextMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
  });

  describe('when the item already exists', () => {
    beforeEach(() => {
      // writeItem/writeItemTranslation are both plain INSERTs — a second run
      // must not call either. entityExistsAsync/getEntityUuidAsync check the
      // tracker first, so seeding it here is what makes the item "existing".
      tracker.set('mwnf3_sharing_history:sh_monuments:awe:pt:51', 'existing-item-uuid', 'item');
    });

    it('refreshes extra instead of skipping — this is exactly how ShItemDisplayStatusImporter clobbered it before #1678', async () => {
      // The unscoped bug wiped this down to (at most) the display-status
      // flag, dropping notice/architects entirely.
      getExtraByContextMock.mockResolvedValue({});

      const importer = new ShMonumentImporter(context);
      const result = await importer.import();

      expect(writeItemMock).not.toHaveBeenCalled();
      expect(writeItemTranslationMock).not.toHaveBeenCalled();
      expect(getExtraByContextMock).toHaveBeenCalledWith(
        'existing-item-uuid',
        'eng',
        'awe-context-uuid'
      );
      expect(setExtraByContextMock).toHaveBeenCalledTimes(1);
      const [, , , writtenJson] = setExtraByContextMock.mock.calls[0]!;
      const written = JSON.parse(writtenJson as string) as Record<string, unknown>;
      expect(written.notice).toBe('This is an unedited Database entry  \nand may contain errors.');
      expect(written.architects).toBe('Francisco Silva Rocha');
      expect(written.monument_contact).toEqual({ address: 'Aveiro' });
      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
    });

    it('is a no-op when the stored extra already matches what would be written', async () => {
      getExtraByContextMock.mockResolvedValue({
        notice: 'This is an unedited Database entry  \nand may contain errors.',
        architects: 'Francisco Silva Rocha',
        monument_contact: { address: 'Aveiro' },
      });

      const importer = new ShMonumentImporter(context);
      const result = await importer.import();

      expect(setExtraByContextMock).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(1);
    });

    it('performs no writes in dry-run mode', async () => {
      context = { ...context, dryRun: true };

      const importer = new ShMonumentImporter(context);
      const result = await importer.import();

      expect(getExtraByContextMock).not.toHaveBeenCalled();
      expect(setExtraByContextMock).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });
  });
});
