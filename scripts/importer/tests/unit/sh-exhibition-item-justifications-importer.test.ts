import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import { ShExhibitionItemJustificationsImporter } from '../../src/importers/phase-11/sh-exhibition-item-justifications-importer.js';

describe('ShExhibitionItemJustificationsImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let getExtraMock: ReturnType<typeof vi.fn>;
  let setExtraMock: ReturnType<typeof vi.fn>;
  let pivotExistsMock: ReturnType<typeof vi.fn>;

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

    // One object-theme relation with a justification, everything else empty.
    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_sharing_history.rel_objects_themes ')) {
        return [
          {
            id: 41,
            project_id: 'AWE',
            country: 'at',
            number: 7,
            container_id: 5,
            curator_status: 'Y',
          },
        ];
      }
      if (sql.includes('FROM mwnf3_sharing_history.rel_objects_themes_justification')) {
        return [
          {
            relation_id: 41,
            lang: 'en',
            justification_partner: 'Partner text',
            justification_curator: 'Curator text',
          },
          {
            relation_id: 41,
            lang: 'fr',
            justification_partner: null,
            justification_curator: 'Texte curateur',
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

    getExtraMock = vi.fn().mockResolvedValue(null);
    setExtraMock = vi.fn().mockResolvedValue(undefined);
    pivotExistsMock = vi.fn().mockResolvedValue(true);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      getCollectionItemExtra: getExtraMock,
      setCollectionItemExtra: setExtraMock,
      collectionItemPivotExists: pivotExistsMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };

    tracker.set('mwnf3_sharing_history:sh_exhibition_themes:5', 'theme-5-uuid', 'collection');
    tracker.set('mwnf3_sharing_history:sh_objects:awe:at:7', 'obj-uuid', 'item');
  });

  it('merges justifications and curator_status into the pivot extra', async () => {
    const importer = new ShExhibitionItemJustificationsImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(setExtraMock).toHaveBeenCalledTimes(1);
    expect(setExtraMock).toHaveBeenCalledWith('theme-5-uuid', 'obj-uuid', expect.any(String));

    const extra = JSON.parse(setExtraMock.mock.calls[0][2] as string) as Record<string, unknown>;
    expect(extra.curator_status).toBe('Y');
    expect(extra.justifications).toEqual({
      eng: { partner: 'Partner text', curator: 'Curator text' },
      fra: { partner: null, curator: 'Texte curateur' },
    });
    expect(result.imported).toBe(1);
  });

  it('preserves existing pivot extra fields', async () => {
    getExtraMock.mockResolvedValue({ some_field: 'kept' });

    const importer = new ShExhibitionItemJustificationsImporter(context);
    await importer.import();

    const extra = JSON.parse(setExtraMock.mock.calls[0][2] as string) as Record<string, unknown>;
    expect(extra.some_field).toBe('kept');
    expect(extra.curator_status).toBe('Y');
  });

  it('is a no-op on a second run (fields already merged)', async () => {
    getExtraMock.mockResolvedValue({
      justifications: {
        eng: { partner: 'Partner text', curator: 'Curator text' },
        fra: { partner: null, curator: 'Texte curateur' },
      },
      curator_status: 'Y',
    });

    const importer = new ShExhibitionItemJustificationsImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(setExtraMock).not.toHaveBeenCalled();
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips relations with neither justifications nor curator_status', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3_sharing_history.rel_objects_themes ')) {
        return [
          {
            id: 42,
            project_id: 'AWE',
            country: 'at',
            number: 7,
            container_id: 5,
            curator_status: null,
          },
        ];
      }
      return [];
    });

    const importer = new ShExhibitionItemJustificationsImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(setExtraMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('warns and skips when the pivot row does not exist', async () => {
    pivotExistsMock.mockResolvedValue(false);

    const importer = new ShExhibitionItemJustificationsImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining('Pivot not found'),
      undefined
    );
    expect(setExtraMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('warns and skips when the theme collection or item is unknown', async () => {
    tracker = new UnifiedTracker(); // wipe known entities
    context = { ...context, tracker };

    const importer = new ShExhibitionItemJustificationsImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(setExtraMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('reads all four relation sources', async () => {
    const importer = new ShExhibitionItemJustificationsImporter(context);
    await importer.import();

    const sqls = queryMock.mock.calls.map((c) => c[0] as string);
    for (const table of [
      'rel_objects_themes',
      'rel_objects_subthemes',
      'rel_monuments_themes',
      'rel_monuments_subthemes',
    ]) {
      expect(sqls.some((sql) => sql.includes(`FROM mwnf3_sharing_history.${table} `))).toBe(true);
      expect(sqls.some((sql) => sql.includes(`${table}_justification`))).toBe(true);
    }
  });

  it('performs no writes in dry-run mode', async () => {
    context = { ...context, dryRun: true };

    const importer = new ShExhibitionItemJustificationsImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(setExtraMock).not.toHaveBeenCalled();
    expect(result.imported).toBe(1);
  });
});
