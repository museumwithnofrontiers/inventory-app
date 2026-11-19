import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PictureCreditsImporter } from '../../src/importers/phase-11/picture-credits-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import {
  planImageRights,
  planParentImage,
  planPictureCredits,
  projectOverridesPictures,
  withoutCopyrightMark,
  type PictureCreditRow,
} from '../../src/utils/picture-credits.js';

function row(
  id: string,
  language: string,
  extra: Record<string, unknown> | null,
  over: Partial<PictureCreditRow> = {}
): PictureCreditRow {
  return {
    id,
    item_id: 'pic-1',
    language_id: language,
    extra,
    image_id: 'img-1',
    image_copyright: '© Museo X',
    image_photographer: null,
    image_credit: null,
    project_key: 'mwnf3:projects:EPM',
    ...over,
  };
}

describe('withoutCopyrightMark', () => {
  it('drops only the mark and space the importer adds', () => {
    expect(withoutCopyrightMark('© Museo X')).toBe('Museo X');
    expect(withoutCopyrightMark('©Museo X')).toBe('©Museo X');
    expect(withoutCopyrightMark(null)).toBeNull();
  });
});

describe('projectOverridesPictures', () => {
  it('is true for ISL and IAM only', () => {
    expect(projectOverridesPictures('mwnf3:projects:IAM')).toBe(true);
    expect(projectOverridesPictures('mwnf3:projects:isl')).toBe(true);
    expect(projectOverridesPictures('mwnf3:projects:EPM')).toBe(false);
    expect(projectOverridesPictures('mwnf3_travels:trails:IAM')).toBe(false);
    expect(projectOverridesPictures(null)).toBe(false);
  });
});

