import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Mwnf3ExhibitionItemImporter } from '../../src/importers/phase-01/mwnf3-exhibition-item-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

// ===========================================================================
// Test constants
// ===========================================================================

const PAGE_ID = 7;
const PAGE_COLLECTION_BC = `mwnf3:exhibition_pages:${PAGE_ID}`;

const EXHIBITION_ID = 10;
const EXHIBITION_COLLECTION_BC = `mwnf3:exhibitions:${EXHIBITION_ID}`;

const ARTINTRO_PAGE_ID = 3;
const ARTINTRO_PAGE_COLLECTION_BC = `mwnf3:artintro_pages:${ARTINTRO_PAGE_ID}`;

const IMAGE_ID = 42;
const ITEM_BC = 'mwnf3:objects:isl:jo:Mus01:8';

// ===========================================================================
// Shared fixtures
// ===========================================================================

/** A page image row referencing item 'O;ISL;jo;1;8'. */
const PAGE_IMAGE_ROW = {
  image_id: IMAGE_ID,
  page_id: PAGE_ID,
  n: 1,
  n2: 0,
  ref_item: 'O;ISL;jo;1;8',
  picture: 'images/item.jpg',
};

/** An exhibition-level image row referencing the same item. */
const EXHIBITION_IMAGE_ROW = {
  image_id: IMAGE_ID,
  exhibition_id: EXHIBITION_ID,
  n: 1,
  n2: 0,
  ref_item: 'O;ISL;jo;1;8',
  picture: 'images/exh.jpg',
};

/** An artintro page image row referencing the same item. */
const ARTINTRO_IMAGE_ROW = {
  image_id: IMAGE_ID,
  page_id: ARTINTRO_PAGE_ID,
  n: 1,
  n2: 0,
  ref_item: 'O;ISL;jo;1;8',
  picture: 'images/artintro.jpg',
};

// ===========================================================================
// Logger stub
// ===========================================================================

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

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Build a query mock for page-image tests.
 * Supplies exhibition_page_images + exhibition_page_images_fields EAV,
 * and returns empty arrays for all other tables.
 */
function makePageImageQueryMock(
  pageImages: typeof PAGE_IMAGE_ROW[],
  eavRows: Array<{ entity_id: number; lang_id: string; field: string; value: string }>,
  detailRows: Array<Record<string, unknown>> = [],
  detailEavRows: Array<{ entity_id: number; lang_id: string; field: string; value: string }> = []
): ReturnType<typeof vi.fn> {
  return vi.fn(async (sql: string) => {
    if (sql.includes('exhibition_page_images_fields')) return eavRows;
    if (sql.includes('exhibition_page_image_details_fields')) return detailEavRows;
    if (sql.includes('exhibition_page_image_details') && !sql.includes('_fields')) return detailRows;
    if (sql.includes('exhibition_page_images') && !sql.includes('_fields') && !sql.includes('details')) return pageImages;
    // exhibition_images and artintro_page_images return empty
    return [];
  });
}

/**
 * Build a query mock for exhibition-level image tests.
 */
function makeExhibitionImageQueryMock(
  exhibitionImages: typeof EXHIBITION_IMAGE_ROW[],
  eavRows: Array<{ entity_id: number; lang_id: string; field: string; value: string }>
): ReturnType<typeof vi.fn> {
  return vi.fn(async (sql: string) => {
    if (sql.includes('exhibition_images_fields')) return eavRows;
    if (sql.includes('exhibition_images') && !sql.includes('_fields') && !sql.includes('page')) return exhibitionImages;
    // page images and artintro return empty
    return [];
  });
}

/**
 * Build a query mock for artintro page image tests.
 */
function makeArtintroImageQueryMock(
  artintroImages: typeof ARTINTRO_IMAGE_ROW[],
  eavRows: Array<{ entity_id: number; lang_id: string; field: string; value: string }>
): ReturnType<typeof vi.fn> {
  return vi.fn(async (sql: string) => {
    if (sql.includes('artintro_page_images_fields')) return eavRows;
    if (sql.includes('artintro_page_images') && !sql.includes('_fields')) return artintroImages;
    // page images and exhibition_images return empty
    return [];
  });
}

