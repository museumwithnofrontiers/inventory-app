/**
 * Unit tests for ThgGalleryNativeProjectImporter (gap G1).
 *
 * Legacy gallery visibility is `native mwnf3 project items ∪ link-table members`.
 * These tests cover the native-project branch: it must attach the project's
 * objects and monuments to the gallery collection, deduplicate the per-language
 * rows of mwnf3.objects, and leave galleries without a native project alone.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThgGalleryNativeProjectImporter } from '../../src/importers/phase-10/thg-gallery-native-project-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ThgGalleryNativeProjectImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let attachItemsToCollectionMock: ReturnType<typeof vi.fn>;
  let setCollectionItemExtraMock: ReturnType<typeof vi.fn>;

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
    tracker.set('mwnf3_thematic_gallery:thg_gallery:9', 'collection-uuid-9', 'collection');
    tracker.set('mwnf3:objects:DCA:eg:Mus01:1', 'item-object-1', 'item');
    tracker.set('mwnf3:objects:DCA:eg:Mus01:2', 'item-object-2', 'item');
    tracker.set('mwnf3:monuments:DCA:eg:Mon01:7', 'item-monument-7', 'item');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery_mwnf3_objects')) {
        return [{ project_id: 'DCA', country: 'eg', museum_id: 'Mus01', number: 2 }];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery_mwnf3_monuments')) {
        return [];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery')) {
        return [{ gallery_id: 9, mwnf3_project_id: 'DCA' }];
      }
      if (sql.includes('FROM mwnf3.objects')) {
        return [
          { project_id: 'DCA', country: 'eg', museum_id: 'Mus01', number: 1 },
          { project_id: 'DCA', country: 'eg', museum_id: 'Mus01', number: 2 },
        ];
      }
      if (sql.includes('FROM mwnf3.monuments')) {
        return [{ project_id: 'DCA', country: 'eg', institution_id: 'Mon01', number: 7 }];
      }
      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    attachItemsToCollectionMock = vi.fn().mockResolvedValue(undefined);
    setCollectionItemExtraMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      attachItemsToCollection: attachItemsToCollectionMock,
      setCollectionItemExtra: setCollectionItemExtraMock,
    } as unknown as IWriteStrategy;

    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  it('attaches native objects and monuments of the gallery project to its collection', async () => {
    const importer = new ThgGalleryNativeProjectImporter(context);
    const result = await importer.import();

    expect(result.imported).toBe(3);
    expect(attachItemsToCollectionMock).toHaveBeenCalledTimes(1);
    expect(attachItemsToCollectionMock).toHaveBeenCalledWith('collection-uuid-9', [
      'item-object-1',
      'item-object-2',
      'item-monument-7',
    ]);
  });

  it('marks the items no link table lists as members through their project only', async () => {
    const importer = new ThgGalleryNativeProjectImporter(context);
    const result = await importer.import();

    expect(result.errors).toEqual([]);
    const marked = setCollectionItemExtraMock.mock.calls.map((args: unknown[]) => [args[1], args[2]]);
    expect(marked).toEqual([
      ['item-object-1', JSON.stringify({ membership: 'project' })],
      ['item-monument-7', JSON.stringify({ membership: 'project' })],
    ]);
  });

  it('selects DISTINCT identity columns because mwnf3 rows repeat per language', async () => {
    const importer = new ThgGalleryNativeProjectImporter(context);
    await importer.import();

    const objectSql = queryMock.mock.calls
      .map((args: unknown[]) => args[0] as string)
      .find((sql) => sql.includes('FROM mwnf3.objects'));
    expect(objectSql).toBeDefined();
    expect(objectSql).toContain('SELECT DISTINCT');
    expect(objectSql).not.toContain('lang');
  });

  it('scopes the native item query to the gallery project', async () => {
    const importer = new ThgGalleryNativeProjectImporter(context);
    await importer.import();

    const objectCall = queryMock.mock.calls.find((args: unknown[]) =>
      (args[0] as string).includes('FROM mwnf3.objects')
    );
    expect(objectCall![1]).toEqual(['DCA']);
  });

  it('does not attach the same item twice when it resolves more than once', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery')) {
        return [{ gallery_id: 9, mwnf3_project_id: 'DCA' }];
      }
      if (sql.includes('FROM mwnf3.objects')) {
        return [
          { project_id: 'DCA', country: 'eg', museum_id: 'Mus01', number: 1 },
          { project_id: 'DCA', country: 'eg', museum_id: 'Mus01', number: 1 },
        ];
      }
      return [];
    });

    const importer = new ThgGalleryNativeProjectImporter(context);
    await importer.import();

    expect(attachItemsToCollectionMock).toHaveBeenCalledWith('collection-uuid-9', [
      'item-object-1',
    ]);
  });

  it('warns and skips native items that were never imported', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3_thematic_gallery.thg_gallery')) {
        return [{ gallery_id: 9, mwnf3_project_id: 'DCA' }];
      }
      if (sql.includes('FROM mwnf3.objects')) {
        return [{ project_id: 'DCA', country: 'eg', museum_id: 'Mus99', number: 42 }];
      }
      return [];
    });

    const importer = new ThgGalleryNativeProjectImporter(context);
    const result = await importer.import();

    expect(result.imported).toBe(0);
    expect(attachItemsToCollectionMock).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([
      expect.stringContaining('mwnf3:objects:DCA:eg:Mus99:42'),
    ]);
  });

  it('only considers galleries that declare a native mwnf3 project', async () => {
    const importer = new ThgGalleryNativeProjectImporter(context);
    await importer.import();

    const gallerySql = queryMock.mock.calls
      .map((args: unknown[]) => args[0] as string)
      .find((sql) => sql.includes('FROM mwnf3_thematic_gallery.thg_gallery'));
    expect(gallerySql).toContain('mwnf3_project_id IS NOT NULL');
    expect(gallerySql).toContain("mwnf3_project_id != ''");
  });

  it('writes nothing in dry-run mode', async () => {
    context.dryRun = true;
    const importer = new ThgGalleryNativeProjectImporter(context);
    const result = await importer.import();

    expect(result.imported).toBe(3);
    expect(attachItemsToCollectionMock).not.toHaveBeenCalled();
  });
});
