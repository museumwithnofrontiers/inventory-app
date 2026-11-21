import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MonumentDetailImporter } from '../../src/importers/phase-01/monument-detail-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('MonumentDetailImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeItemMock: ReturnType<typeof vi.fn>;
  let writeItemTranslationMock: ReturnType<typeof vi.fn>;

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

  // A minimal monument detail row (one language version)
  const detailRow = {
    project_id: 'BAR',
    country_id: 'cz',
    institution_id: 'Ins01',
    monument_id: 'Mon11',
    detail_id: '23',
    lang_id: 'en',
    name: 'Detail Name',
    description: 'Detail description text',
    location: null,
    date: null,
    artist: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.setMetadata('default_context_id', 'default-context-uuid');

    // Required dependencies for a monument detail import
    tracker.set('mwnf3:projects:BAR', 'context-uuid', 'context');
    tracker.set('mwnf3:projects:BAR', 'collection-uuid', 'collection');
    tracker.set('mwnf3:institutions:Ins01:cz', 'partner-uuid', 'partner');
    tracker.set('mwnf3:projects:BAR', 'project-uuid', 'project');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_details')) {
        return [detailRow];
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

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeItem: writeItemMock,
      writeItemTranslation: writeItemTranslationMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('imports detail with parent_id set when parent monument is found in tracker', async () => {
    tracker.set('mwnf3:monuments:BAR:cz:Ins01:Mon11', 'parent-item-uuid', 'item');

    const importer = new MonumentDetailImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);

    expect(writeItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'detail',
        parent_id: 'parent-item-uuid',
        collection_id: 'collection-uuid',
        partner_id: 'partner-uuid',
        project_id: 'project-uuid',
        backward_compatibility: 'mwnf3:monument_details:BAR:cz:Ins01:Mon11:23',
      })
    );

    expect(logger.warning).not.toHaveBeenCalledWith(
      expect.stringContaining('Parent monument not found')
    );
  });

  it('imports detail with parent_id=null and emits a warning when parent monument is missing', async () => {
    // Parent monument NOT added to tracker — simulates missing parent

    const importer = new MonumentDetailImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);

    expect(writeItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'detail',
        parent_id: null,
        collection_id: 'collection-uuid',
        partner_id: 'partner-uuid',
        backward_compatibility: 'mwnf3:monument_details:BAR:cz:Ins01:Mon11:23',
      })
    );

    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining('Parent monument not found: mwnf3:monuments:BAR:cz:Ins01:Mon11'),
      undefined
    );
  });

  it('skips a detail left blank in every language instead of reporting an error', async () => {
    // An unused slot of the legacy detail editor: every content column empty.
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_details')) {
        return [
          {
            ...detailRow,
            detail_id: '5',
            name: '',
            description: '',
            location: null,
            date: '',
            artist: '',
          },
        ];
      }
      return [];
    });

    const importer = new MonumentDetailImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(writeItemMock).not.toHaveBeenCalled();

    expect(logger.skip).toHaveBeenCalledWith(
      expect.stringContaining('mwnf3:monument_details:BAR:cz:Ins01:Mon11:5')
    );
  });

  it('imports the populated details of a monument whose remaining slots are blank', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_details')) {
        return [
          detailRow,
          { ...detailRow, detail_id: '24', name: '', description: '', date: '', artist: '' },
          { ...detailRow, detail_id: '25', name: '', description: '', date: '', artist: '' },
        ];
      }
      return [];
    });

    const importer = new MonumentDetailImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(2);
    expect(writeItemMock).toHaveBeenCalledTimes(1);
  });

  it('still reports an error for a detail that has content but no name anywhere', async () => {
    // Not legacy padding but a real data problem: it must not be swallowed.
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_details')) {
        return [{ ...detailRow, name: '', description: 'A description with no name.' }];
      }
      return [];
    });

    const importer = new MonumentDetailImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('missing required name field in all translations');
    expect(writeItemMock).not.toHaveBeenCalled();
  });

  it('keeps each language artist line as written and makes no Artist from it', async () => {
    tracker.set('mwnf3:monuments:BAR:cz:Ins01:Mon11', 'parent-item-uuid', 'item');
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_details')) {
        return [
          {
            ...detailRow,
            lang_id: 'de',
            artist: 'Skulpturen: Ignaz Günther, Johann Baptist Straub',
          },
          {
            ...detailRow,
            lang_id: 'en',
            artist: 'Sculptures: Ignaz Günther, Johann Baptist Straub',
          },
        ];
      }
      return [];
    });
    // Record every strategy method the importer reaches for.
    const reached: string[] = [];
    const recording = new Proxy(strategy as object, {
      get(target, property, receiver) {
        reached.push(String(property));
        return Reflect.get(target, property, receiver);
      },
    }) as IWriteStrategy;

    const importer = new MonumentDetailImporter({ ...context, strategy: recording });
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(0);
    const artistLines = writeItemTranslationMock.mock.calls.map(
      ([data]) => JSON.parse((data as { extra: string }).extra).artist
    );
    expect(artistLines).toEqual([
      'Skulpturen: Ignaz Günther, Johann Baptist Straub',
      'Sculptures: Ignaz Günther, Johann Baptist Straub',
    ]);
    expect(reached.filter((name) => /artist/i.test(name))).toEqual([]);
  });

  it('still fails fast when project context is missing', async () => {
    // Remove context entry so contextId lookup fails
    tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.setMetadata('default_context_id', 'default-context-uuid');
    tracker.set('mwnf3:institutions:Ins01:cz', 'partner-uuid', 'partner');
    // context and collection NOT set for the project

    context = { ...context, tracker };

    const importer = new MonumentDetailImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('mwnf3:monument_details:BAR:cz:Ins01:Mon11:23');
    expect(writeItemMock).not.toHaveBeenCalled();
  });
});