function makeContext(
  queryMock: ReturnType<typeof vi.fn>,
  tracker: UnifiedTracker,
  writeCollectionItemMock: ReturnType<typeof vi.fn>
): ImportContext {
  const legacyDb: ILegacyDatabase = {
    query: queryMock as ILegacyDatabase['query'],
    execute: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const strategy = {
    exists: vi.fn().mockResolvedValue(false),
    findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
    writeCollectionItem: writeCollectionItemMock,
    writeCollectionImage: vi.fn().mockResolvedValue(undefined),
    imageExists: vi.fn().mockResolvedValue(null),
    writeItem: vi.fn().mockResolvedValue('custom-picture-uuid'),
    writeItemImage: vi.fn().mockResolvedValue(undefined),
    writeItemTranslation: vi.fn().mockResolvedValue(undefined),
    writeTag: vi.fn().mockResolvedValue('custom-tag-uuid'),
    attachTagsToItem: vi.fn().mockResolvedValue(undefined),
  } as unknown as IWriteStrategy;

  return {
    legacyDb,
    strategy,
    tracker,
    logger,
    dryRun: false,
  };
}

// ===========================================================================
// Tests: story #1225 — exhibition_page_images_fields extended fields
// ===========================================================================

describe('Mwnf3ExhibitionItemImporter — story #1225: page image EAV fields', () => {
  let tracker: UnifiedTracker;
  let writeCollectionItemMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();
    tracker.set(PAGE_COLLECTION_BC, 'page-collection-uuid', 'collection');
    tracker.set(ITEM_BC, 'item-uuid', 'item');
    writeCollectionItemMock = vi.fn().mockResolvedValue(undefined);
  });

  it('stores item_name, item_date, item_dynasty, item_location on collection_item.extra', async () => {
    const eavRows = [
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_name', value: 'Golden Vase' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_date', value: '12th century' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_dynasty', value: 'Abbasid' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_location', value: 'Baghdad Museum' },
    ];

    const ctx = makeContext(
      makePageImageQueryMock([PAGE_IMAGE_ROW], eavRows),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    expect(writeCollectionItemMock).toHaveBeenCalledTimes(1);
    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.item_name).toEqual({ en: 'Golden Vase' });
    expect(extra.item_date).toEqual({ en: '12th century' });
    expect(extra.item_dynasty).toEqual({ en: 'Abbasid' });
    expect(extra.item_location).toEqual({ en: 'Baghdad Museum' });
  });

  it('stores item_artist, item_material, item_museum on collection_item.extra', async () => {
    const eavRows = [
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_artist', value: 'Unknown Artist' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_material', value: 'Ceramic' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_museum', value: 'Cairo Museum' },
    ];

    const ctx = makeContext(
      makePageImageQueryMock([PAGE_IMAGE_ROW], eavRows),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.item_artist).toEqual({ en: 'Unknown Artist' });
    expect(extra.item_material).toEqual({ en: 'Ceramic' });
    expect(extra.item_museum).toEqual({ en: 'Cairo Museum' });
  });

  it('regression: detail_justification still lands in collection_item.extra', async () => {
    const eavRows = [
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'detail_justification', value: 'The detail text.' },
    ];

    const ctx = makeContext(
      makePageImageQueryMock([PAGE_IMAGE_ROW], eavRows),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.detail_justification).toEqual({ en: 'The detail text.' });
  });

  it('preserves n and n2 alongside new EAV fields, and no picture path', async () => {
    const eavRows = [
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_name', value: 'Vessel' },
    ];

    const ctx = makeContext(
      makePageImageQueryMock([PAGE_IMAGE_ROW], eavRows),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.n).toBe(1);
    expect(extra.n2).toBe(0);
    expect(extra.picture).toBeUndefined();
  });

  it('stores multi-language values as separate lang keys', async () => {
    const eavRows = [
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_name', value: 'Golden Vase' },
      { entity_id: IMAGE_ID, lang_id: 'de', field: 'item_name', value: 'Goldene Vase' },
    ];

    const ctx = makeContext(
      makePageImageQueryMock([PAGE_IMAGE_ROW], eavRows),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.item_name).toEqual({ en: 'Golden Vase', de: 'Goldene Vase' });
  });

  it('omits fields whose source values are empty or whitespace-only', async () => {
    const eavRows = [
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_name', value: '' },
    ];

    const ctx = makeContext(
      makePageImageQueryMock([PAGE_IMAGE_ROW], eavRows),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.item_name).toBeUndefined();
  });
});

