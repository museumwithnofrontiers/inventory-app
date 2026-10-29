import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import { ShExhibitionItemImporter } from '../../src/importers/phase-03/sh-exhibition-item-importer.js';

const PICTURE = 'sharing_history/sh_objects/awe/ua/81/1.jpg';

describe('ShExhibitionItemImporter, subtheme images', () => {
  let context: ImportContext;
  let writeCollectionItem: ReturnType<typeof vi.fn>;
  let subthemeImages: Record<string, unknown>[];

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
    subthemeImages = [
      {
        image_id: 1,
        subtheme_id: 91,
        image_item: 'AWE;ua;81',
        picture: PICTURE,
        item_type: 'obj',
        sort_order: 1,
        rel_sort_order: 2,
      },
    ];
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('.sh_exhibition_subtheme_images')) return subthemeImages;
      if (sql.includes('.sh_object_images')) {
        return [
          {
            project_id: 'AWE',
            country: 'ua',
            number: 81,
            type: '',
            image_number: 1,
            path: PICTURE,
          },
        ];
      }
      return [];
    });
    const legacyDb: ILegacyDatabase = {
      query: query as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeCollectionItem = vi.fn().mockResolvedValue(undefined);
    const strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeCollectionItem,
    } as unknown as IWriteStrategy;

    const tracker = new UnifiedTracker();
    tracker.set('mwnf3_sharing_history:sh_exhibition_subthemes:91', 'subtheme-91', 'collection');
    tracker.set('mwnf3_sharing_history:sh_objects:awe:ua:81', 'object-81', 'item');
    tracker.set('mwnf3_sharing_history:sh_object_images:awe:ua:81:_:1', 'picture-81-1', 'item');
    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  it('places the picture item legacy shows, at its position and view', async () => {
    const result = await new ShExhibitionItemImporter(context).import();

    expect(result.errors).toEqual([]);
    expect(writeCollectionItem).toHaveBeenCalledWith({
      collection_id: 'subtheme-91',
      item_id: 'picture-81-1',
      display_order: 1,
      extra: { n: 1, n2: 2 },
    });
  });

  it('places the record where no picture item has the path', async () => {
    subthemeImages[0]!.picture = 'sharing_history/sh_objects/awe/ua/81/9.jpg';
    const result = await new ShExhibitionItemImporter(context).import();

    expect(writeCollectionItem).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: 'object-81', extra: { n: 1, n2: 2 } })
    );
    expect(result.warnings?.some((w) => w.includes('no picture item'))).toBe(true);
  });
});