describe('planPictureCredits', () => {
  it('moves texts that every row carries alike to the image', () => {
    const plan = planPictureCredits(
      [
        row('t1', 'eng', { photographer: 'Ana', copyright: 'Museo X', legacy_type: 'd' }),
        row('t2', 'fra', { photographer: 'Ana', copyright: 'Museo X', legacy_type: 'd' }),
      ],
      'eng'
    );

    expect(plan.images).toEqual([
      { image_id: 'img-1', photographer: 'Ana', credit: null, clear_copyright: false },
    ]);
    expect(plan.translations).toEqual([
      { id: 't1', extra: { legacy_type: 'd' } },
      { id: 't2', extra: { legacy_type: 'd' } },
    ]);
    expect(plan.kept).toEqual([]);
  });

  it('keeps texts that differ by language, or miss in a language, and stores the default one', () => {
    const plan = planPictureCredits(
      [
        row('t1', 'eng', { photographer: 'Ana', copyright: 'Museo X' }),
        row('t2', 'ita', { photographer: 'Anna', copyright: 'Museo X' }),
        row('t3', 'fra', null),
      ],
      'eng'
    );

    expect(plan.images).toEqual([
      { image_id: 'img-1', photographer: 'Ana', credit: null, clear_copyright: false },
    ]);
    expect(plan.translations).toEqual([]);
    expect(plan.kept).toEqual([
      { item_id: 'pic-1', key: 'photographer' },
      { item_id: 'pic-1', key: 'copyright' },
    ]);
  });

  it('moves one key and keeps the other', () => {
    const plan = planPictureCredits(
      [
        row('t1', 'eng', { photographer: 'Ana', copyright: 'Museo X' }),
        row('t2', 'ita', { photographer: 'Ana', copyright: 'Museo X (Roma)' }),
      ],
      'eng'
    );

    expect(plan.translations).toEqual([
      { id: 't1', extra: { copyright: 'Museo X' } },
      { id: 't2', extra: { copyright: 'Museo X (Roma)' } },
    ]);
    expect(plan.kept).toEqual([{ item_id: 'pic-1', key: 'copyright' }]);
  });

  it('puts an ISL or IAM picture own text in credit and lets the project line burn', () => {
    const plan = planPictureCredits(
      [
        row(
          't1',
          'eng',
          { copyright: 'Wikimedia Commons' },
          {
            image_copyright: '© Wikimedia Commons',
            project_key: 'mwnf3:projects:IAM',
          }
        ),
      ],
      'eng'
    );

    expect(plan.images).toEqual([
      { image_id: 'img-1', photographer: null, credit: 'Wikimedia Commons', clear_copyright: true },
    ]);
    expect(plan.translations).toEqual([{ id: 't1', extra: null }]);
  });

  it('does not clear an ISL or IAM copyright that is already empty', () => {
    const plan = planPictureCredits(
      [
        row(
          't1',
          'eng',
          { copyright: 'MWNF' },
          { image_copyright: null, project_key: 'mwnf3:projects:ISL' }
        ),
      ],
      'eng'
    );

    expect(plan.images[0]).toEqual({
      image_id: 'img-1',
      photographer: null,
      credit: 'MWNF',
      clear_copyright: false,
    });
  });

  it('keeps a text legacy wrote with the mark in credit, as the burned text gives it back without', () => {
    const plan = planPictureCredits(
      [row('t1', 'eng', { copyright: '© Museo X' }, { image_copyright: '© Museo X' })],
      'eng'
    );

    expect(plan.images[0]?.credit).toBe('© Museo X');
    expect(plan.images[0]?.clear_copyright).toBe(false);
  });

  it('stores nothing on the image when the default language has no text: no other language is picked', () => {
    const plan = planPictureCredits(
      [
        row(
          't1',
          'fra',
          { photographer: 'Jean', copyright: 'Musee X' },
          { image_photographer: 'Jean', image_credit: 'Musee X' }
        ),
        row(
          't2',
          'ita',
          { photographer: 'Gianni', copyright: 'Museo X' },
          { image_photographer: 'Jean', image_credit: 'Musee X' }
        ),
      ],
      'eng'
    );

    expect(plan.images[0]).toEqual({
      image_id: 'img-1',
      photographer: null,
      credit: null,
      clear_copyright: false,
    });
    expect(plan.translations).toEqual([]);
  });

  it('moves a text every row carries alike, whatever the languages', () => {
    const plan = planPictureCredits(
      [row('t1', 'fra', { photographer: 'Jean' }), row('t2', 'ita', { photographer: 'Jean' })],
      'eng'
    );

    expect(plan.images[0]?.photographer).toBe('Jean');
    expect(plan.translations).toHaveLength(2);
  });

  it('keeps on a second run what the first one moved', () => {
    // The photographer moved on the first run; the copyright stays per language.
    const plan = planPictureCredits(
      [
        row(
          't1',
          'eng',
          { copyright: 'Museo X' },
          { image_photographer: 'Ana', image_credit: null }
        ),
        row(
          't2',
          'ita',
          { copyright: 'Museo X (Roma)' },
          { image_photographer: 'Ana', image_credit: null }
        ),
      ],
      'eng'
    );
    expect(plan.images).toEqual([
      { image_id: 'img-1', photographer: 'Ana', credit: null, clear_copyright: false },
    ]);

    const again = planPictureCredits(
      [
        row(
          't1',
          'eng',
          { photographer: 'Ana' },
          { image_copyright: null, image_credit: 'Wikimedia', project_key: 'mwnf3:projects:IAM' }
        ),
        row(
          't2',
          'ita',
          { photographer: 'Anna' },
          { image_copyright: null, image_credit: 'Wikimedia', project_key: 'mwnf3:projects:IAM' }
        ),
      ],
      'eng'
    );
    expect(again.images[0]).toEqual({
      image_id: 'img-1',
      photographer: 'Ana',
      credit: 'Wikimedia',
      clear_copyright: false,
    });
  });

  it('leaves a picture with no text alone, and ignores values that are not texts', () => {
    const plan = planPictureCredits([row('t1', 'eng', { photographer: ['x'] })], 'eng');

    expect(plan).toEqual({ images: [], translations: [], kept: [] });
  });
});

describe('planParentImage', () => {
  const parent = {
    parent_image_id: 'parent-img',
    parent_photographer: null,
    parent_credit: null,
    parent_copyright: '© Wikimedia Commons',
    photographer: 'Ana',
    credit: 'Wikimedia Commons',
    project_key: 'mwnf3:projects:IAM',
  };

  it("takes its picture's values, and burns the project line where it overrides", () => {
    expect(planParentImage(parent)).toEqual({
      image_id: 'parent-img',
      photographer: 'Ana',
      credit: 'Wikimedia Commons',
      clear_copyright: true,
    });
  });

  it('keeps the copyright of other projects', () => {
    expect(
      planParentImage({ ...parent, project_key: 'mwnf3:projects:EPM', credit: null })
        ?.clear_copyright
    ).toBe(false);
  });

  it('is null when nothing changes', () => {
    expect(
      planParentImage({
        ...parent,
        parent_photographer: 'Ana',
        parent_credit: 'Wikimedia Commons',
        parent_copyright: null,
      })
    ).toBeNull();
  });
});