// ===========================================================================
// Tests: detail views (exhibition_page_image_details) are placements
// ===========================================================================

const MONUMENT_BC = 'mwnf3:monuments:bar:it:Mon11:9';
const DETAIL_BC = 'mwnf3:monument_details:BAR:it:Mon11:9:3';
const DETAIL_PICTURE_BC = 'mwnf3:monument_detail_pictures:BAR:it:Mon11:9:3:2';

/** A Baroque Art placement of monument 'M;BAR;it;11;9' at n=4, n2=2, with no picture of its own. */
const MONUMENT_PLACEMENT = { ...PAGE_IMAGE_ROW, n: 4, n2: 2, ref_item: 'M;BAR;it;11;9', picture: '', project_id: 'BAR' };

const DETAIL_PICTURE_ROWS = [
  { project_id: 'BAR', country_id: 'it', institution_id: 'Mon11', monument_id: 9, detail_id: 3, picture_id: 2, path: 'monuments/bar/it/11/9/details/3/2.jpg' },
];

function withDetailPictures(queryMock: ReturnType<typeof vi.fn>): ReturnType<typeof vi.fn> {
  const query = queryMock as unknown as (sql: string) => Promise<unknown[]>;
  return vi.fn(async (sql: string) => {
    if (sql.includes('monument_detail_pictures')) return DETAIL_PICTURE_ROWS;
    return query(sql);
  });
}

function detailRow(id: number, n2: number, ref: string, picture: string): Record<string, unknown> {
  return { detail_id: id, image_id: IMAGE_ID, n: 1, n2, ref_detail_item: ref, picture_details: picture };
}

