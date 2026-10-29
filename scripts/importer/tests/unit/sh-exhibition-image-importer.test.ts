import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import {
  ShExhibitionImageImporter,
  exhibitionImages,
} from '../../src/importers/phase-03/sh-exhibition-image-importer.js';

const DIR = 'sharing_history/sh_exhibitions/exhibitions/AWE/11';

const travelling = {
  exhibition_id: 11,
  homeimage: `${DIR}/homeImg11.jpg`,
  exh_thumb: `${DIR}/item_11.jpg`,
  portal_image: 'sharing_history/sh_exhibitions/exhibitions/awe/11/portal_image/1.jpg',
  logo1: `${DIR}/item_logo_111.png`,
  url1: 'https://sharinghistory.museumwnf.org/pm_partner.php?id=AT_01;at&shpro=AWE&',
  logo2: `${DIR}/item_logo_211.png`,
  url2: '',
  logo3: null,
  url3: '',
};

describe('exhibitionImages', () => {
  it('keeps every picture and logo the row names, each with its role', () => {
    expect(exhibitionImages(travelling)).toEqual([
      { path: `${DIR}/homeImg11.jpg`, tag: 'home image', display_order: 0, extra: null },
      { path: `${DIR}/item_11.jpg`, tag: 'thumbnail', display_order: 0, extra: null },
      { path: travelling.portal_image, tag: 'portal image', display_order: 0, extra: null },
      {
        path: `${DIR}/item_logo_111.png`,
        tag: 'logo',
        display_order: 1,
        extra: { link: travelling.url1 },
      },
      { path: `${DIR}/item_logo_211.png`, tag: 'logo', display_order: 2, extra: null },
    ]);
  });

  it('names nothing for a row with no images', () => {
    expect(
      exhibitionImages({
        exhibition_id: 2,
        homeimage: null,
        exh_thumb: null,
        portal_image: null,
        logo1: null,
        url1: '',
        logo2: null,
        url2: '',
        logo3: null,
        url3: '',
      })
    ).toEqual([]);
  });
});

describe('ShExhibitionImageImporter', () => {
  let context: ImportContext;
  let writeCollectionImage: ReturnType<typeof vi.fn>;
  let tagWrites: ReturnType<typeof vi.fn>;
  let attachTagsToCollectionImage: ReturnType<typeof vi.fn>;

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
    const tracker = new UnifiedTracker();
    tracker.set('mwnf3_sharing_history:sh_exhibitions:11', 'exh-11', 'collection');

    const legacyDb: ILegacyDatabase = {
      query: vi.fn(async () => [travelling]) as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    let image = 0;
    writeCollectionImage = vi.fn(async () => `image-${++image}`);
    tagWrites = vi.fn(
      async (data: { backward_compatibility: string }) => `tag:${data.backward_compatibility}`
    );
    attachTagsToCollectionImage = vi.fn();
    const strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn(async (table: string) =>
        table === 'languages' ? 'eng' : null
      ),
      imageExists: vi.fn().mockResolvedValue(null),
      writeCollectionImage,
      writeTag: tagWrites,
      attachTagsToCollectionImage,
    } as unknown as IWriteStrategy;

    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  it("writes the exhibition's images on its collection, logos with their link", async () => {
    const result = await new ShExhibitionImageImporter(context).import();

    expect(result.errors).toEqual([]);
    expect(writeCollectionImage).toHaveBeenCalledTimes(5);
    expect(writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_id: 'exh-11',
        path: `${DIR}/homeImg11.jpg`,
        original_name: 'homeImg11.jpg',
        mime_type: 'image/jpeg',
        size: 1,
        extra: null,
      })
    );
    expect(writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `${DIR}/item_logo_111.png`,
        mime_type: 'image/png',
        display_order: 1,
        extra: JSON.stringify({ link: travelling.url1 }),
      })
    );

    // One image-type tag per role, each image tagged once.
    expect(tagWrites).toHaveBeenCalledTimes(4);
    expect(attachTagsToCollectionImage).toHaveBeenCalledTimes(5);
  });
});
