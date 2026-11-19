import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageTextsImporter } from '../../src/importers/phase-11/image-texts-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import { planImageTexts } from '../../src/utils/image-texts.js';

const IMG = 'mwnf3_sharing_history:sh_countries_historicalbackground_images:';

describe('planImageTexts', () => {
  const imagePaths = new Map([
    [155, 'custom/sharinghistory/31.jpg'],
    [16, 'custom/sharinghistory/2.jpg'],
  ]);
  const mapPaths = new Map([[3, 'sharing_history/sh_historical_profile/awe/11/maps/1.jpg']]);
  const images: Record<string, string> = {
    'page:custom/sharinghistory/31.jpg': 'img-31',
    'profile:sharing_history/sh_historical_profile/awe/11/maps/1.jpg': 'map-1',
  };
  const find = (collectionId: string, path: string): string | null =>
    images[`${collectionId}:${path}`] ?? null;

  it('gives each caption to its image in its four fields, as written, and empties the key', () => {
    const plan = planImageTexts(
      [
        {
          id: 't1',
          collection_id: 'page',
          extra: {
            image_captions: {
              [`${IMG}155`]: {
                eng: {
                  date: '1845',
                  name: 'Map of Spain, with provinces',
                  museum: 'National Museum',
                  location: 'Madrid, Spain',
                },
              },
            },
            further_reading: 'x',
          },
        },
      ],
      imagePaths,
      mapPaths,
      find
    );

    expect(plan.texts).toEqual([
      {
        image_id: 'img-31',
        language_id: 'eng',
        caption: null,
        name: 'Map of Spain, with provinces',
        date: '1845',
        museum: 'National Museum',
        location: 'Madrid, Spain',
        backward_compatibility: `${IMG}155`,
      },
    ]);
    expect(plan.updates).toEqual([{ id: 't1', extra: { further_reading: 'x' } }]);
    expect(plan.kept).toEqual([]);
  });

  it('keeps a caption whose image is not found, or with a field the model lacks', () => {
    const plan = planImageTexts(
      [
        {
          id: 't1',
          collection_id: 'page',
          extra: {
            image_captions: {
              [`${IMG}16`]: { eng: { name: 'Qatrana Fortress' } },
              [`${IMG}155`]: { eng: { name: 'Map', sname: 'Short' } },
            },
          },
        },
      ],
      imagePaths,
      mapPaths,
      find
    );

    expect(plan.texts).toEqual([]);
    expect(plan.updates).toEqual([]);
    expect(plan.kept.map((k) => k.reason)).toEqual([
      'no image of the page has its legacy path',
      'a field the model has no column for',
    ]);
  });

  it("gives each map description to the map's image as its caption", () => {
    const plan = planImageTexts(
      [
        {
          id: 't2',
          collection_id: 'profile',
          extra: { map_descriptions: { map_3: { eng: '1815' }, map_9: { eng: '1878' } } },
        },
      ],
      imagePaths,
      mapPaths,
      find
    );

    expect(plan.texts).toEqual([
      expect.objectContaining({
        image_id: 'map-1',
        language_id: 'eng',
        caption: '1815',
        backward_compatibility: 'mwnf3_sharing_history:sh_countries_historicalbackground_maps:3',
      }),
    ]);
    expect(plan.updates).toEqual([
      { id: 't2', extra: { map_descriptions: { map_9: { eng: '1878' } } } },
    ]);
    expect(plan.kept).toHaveLength(1);
  });
});

describe('ImageTextsImporter', () => {
  let context: ImportContext;
  let strategy: Record<string, ReturnType<typeof vi.fn>>;
  let legacyQuery: ReturnType<typeof vi.fn>;

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
    legacyQuery = vi.fn(async (sql: string) =>
      sql.includes('_maps') ? [] : [{ hb_img_id: 155, picture: 'custom/sharinghistory/31.jpg' }]
    );
    strategy = {
      findImageTextRows: vi
        .fn()
        .mockResolvedValue([
          {
            id: 't1',
            collection_id: 'page',
            extra: { image_captions: { [`${IMG}155`]: { eng: { name: 'Map' } } } },
          },
        ]),
      findCollectionImagePaths: vi
        .fn()
        .mockResolvedValue([
          {
            id: 'img-31',
            collection_id: 'page',
            path: 'b7.jpg',
            original_name: 'custom/sharinghistory/31.jpg',
          },
        ]),
      upsertImageTranslation: vi.fn().mockResolvedValue('id'),
      setCollectionTranslationExtraAsStoredById: vi.fn().mockResolvedValue(undefined),
    };
    context = {
      legacyDb: {
        query: legacyQuery,
        execute: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as ILegacyDatabase,
      strategy: strategy as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };
  });

  it('finds the image by its synced original name, writes the text, then clears the key', async () => {
    const result = await new ImageTextsImporter(context).import();

    expect(result.success).toBe(true);
    expect(strategy.upsertImageTranslation).toHaveBeenCalledWith(
      expect.objectContaining({ image_type: 'collection_image', image_id: 'img-31', name: 'Map' })
    );
    expect(strategy.setCollectionTranslationExtraAsStoredById).toHaveBeenCalledWith('t1', null);
  });

  it('keeps every key when a text fails', async () => {
    strategy.upsertImageTranslation!.mockRejectedValueOnce(new Error('lock wait timeout'));

    const result = await new ImageTextsImporter(context).import();

    expect(result.success).toBe(false);
    expect(strategy.setCollectionTranslationExtraAsStoredById).not.toHaveBeenCalled();
  });

  it('never picks one of two images with the same legacy path', async () => {
    strategy.findCollectionImagePaths!.mockResolvedValue([
      { id: 'a', collection_id: 'page', path: 'custom/sharinghistory/31.jpg', original_name: null },
      {
        id: 'b',
        collection_id: 'page',
        path: 'x.jpg',
        original_name: 'custom/sharinghistory/31.jpg',
      },
    ]);

    await new ImageTextsImporter(context).import();

    expect(strategy.upsertImageTranslation).not.toHaveBeenCalled();
  });
});