describe('Mwnf3ExhibitionItemImporter — detail views are placements of their own', () => {
  let tracker: UnifiedTracker;
  let writeCollectionItemMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();
    tracker.set(PAGE_COLLECTION_BC, 'page-collection-uuid', 'collection');
    tracker.set(MONUMENT_BC, 'monument-uuid', 'item');
    tracker.set(DETAIL_BC, 'detail-uuid', 'item');
    tracker.set(DETAIL_PICTURE_BC, 'detail-picture-uuid', 'item');
    tracker.set('mwnf3:projects:bar', 'bar-context-uuid', 'context');
    writeCollectionItemMock = vi.fn().mockResolvedValue(undefined);
  });

  it('places the monument-detail picture a view shows, at the placement’s n with its own n2 and texts', async () => {
    const details = [detailRow(60, 3, 'BAR;it;11;9;3', 'monuments/bar/it/11/9/details/3/2.jpg')];
    const detailEav = [
      { entity_id: 60, lang_id: 'en', field: 'item_name', value: 'High altar' },
      { entity_id: 60, lang_id: 'en', field: 'item_artist', value: 'Gian Lorenzo Bernini' },
    ];
    const ctx = makeContext(
      withDetailPictures(makePageImageQueryMock([MONUMENT_PLACEMENT], [], details, detailEav)),
      tracker,
      writeCollectionItemMock
    );

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    const calls = writeCollectionItemMock.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.item_id)).toEqual(['monument-uuid', 'detail-picture-uuid']);
    expect(calls[0].extra.details).toBeUndefined();
    expect(calls[1]).toMatchObject({
      collection_id: 'page-collection-uuid',
      display_order: 4,
      extra: {
        n: 4,
        n2: 3,
        parent_n2: 2,
        detail_n: 1,
        item_name: { en: 'High altar' },
        item_artist: { en: 'Gian Lorenzo Bernini' },
      },
    });
    expect(ctx.strategy.writeCollectionImage).not.toHaveBeenCalled();
  });

  it('places the referenced detail, its picture as a page image, when the picture is not one of the detail’s', async () => {
    const details = [detailRow(61, 2, 'BAR;it;11;9;3', 'monuments/bar/it/11/9/other.jpg')];
    const ctx = makeContext(
      withDetailPictures(makePageImageQueryMock([MONUMENT_PLACEMENT], [], details)),
      tracker,
      writeCollectionItemMock
    );

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(writeCollectionItemMock.mock.calls[1][0].item_id).toBe('detail-uuid');
    expect(ctx.strategy.writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'monuments/bar/it/11/9/other.jpg', display_order: 4 })
    );
  });

  it('places the referenced detail alone when the view shows no picture', async () => {
    const details = [detailRow(62, 2, 'BAR;it;11;9;3', '')];
    const ctx = makeContext(
      withDetailPictures(makePageImageQueryMock([MONUMENT_PLACEMENT], [], details)),
      tracker,
      writeCollectionItemMock
    );

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(writeCollectionItemMock.mock.calls[1][0].item_id).toBe('detail-uuid');
    expect(ctx.strategy.writeCollectionImage).not.toHaveBeenCalled();
  });

  it('makes a view that references no detail an item of its own under the placed item', async () => {
    const details = [detailRow(63, 2, '', 'custom/exhibition/137.jpg')];
    const detailEav = [
      { entity_id: 63, lang_id: 'en', field: 'item_name', value: 'Benedict Altar' },
      { entity_id: 63, lang_id: 'en', field: 'detail_justification', value: 'Painting of the high altar.' },
    ];
    const ctx = makeContext(
      withDetailPictures(makePageImageQueryMock([MONUMENT_PLACEMENT], [], details, detailEav)),
      tracker,
      writeCollectionItemMock
    );

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(ctx.strategy.writeItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'picture',
        parent_id: 'monument-uuid',
        backward_compatibility: 'mwnf3:exhibition_page_image_details:63',
      })
    );
    expect(ctx.strategy.writeItemImage).not.toHaveBeenCalled();
    expect(ctx.strategy.attachTagsToItem).toHaveBeenCalledWith('custom-picture-uuid', ['custom-tag-uuid']);
    expect(ctx.strategy.writeItemTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        context_id: 'bar-context-uuid',
        name: 'Benedict Altar',
        description: 'Painting of the high altar.',
      })
    );
    expect(writeCollectionItemMock.mock.calls[1][0].item_id).toBe('custom-picture-uuid');
    // The placeholder legacy shows stays at the view's position.
    expect(ctx.strategy.writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'custom/exhibition/137.jpg', display_order: 4 })
    );
  });

  it('places the detail and keeps the placeholder as a page image, never a picture of the detail', async () => {
    const details = [detailRow(67, 2, 'BAR;it;11;9;3', 'custom/exhibition/137.jpg')];
    const ctx = makeContext(
      withDetailPictures(makePageImageQueryMock([MONUMENT_PLACEMENT], [], details)),
      tracker,
      writeCollectionItemMock
    );

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(ctx.strategy.writeItem).not.toHaveBeenCalled();
    expect(writeCollectionItemMock.mock.calls[1][0].item_id).toBe('detail-uuid');
    expect(ctx.strategy.writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'custom/exhibition/137.jpg', display_order: 4 })
    );
  });

  it('skips and reports a view whose detail is not imported', async () => {
    const details = [detailRow(64, 2, 'BAR;it;11;9;99', '')];
    const ctx = makeContext(
      withDetailPictures(makePageImageQueryMock([MONUMENT_PLACEMENT], [], details)),
      tracker,
      writeCollectionItemMock
    );

    const result = await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(writeCollectionItemMock).toHaveBeenCalledTimes(1);
    expect(result.skipped).toBe(1);
    expect(result.warnings?.some((w) => w.includes('detail view 64') && w.includes('detail not found'))).toBe(true);
  });
});

// ===========================================================================
// Tests: story #1224 — exhibition_images_fields
// ===========================================================================

