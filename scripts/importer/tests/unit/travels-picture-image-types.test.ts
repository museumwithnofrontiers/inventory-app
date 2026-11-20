import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TravelsTrailPictureImporter } from '../../src/importers/phase-07/travels-trail-picture-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

/**
 * M16 B8 (#2691): a trail picture's legacy type (cover, map, title) becomes an
 * `image-type` tag on its collection image, as written; no type, no tag.
 */
describe('TravelsTrailPictureImporter image types', () => {
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
  const picture = (imageNumber: number, type: string) => ({
    lang: 'en',
    country: 'tn',
    project_id: 'IAM',
    trail_id: 1,
    image_number: imageNumber,
    path: `trails/IAM/tn/1/${type || 'plain'}${imageNumber}.jpg`,
    thumb: null,
    caption: '',
    photographer: '',
    copyright: '',
    lastupdate: null,
    type,
  });

  let strategy: Record<string, ReturnType<typeof vi.fn>>;
  let context: ImportContext;

  beforeEach(() => {
    vi.clearAllMocks();
    const legacyDb: ILegacyDatabase = {
      query: vi
        .fn()
        .mockResolvedValue([picture(1, 'map'), picture(2, '')]) as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    strategy = {
      findByBackwardCompatibility: vi.fn(async (table: string) =>
        table === 'collections' ? 'col-1' : null
      ),
      imageExists: vi.fn().mockResolvedValue(null),
      writeCollectionImage: vi
        .fn()
        .mockResolvedValueOnce('img-map')
        .mockResolvedValueOnce('img-plain'),
      writeTag: vi.fn().mockResolvedValue('tag-map'),
      attachTagsToCollectionImage: vi.fn().mockResolvedValue(undefined),
    };
    const tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    context = {
      legacyDb,
      strategy: strategy as unknown as IWriteStrategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('tags the map with image-type map and leaves the untyped picture untagged', async () => {
    const result = await new TravelsTrailPictureImporter(context).import();

    expect(result.errors).toEqual([]);
    expect(strategy.writeTag).toHaveBeenCalledTimes(1);
    expect(strategy.writeTag!.mock.calls[0]![0]).toMatchObject({
      internal_name: 'map',
      category: 'image-type',
      language_id: 'eng',
    });
    expect(strategy.attachTagsToCollectionImage!.mock.calls).toEqual([['img-map', ['tag-map']]]);
  });
});
