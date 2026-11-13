import { describe, expect, it, vi } from 'vitest';

import {
  editionBackwardCompat,
  legacyTexts,
  parseCatalogueCodes,
  pickReferenceEdition,
  publicationCategory,
  refTrailBackwardCompat,
  shopLinks,
  translationExtra,
  translationTexts,
  type LegacyEdition,
} from '../../src/domain/transformers/publication-transformer.js';
import {
  PublicationImporter,
  publicationExtra,
} from '../../src/importers/phase-12/publication-importer.js';
import { PublicationEditionImporter } from '../../src/importers/phase-12/publication-edition-importer.js';
import {
  PublicationItemImporter,
  citations,
  recordBooksId,
} from '../../src/importers/phase-12/publication-relation-importer.js';
import {
  PublicationImageImporter,
  pictureEditionKey,
} from '../../src/importers/phase-12/publication-image-importer.js';
import { editionDocuments } from '../../src/importers/phase-12/publication-document-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

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

function makeContext(
  tracker: UnifiedTracker,
  rowsFor: (sql: string) => unknown[],
  strategy: Partial<IWriteStrategy>
): ImportContext {
  const legacyDb: ILegacyDatabase = {
    query: vi.fn(async (sql: string) => rowsFor(sql)) as ILegacyDatabase['query'],
    execute: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  return {
    legacyDb,
    strategy: {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      ...strategy,
    } as unknown as IWriteStrategy,
    tracker,
    logger,
    dryRun: false,
  };
}

function edition(overrides: Partial<LegacyEdition>): LegacyEdition {
  return {
    book_id: 1,
    lang_id: 'en',
    type: 'book',
    edition: '1',
    publisher_id: 31,
    publish_year: '2001',
    title: 'Islamic Art in Portugal',
    subtitle: null,
    description1: null,
    description2: 'About it',
    author: 'An Author',
    photographer: null,
    local_coordinator: null,
    remarks1: null,
    remarks2: null,
    ...overrides,
  };
}

describe('publication mappings', () => {
  it('maps legacy categories, ignoring MWNF BOOKS, with the two works Pascal decided', () => {
    expect(publicationCategory(1, [3])).toBe('exhibition-trail');
    expect(publicationCategory(33, [2])).toBe('virtual-museum');
    expect(publicationCategory(59, [4])).toBe('educational');
    expect(publicationCategory(52, [1, 5])).toBe('other');
    expect(publicationCategory(48, [2, 4])).toBe('educational');
    expect(publicationCategory(53, [3, 5])).toBe('other');
    expect(publicationCategory(99, [2, 4])).toBeNull();
  });

  it('keys an edition by work, language, publisher, format and edition', () => {
    expect(editionBackwardCompat(edition({ type: 'digp', edition: '2' }))).toBe(
      'mwnf3:books:1:en:31:digp:2'
    );
  });

  it("takes the translation's texts from the most recent edition, print first on a tie", () => {
    const old = edition({ publish_year: '2001', description2: 'Old' });
    const ebook = edition({
      type: 'ebook',
      edition: '2',
      publish_year: '2010',
      description2: 'New',
    });
    const digp = edition({ type: 'digp', edition: '2', publish_year: '2010', description2: 'New' });
    expect(pickReferenceEdition([old, ebook, digp])).toBe(digp);
    expect(translationTexts(digp)).toMatchObject({
      title: 'Islamic Art in Portugal',
      description: 'New',
    });
  });

  it("keeps an edition's differing texts, and the remarks, each under its own key", () => {
    const reference = edition({ description2: 'New', remarks1: 'r' });
    const other = edition({
      type: 'book',
      publish_year: '2001',
      description2: 'Old',
      title: 'Islamic Art in Portugal',
    });
    // remarks1: empty on this version, so it shows none (legacy prints the version's row).
    expect(legacyTexts(other, reference)).toEqual({ description2: 'Old', remarks1: '' });
    expect(legacyTexts(reference, reference)).toBeNull();
    expect(translationExtra(reference)).toEqual({ remarks_1: 'r' });
  });

  it('keeps a count legacy wrote as more than a number, whole', () => {
    const reference = edition({
      count_images: '868 + a DVD with 55,000 supplementary digital images',
      count_pages: '288',
    });
    expect(legacyTexts(reference, reference)).toEqual({
      count_images: '868 + a DVD with 55,000 supplementary digital images',
    });
  });

  it('keeps the shop links as name and URL pairs', () => {
    expect(
      shopLinks({
        get_from_name_01: 'Amazon',
        get_from_url_01: 'https://a.example/b',
        get_from_url_02: ' ',
      })
    ).toEqual([{ name: 'Amazon', url: 'https://a.example/b' }]);
    expect(shopLinks({})).toBeNull();
  });

  it('reads ref_trail and the catalogue codes, typos included', () => {
    expect(refTrailBackwardCompat('IAM;pt;1')).toBe('mwnf3_travels:trail:IAM:pt:1');
    expect(refTrailBackwardCompat('')).toBeNull();
    const { codes, unparsed } = parseCatalogueCodes(
      'IAM_PT_EN_001; IAM_MA_EN_OO1.; IAM_X; Al-Umawiyyun p. 114'
    );
    expect(codes.map((c) => c.trailBackwardCompat)).toEqual([
      'mwnf3_travels:trail:IAM:pt:1',
      'mwnf3_travels:trail:IAM:ma:1',
    ]);
    expect(unparsed).toEqual(['IAM_X']);
  });

  it('records a work’s region, date and legacy category apart', () => {
    expect(publicationExtra({ region: ' North ', date: '0000-00-00', category: 'other' })).toEqual({
      region: 'North',
      legacy_category: 'other',
    });
  });

  it('links a cover to the edition its number names, a page only when one edition fits', () => {
    const editions = [
      { book_id: 1, lang_id: 'en', type: 'book', edition: '1', publisher_id: 31 },
      { book_id: 1, lang_id: 'en', type: 'book', edition: '2', publisher_id: 31 },
      { book_id: 1, lang_id: 'en', type: 'ebook', edition: '2', publisher_id: 31 },
    ];
    const picture = {
      book_id: 1,
      lang_id: 'en',
      publisher_id: 31,
      path: 'p',
      caption: null,
      photographer: null,
      copyright: null,
    };
    expect(
      pictureEditionKey({ ...picture, booktype: 'book', image_number: 2, type: 'cover' }, editions)
    ).toBe('mwnf3:books:1:en:31:book:2');
    expect(
      pictureEditionKey({ ...picture, booktype: 'book', image_number: 7, type: 'page' }, editions)
    ).toBeNull();
    expect(
      pictureEditionKey({ ...picture, booktype: 'ebook', image_number: 7, type: 'page' }, editions)
    ).toBe('mwnf3:books:1:en:31:ebook:2');
  });

  it('reads the books id of an Explore Travel Book from its links', () => {
    expect(
      recordBooksId({
        id: 4,
        texts: { eng: { read_more: 'https://books.museumwnf.org/book/12/en' } },
      })
    ).toBe(12);
    expect(recordBooksId({ id: 4, texts: { eng: { read_more: null } } })).toBeNull();
  });
});

describe('publication importers', () => {
  it('writes a publication with its category, project and extra', async () => {
    const tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    tracker.set('mwnf3:projects:IAM', 'project-iam', 'project');
    const write = vi.fn().mockResolvedValue('pub');
    const context = makeContext(
      tracker,
      (sql) =>
        sql.includes('books_books_category')
          ? [{ book_id: 1, category_id: 3 }]
          : [
              {
                book_id: 1,
                name: 'Portugal',
                project_id: 'IAM',
                country: 'pt',
                display_lang_id: 'en',
                category: 'mwnf',
                region: null,
                date: null,
              },
            ],
      { writePublication: write }
    );
    const result = await new PublicationImporter(context).import();
    expect(result.errors).toEqual([]);
    expect(write.mock.calls[0]![0]).toMatchObject({
      backward_compatibility: 'mwnf3:bookbase:1',
      category: 'exhibition-trail',
      project_id: 'project-iam',
      language_id: 'eng',
      status: 'published',
      extra: JSON.stringify({ legacy_category: 'mwnf' }),
    });
  });

  it('writes every edition, hidden ones not visible, with their shop links in extra', async () => {
    const tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    tracker.set('mwnf3:bookbase:1', 'pub-1', 'publication');
    const write = vi.fn().mockResolvedValue('ed');
    const rows = [
      {
        ...edition({}),
        display: 'n',
        publisher_name: 'MWNF',
        get_from_name_01: 'Shop',
        get_from_url_01: 'https://shop.example',
      },
    ];
    const context = makeContext(tracker, () => rows, { writePublicationEdition: write });
    const result = await new PublicationEditionImporter(context).import();
    expect(result.errors).toEqual([]);
    const data = write.mock.calls[0]![0];
    expect(data).toMatchObject({
      format: 'print',
      edition: 1,
      publish_year: 2001,
      visible: false,
      publisher: 'MWNF',
    });
    expect(JSON.parse(data.extra)).toEqual({
      shop_links: [{ name: 'Shop', url: 'https://shop.example' }],
    });
  });

  it('gives each version its own row of a file two versions share, and drops a row of no version', async () => {
    const tracker = new UnifiedTracker();
    tracker.set('mwnf3:bookbase:11', 'pub-11', 'publication');
    tracker.set('mwnf3:books:11:de:31:book:1', 'ed-book-1', 'publication_edition');
    tracker.set('mwnf3:books:11:de:31:digp:2', 'ed-digp-2', 'publication_edition');
    const write = vi.fn();
    const picture = (booktype: string, n: number, path: string) => ({
      book_id: 11,
      lang_id: 'de',
      booktype,
      image_number: n,
      path,
      caption: null,
      photographer: null,
      copyright: null,
      type: 'cover',
      publisher_id: 31,
    });
    const context = makeContext(
      tracker,
      (sql) =>
        sql.includes('books_pictures')
          ? [
              picture('book', 1, 'books/11/de/31/book/1.jpg'),
              // Legacy's own row for a version de has no print edition 2 of: no version shows it…
              picture('book', 2, 'books/11/de/31/book/2.jpg'),
              // …and the print-on-demand edition 2 shows that same file as its cover.
              picture('digp', 2, 'books/11/de/31/book/2.jpg'),
            ]
          : [
              { book_id: 11, lang_id: 'de', type: 'book', edition: '1', publisher_id: 31 },
              { book_id: 11, lang_id: 'de', type: 'digp', edition: '2', publisher_id: 31 },
            ],
      { writePublicationImage: write, imageExists: vi.fn().mockResolvedValue(null) }
    );
    const result = await new PublicationImageImporter(context).import();
    expect(result.errors).toEqual([]);
    expect(write.mock.calls.map(([data]) => [data.path, data.publication_edition_id])).toEqual([
      ['books/11/de/31/book/1.jpg', 'ed-book-1'],
      ['books/11/de/31/book/2.jpg', 'ed-digp-2'],
    ]);
  });

  it('gives a second version of a shared page file a row of its own, the first keeping its id', async () => {
    const tracker = new UnifiedTracker();
    tracker.set('mwnf3:bookbase:1', 'pub-1', 'publication');
    tracker.set('mwnf3:books:1:fr:31:book:1', 'ed-book-1', 'publication_edition');
    tracker.set('mwnf3:books:1:fr:31:digp:2', 'ed-digp-2', 'publication_edition');
    const write = vi.fn();
    const page = (booktype: string) => ({
      book_id: 1,
      lang_id: 'fr',
      booktype,
      image_number: 8,
      path: 'books/1/fr/31/book/pages/8.jpg',
      caption: null,
      photographer: null,
      copyright: null,
      type: 'page',
      publisher_id: 31,
    });
    const context = makeContext(
      tracker,
      (sql) =>
        sql.includes('books_pictures')
          ? [page('book'), page('digp')]
          : [
              { book_id: 1, lang_id: 'fr', type: 'book', edition: '1', publisher_id: 31 },
              { book_id: 1, lang_id: 'fr', type: 'digp', edition: '2', publisher_id: 31 },
            ],
      { writePublicationImage: write, imageExists: vi.fn().mockResolvedValue(null) }
    );
    const result = await new PublicationImageImporter(context).import();
    expect(result.errors).toEqual([]);
    const rows = write.mock.calls.map(([data]) => data);
    expect(rows.map((r) => r.publication_edition_id)).toEqual(['ed-book-1', 'ed-digp-2']);
    expect(rows[0].id).toBeUndefined();
    expect(rows[1].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('links only the cited items that are not entries of the cited trail', async () => {
    expect(
      citations([{ item_key: 'o1', linkcatalogs: 'IAM_PT_EN_001; IAM_PT_FR_001' }]).cited.get(
        'o1|mwnf3_travels:trail:IAM:pt:1'
      )!.codes
    ).toEqual(['IAM_PT_EN_001', 'IAM_PT_FR_001']);

    const tracker = new UnifiedTracker();
    tracker.set('mwnf3:bookbase:1', 'pub-1', 'publication');
    tracker.set('mwnf3:objects:ISL:pt:Mus01:1', 'obj-1', 'item');
    tracker.set('mwnf3:objects:ISL:pt:Mus01:2', 'obj-2', 'item');
    const write = vi.fn();
    const context = makeContext(
      tracker,
      (sql) => {
        if (sql.includes('FROM mwnf3.objects_trails')) {
          return [
            { item_key: 'mwnf3:objects:ISL:pt:Mus01:2', trail_key: 'mwnf3_travels:trail:IAM:pt:1' },
          ];
        }
        if (sql.includes('FROM mwnf3.bookbase')) return [{ book_id: 1, ref_trail: 'IAM;pt;1' }];
        return [
          { item_key: 'mwnf3:objects:ISL:pt:Mus01:1', linkcatalogs: 'IAM_PT_EN_001' },
          { item_key: 'mwnf3:objects:ISL:pt:Mus01:2', linkcatalogs: 'IAM_PT_EN_001' },
        ];
      },
      { writePublicationRelation: write }
    );
    const result = await new PublicationItemImporter(context).import();
    expect(result.errors).toEqual([]);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('publication_item', {
      publication_id: 'pub-1',
      related_id: 'obj-1',
      display_order: 1,
      extra: { linkcatalogs: ['IAM_PT_EN_001'] },
    });
  });
});

describe('publication documents', () => {
  it("keys an edition's sample and credits PDFs by its edition", () => {
    expect(
      editionDocuments({
        book_id: 51,
        lang_id: 'it',
        type: 'ebook',
        edition: '2',
        publisher_id: 31,
        path_catalogue: 'books/51/it/31/ebook/sample.pdf',
        path_credits: ' ',
      })
    ).toEqual([
      {
        kind: 'sample',
        path: 'books/51/it/31/ebook/sample.pdf',
        backwardCompat: 'mwnf3:books:51:it:31:ebook:2:sample',
      },
    ]);
  });
});