describe('Mwnf3ExhibitionItemImporter — story #1224: exhibition-level image EAV fields', () => {
  let tracker: UnifiedTracker;
  let writeCollectionItemMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();
    tracker.set(EXHIBITION_COLLECTION_BC, 'exh-collection-uuid', 'collection');
    tracker.set(ITEM_BC, 'item-uuid', 'item');
    writeCollectionItemMock = vi.fn().mockResolvedValue(undefined);
  });

  it('stores item_name, item_date, item_dynasty, item_location on collection_item.extra', async () => {
    const eavRows = [
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_name', value: 'Bronze Bowl' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_date', value: '9th century' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_dynasty', value: 'Umayyad' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_location', value: 'Damascus' },
    ];

    const ctx = makeContext(
      makeExhibitionImageQueryMock([EXHIBITION_IMAGE_ROW], eavRows),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    expect(writeCollectionItemMock).toHaveBeenCalledTimes(1);
    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.item_name).toEqual({ en: 'Bronze Bowl' });
    expect(extra.item_date).toEqual({ en: '9th century' });
    expect(extra.item_dynasty).toEqual({ en: 'Umayyad' });
    expect(extra.item_location).toEqual({ en: 'Damascus' });
  });

  it('stores item_description and item_museum on collection_item.extra', async () => {
    const eavRows = [
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_description', value: 'A rare example.' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_museum', value: 'National Museum' },
    ];

    const ctx = makeContext(
      makeExhibitionImageQueryMock([EXHIBITION_IMAGE_ROW], eavRows),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.item_description).toEqual({ en: 'A rare example.' });
    expect(extra.item_museum).toEqual({ en: 'National Museum' });
  });

  it('writes n and n2 to extra, and a picture that is none of the item’s own as a page image', async () => {
    const ctx = makeContext(
      makeExhibitionImageQueryMock([EXHIBITION_IMAGE_ROW], []),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.n).toBe(1);
    expect(extra.n2).toBe(0);
    expect(extra.picture).toBeUndefined();
    expect(ctx.strategy.writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({ collection_id: 'exh-collection-uuid', path: 'images/exh.jpg', display_order: 1 })
    );
  });
});

// ===========================================================================
// Tests: story #1223 — artintro_page_images_fields
// ===========================================================================

describe('Mwnf3ExhibitionItemImporter — story #1223: artintro page image EAV fields', () => {
  let tracker: UnifiedTracker;
  let writeCollectionItemMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();
    tracker.set(ARTINTRO_PAGE_COLLECTION_BC, 'artintro-page-uuid', 'collection');
    tracker.set(ITEM_BC, 'item-uuid', 'item');
    writeCollectionItemMock = vi.fn().mockResolvedValue(undefined);
  });

  it('stores detail_justification, item_name, item_date, item_location on collection_item.extra', async () => {
    const eavRows = [
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'detail_justification', value: 'Context note.' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_name', value: 'Marble Slab' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_date', value: '11th century' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_location', value: 'Jordan' },
    ];

    const ctx = makeContext(
      makeArtintroImageQueryMock([ARTINTRO_IMAGE_ROW], eavRows),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    expect(writeCollectionItemMock).toHaveBeenCalledTimes(1);
    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.detail_justification).toEqual({ en: 'Context note.' });
    expect(extra.item_name).toEqual({ en: 'Marble Slab' });
    expect(extra.item_date).toEqual({ en: '11th century' });
    expect(extra.item_location).toEqual({ en: 'Jordan' });
  });

  it('stores detail_name, item_dynasty, item_museum on collection_item.extra', async () => {
    const eavRows = [
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'detail_name', value: 'Detail shot' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_dynasty', value: 'Ayyubid' },
      { entity_id: IMAGE_ID, lang_id: 'en', field: 'item_museum', value: 'Amman Museum' },
    ];

    const ctx = makeContext(
      makeArtintroImageQueryMock([ARTINTRO_IMAGE_ROW], eavRows),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.detail_name).toEqual({ en: 'Detail shot' });
    expect(extra.item_dynasty).toEqual({ en: 'Ayyubid' });
    expect(extra.item_museum).toEqual({ en: 'Amman Museum' });
  });

  it('writes n and n2 to extra, and no picture path', async () => {
    const ctx = makeContext(
      makeArtintroImageQueryMock([ARTINTRO_IMAGE_ROW], []),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    await importer.import();

    const extra = writeCollectionItemMock.mock.calls[0][0].extra as Record<string, unknown>;
    expect(extra.n).toBe(1);
    expect(extra.n2).toBe(0);
    expect(extra.picture).toBeUndefined();
  });
});

// ===========================================================================
// Tests: artintro page image dedup — same item repeated across `n` slots
// ===========================================================================