describe('PictureCreditsImporter', () => {
  let context: ImportContext;
  let strategy: Record<string, ReturnType<typeof vi.fn>>;

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
    strategy = {
      findPictureCreditRows: vi.fn().mockResolvedValue([]),
      setItemImagePictureCredit: vi.fn().mockResolvedValue(undefined),
      setItemTranslationColumnsAsStoredById: vi.fn().mockResolvedValue(undefined),
      findPictureParentImages: vi.fn().mockResolvedValue([]),
      findPartnerImagesWithPhotographer: vi.fn().mockResolvedValue([]),
      setPartnerImagePhotographer: vi.fn().mockResolvedValue(undefined),
      findImageRightsRows: vi.fn().mockResolvedValue([]),
      setItemTranslationImageRights: vi.fn().mockResolvedValue(undefined),
    };
    context = {
      legacyDb,
      strategy: strategy as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };
  });

  it('updates the images, then the translations, then the parent images and partner images', async () => {
    strategy.findPictureCreditRows!.mockResolvedValue([
      row('t1', 'eng', { photographer: 'Ana', legacy_type: 'd' }),
    ]);
    strategy.findPictureParentImages!.mockResolvedValue([
      {
        parent_image_id: 'parent-img',
        parent_photographer: null,
        parent_credit: null,
        parent_copyright: '© Museo X',
        photographer: 'Ana',
        credit: null,
        project_key: 'mwnf3:projects:EPM',
      },
    ]);
    strategy.findPartnerImagesWithPhotographer!.mockResolvedValue([
      { id: 'pi-1', extra: { photographer: 'Bea' } },
      { id: 'pi-2', extra: { photographer: 'Cal', note: 'x' } },
    ]);

    const result = await new PictureCreditsImporter(context).import();

    expect(result.success).toBe(true);
    expect(strategy.setItemImagePictureCredit!.mock.calls).toEqual([
      ['img-1', 'Ana', null, false],
      ['parent-img', 'Ana', null, false],
    ]);
    expect(strategy.setItemTranslationColumnsAsStoredById!.mock.calls).toEqual([
      ['t1', {}, JSON.stringify({ legacy_type: 'd' })],
    ]);
    expect(strategy.setPartnerImagePhotographer!.mock.calls).toEqual([
      ['pi-1', 'Bea', null],
      ['pi-2', 'Cal', JSON.stringify({ note: 'x' })],
    ]);
    expect(result.imported).toBe(5);
  });

  it('writes nothing on a dry run', async () => {
    strategy.findPictureCreditRows!.mockResolvedValue([row('t1', 'eng', { photographer: 'Ana' })]);
    strategy.findPartnerImagesWithPhotographer!.mockResolvedValue([
      { id: 'pi-1', extra: { photographer: 'Bea' } },
    ]);
    context.dryRun = true;

    const result = await new PictureCreditsImporter(context).import();

    expect(result.imported).toBe(3);
    expect(strategy.setItemImagePictureCredit).not.toHaveBeenCalled();
    expect(strategy.setItemTranslationColumnsAsStoredById).not.toHaveBeenCalled();
    expect(strategy.setPartnerImagePhotographer).not.toHaveBeenCalled();
  });

  it('skips a partner photographer that is not a text', async () => {
    strategy.findPartnerImagesWithPhotographer!.mockResolvedValue([
      { id: 'pi-1', extra: { photographer: 3 } },
    ]);

    const result = await new PictureCreditsImporter(context).import();

    expect(result.skipped).toBe(1);
    expect(strategy.setPartnerImagePhotographer).not.toHaveBeenCalled();
  });

  it('reports a failed write and carries on', async () => {
    strategy.findPictureCreditRows!.mockResolvedValue([
      row('t1', 'eng', { photographer: 'Ana' }),
      row('t2', 'eng', { photographer: 'Bea' }, { item_id: 'pic-2', image_id: 'img-2' }),
    ]);
    strategy.setItemImagePictureCredit!.mockRejectedValueOnce(new Error('lock wait timeout'));

    const result = await new PictureCreditsImporter(context).import();

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Item image img-1: lock wait timeout']);
    expect(strategy.setItemImagePictureCredit).toHaveBeenCalledTimes(2);
  });
});

describe('planImageRights', () => {
  it("moves an object's rights line to image_rights, as written, and leaves other keys", () => {
    expect(
      planImageRights([
        { id: 't1', extra: { copyright: 'Copyright image: Museo X.', binding_desc: 'x' } },
        { id: 't2', extra: { copyright: 'Copyright immagine: Museo X.' } },
        { id: 't3', extra: { copyright: ['not a text'] } },
      ])
    ).toEqual([
      { id: 't1', image_rights: 'Copyright image: Museo X.', extra: { binding_desc: 'x' } },
      { id: 't2', image_rights: 'Copyright immagine: Museo X.', extra: null },
    ]);
  });
});