describe('Mwnf3ExhibitionItemImporter — artintro page image dedup (first occurrence wins)', () => {
  let tracker: UnifiedTracker;
  let writeCollectionItemMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();
    tracker.set(ARTINTRO_PAGE_COLLECTION_BC, 'artintro-page-uuid', 'collection');
    tracker.set(ITEM_BC, 'item-uuid', 'item');
    writeCollectionItemMock = vi.fn().mockResolvedValue(undefined);
  });

  it('keeps the first (lowest n) occurrence when the same item repeats on a page, instead of the last', async () => {
    // Same page, same resolved item, three distinct grid slots — mirrors the
    // legacy Umayyad Mosque case (n=1, n=5, n=9 on one page). The query is
    // already ordered by `n` ascending, matching production behavior.
    const firstOccurrence = { ...ARTINTRO_IMAGE_ROW, image_id: 42, n: 1, picture: 'images/first.jpg' };
    const secondOccurrence = { ...ARTINTRO_IMAGE_ROW, image_id: 43, n: 5, picture: 'images/second.jpg' };
    const thirdOccurrence = { ...ARTINTRO_IMAGE_ROW, image_id: 44, n: 9, picture: 'images/third.jpg' };

    const ctx = makeContext(
      makeArtintroImageQueryMock([firstOccurrence, secondOccurrence, thirdOccurrence], []),
      tracker,
      writeCollectionItemMock
    );

    const importer = new Mwnf3ExhibitionItemImporter(ctx);
    const result = await importer.import();

    // Only the first occurrence should ever reach writeCollectionItem — not
    // three separate INSERT...ON DUPLICATE KEY UPDATE calls that would let
    // the last one silently overwrite it.
    expect(writeCollectionItemMock).toHaveBeenCalledTimes(1);
    const call = writeCollectionItemMock.mock.calls[0][0] as {
      display_order: number | null;
      extra: Record<string, unknown>;
    };
    expect(call.display_order).toBe(1);
    expect(call.extra.n).toBe(1);
    expect(ctx.strategy.writeCollectionImage).toHaveBeenCalledTimes(1);
    expect(ctx.strategy.writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'images/first.jpg', display_order: 1 })
    );

    // The two skipped duplicates are still accounted for in the import stats.
    expect(result.skipped).toBe(2);
  });
});

// ===========================================================================
// Tests: a placement links the picture child item legacy shows
// ===========================================================================

const PICTURE_ROWS = [
  // objects_pictures rows are one per language; a path is one picture.
  { project_id: 'isl', country: 'jo', museum_id: 'Mus01', number: 8, type: '', image_number: 1, path: 'objects/isl/jo/1/8/1.jpg' },
  { project_id: 'isl', country: 'jo', museum_id: 'Mus01', number: 8, type: '', image_number: 2, path: 'objects/isl/jo/1/8/2.jpg' },
  { project_id: 'isl', country: 'jo', museum_id: 'Mus01', number: 9, type: '', image_number: 1, path: 'objects/isl/jo/1/9/1.jpg' },
];

function withPictures(queryMock: ReturnType<typeof vi.fn>): ReturnType<typeof vi.fn> {
  const query = queryMock as unknown as (sql: string) => Promise<unknown[]>;
  return vi.fn(async (sql: string) => {
    if (sql.includes('objects_pictures')) return PICTURE_ROWS;
    if (sql.includes('monuments_pictures')) return [];
    return query(sql);
  });
}

describe('Mwnf3ExhibitionItemImporter — placements link picture child items', () => {
  let tracker: UnifiedTracker;
  let writeCollectionItemMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();
    tracker.set(PAGE_COLLECTION_BC, 'page-collection-uuid', 'collection');
    tracker.set(ITEM_BC, 'item-uuid', 'item');
    tracker.set('mwnf3:objects_pictures:isl:jo:Mus01:8:1', 'picture-1-uuid', 'item');
    tracker.set('mwnf3:objects_pictures:isl:jo:Mus01:8:2', 'picture-2-uuid', 'item');
    writeCollectionItemMock = vi.fn().mockResolvedValue(undefined);
  });

  it('links the picture child item of the picture legacy shows', async () => {
    const row = { ...PAGE_IMAGE_ROW, picture: 'objects/isl/jo/1/8/2.jpg' };
    const ctx = makeContext(withPictures(makePageImageQueryMock([row], [])), tracker, writeCollectionItemMock);

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(writeCollectionItemMock).toHaveBeenCalledTimes(1);
    expect(writeCollectionItemMock.mock.calls[0][0].item_id).toBe('picture-2-uuid');
    expect(ctx.strategy.writeCollectionImage).not.toHaveBeenCalled();
  });

  it('keeps every variant of one item placed with two of its pictures, each with its own texts', async () => {
    const first = { ...PAGE_IMAGE_ROW, image_id: 1, n: 1, n2: 1, picture: 'objects/isl/jo/1/8/1.jpg' };
    const second = { ...PAGE_IMAGE_ROW, image_id: 2, n: 1, n2: 2, picture: 'objects/isl/jo/1/8/2.jpg' };
    const eavRows = [
      { entity_id: 1, lang_id: 'en', field: 'detail_justification', value: 'First view.' },
      { entity_id: 2, lang_id: 'en', field: 'detail_justification', value: 'Second view.' },
    ];
    const ctx = makeContext(
      withPictures(makePageImageQueryMock([first, second], eavRows)),
      tracker,
      writeCollectionItemMock
    );

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    const calls = writeCollectionItemMock.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.item_id)).toEqual(['picture-1-uuid', 'picture-2-uuid']);
    expect(calls.map((c) => c.extra.n2)).toEqual([1, 2]);
    expect(calls.map((c) => c.extra.detail_justification)).toEqual([
      { en: 'First view.' },
      { en: 'Second view.' },
    ]);
  });

  it('links the item and keeps the picture as a page image when it is another item’s picture', async () => {
    const row = { ...PAGE_IMAGE_ROW, picture: 'objects/isl/jo/1/9/1.jpg' };
    const ctx = makeContext(withPictures(makePageImageQueryMock([row], [])), tracker, writeCollectionItemMock);

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(writeCollectionItemMock.mock.calls[0][0].item_id).toBe('item-uuid');
    expect(ctx.strategy.writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({ collection_id: 'page-collection-uuid', path: 'objects/isl/jo/1/9/1.jpg', display_order: 1 })
    );
  });

  it('makes a custom exhibition photo a tagged picture item of the item, and links it', async () => {
    const row = { ...PAGE_IMAGE_ROW, picture: 'custom/exhibition/33.jpg' };
    const ctx = makeContext(withPictures(makePageImageQueryMock([row], [])), tracker, writeCollectionItemMock);

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(ctx.strategy.writeItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'picture',
        parent_id: 'item-uuid',
        backward_compatibility: 'mwnf3:exhibition_custom_pictures:custom/exhibition/33.jpg',
      })
    );
    expect(ctx.strategy.writeItemImage).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: 'custom-picture-uuid', path: 'custom/exhibition/33.jpg' })
    );
    expect(ctx.strategy.writeTag).toHaveBeenCalledWith(
      expect.objectContaining({ internal_name: 'custom exhibition picture', category: 'image-type' })
    );
    expect(ctx.strategy.attachTagsToItem).toHaveBeenCalledWith('custom-picture-uuid', ['custom-tag-uuid']);
    expect(writeCollectionItemMock.mock.calls[0][0].item_id).toBe('custom-picture-uuid');
    expect(ctx.strategy.writeCollectionImage).not.toHaveBeenCalled();
  });

  it('makes one picture item per custom photo, whatever pages place it', async () => {
    const first = { ...PAGE_IMAGE_ROW, image_id: 1, picture: 'custom/exhibition/33.jpg' };
    const ctx = makeContext(withPictures(makePageImageQueryMock([first], [])), tracker, writeCollectionItemMock);
    tracker.set('mwnf3:exhibition_custom_pictures:custom/exhibition/33.jpg', 'existing-picture-uuid', 'item');

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(ctx.strategy.writeItem).not.toHaveBeenCalled();
    expect(writeCollectionItemMock.mock.calls[0][0].item_id).toBe('existing-picture-uuid');
  });

  it('links the item and keeps the "Awaiting Image" placeholder as a page image, making no picture of it', async () => {
    const row = { ...PAGE_IMAGE_ROW, picture: 'custom/exhibition/137.jpg' };
    const ctx = makeContext(withPictures(makePageImageQueryMock([row], [])), tracker, writeCollectionItemMock);

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(ctx.strategy.writeItem).not.toHaveBeenCalled();
    expect(writeCollectionItemMock.mock.calls[0][0].item_id).toBe('item-uuid');
    expect(ctx.strategy.writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'custom/exhibition/137.jpg', display_order: 1 })
    );
  });

  it('links the item alone when the placement shows no picture', async () => {
    const row = { ...PAGE_IMAGE_ROW, picture: '' };
    const ctx = makeContext(withPictures(makePageImageQueryMock([row], [])), tracker, writeCollectionItemMock);

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(writeCollectionItemMock.mock.calls[0][0].item_id).toBe('item-uuid');
    expect(ctx.strategy.writeCollectionImage).not.toHaveBeenCalled();
  });

  it('makes a custom photo placed with no item an item of its own, its caption as its texts', async () => {
    tracker.set('mwnf3:projects:isl', 'isl-context-uuid', 'context');
    const row = { ...PAGE_IMAGE_ROW, ref_item: '', picture: 'custom/exhibition/51.jpg', project_id: 'ISL' };
    const eavRows = [
      { entity_id: row.image_id, lang_id: 'en', field: 'item_name', value: 'Cihanoğlu Mosque' },
      { entity_id: row.image_id, lang_id: 'en', field: 'item_date', value: 'AH 1170 / AD 1756–7' },
      { entity_id: row.image_id, lang_id: 'en', field: 'item_dynasty', value: 'Ottoman' },
      { entity_id: row.image_id, lang_id: 'en', field: 'item_location', value: 'Aydın, Turkey' },
      { entity_id: row.image_id, lang_id: 'en', field: 'detail_justification', value: 'Built only a year after.' },
      { entity_id: row.image_id, lang_id: 'fr', field: 'item_name', value: 'Mosquée Cihanoğlu' },
    ];
    const ctx = makeContext(withPictures(makePageImageQueryMock([row], eavRows)), tracker, writeCollectionItemMock);

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(ctx.strategy.writeItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'picture',
        parent_id: null,
        backward_compatibility: 'mwnf3:exhibition_custom_pictures:custom/exhibition/51.jpg',
      })
    );
    expect(ctx.strategy.writeItemImage).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: 'custom-picture-uuid', path: 'custom/exhibition/51.jpg' })
    );
    expect(ctx.strategy.attachTagsToItem).toHaveBeenCalledWith('custom-picture-uuid', ['custom-tag-uuid']);
    const translations = vi.mocked(ctx.strategy.writeItemTranslation).mock.calls.map((c) => c[0]);
    expect(translations).toEqual([
      expect.objectContaining({
        language_id: 'eng',
        context_id: 'isl-context-uuid',
        name: 'Cihanoğlu Mosque',
        dates: 'AH 1170 / AD 1756–7',
        location: 'Aydın, Turkey',
        description: 'Built only a year after.',
        extra: JSON.stringify({ dynasty: 'Ottoman' }),
      }),
      expect.objectContaining({ language_id: 'fra', name: 'Mosquée Cihanoğlu', dates: null }),
    ]);
    const placement = writeCollectionItemMock.mock.calls[0][0];
    expect(placement.item_id).toBe('custom-picture-uuid');
    expect(placement.extra).toMatchObject({ n: row.n, n2: row.n2, item_name: { en: 'Cihanoğlu Mosque', fr: 'Mosquée Cihanoğlu' } });
    expect(ctx.strategy.writeCollectionImage).not.toHaveBeenCalled();
  });

  it('keeps a picture placed with no item that is no custom photo as a page image', async () => {
    const row = { ...PAGE_IMAGE_ROW, ref_item: '', picture: 'objects/isl/jo/1/9/1.jpg', project_id: 'ISL' };
    const ctx = makeContext(withPictures(makePageImageQueryMock([row], [])), tracker, writeCollectionItemMock);

    await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(ctx.strategy.writeItem).not.toHaveBeenCalled();
    expect(writeCollectionItemMock).not.toHaveBeenCalled();
    expect(ctx.strategy.writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'objects/isl/jo/1/9/1.jpg', display_order: 1 })
    );
  });

  it('reports the same picture placed twice on one page and keeps the first placement', async () => {
    const first = { ...PAGE_IMAGE_ROW, image_id: 1, n: 1, picture: 'objects/isl/jo/1/8/1.jpg' };
    const again = { ...PAGE_IMAGE_ROW, image_id: 2, n: 3, picture: 'objects/isl/jo/1/8/1.jpg' };
    const ctx = makeContext(withPictures(makePageImageQueryMock([first, again], [])), tracker, writeCollectionItemMock);

    const result = await new Mwnf3ExhibitionItemImporter(ctx).import();

    expect(writeCollectionItemMock).toHaveBeenCalledTimes(1);
    expect(writeCollectionItemMock.mock.calls[0][0].display_order).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.warnings?.some((w) => w.includes('Page image 2') && w.includes('placed twice'))).toBe(true);
  });
});
