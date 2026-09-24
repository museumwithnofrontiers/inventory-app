import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ObjectPictureImporter } from '../../src/importers/phase-02/object-picture-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ObjectPictureImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeItemMock: ReturnType<typeof vi.fn>;
  let writeItemTranslationMock: ReturnType<typeof vi.fn>;
  let writeItemImageMock: ReturnType<typeof vi.fn>;

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

  // Caption row — name = caption
  const rowWithCaption = {
    project_id: 'EPM',
    country: 'qt',
    museum_id: 'Mus21',
    number: 19,
    lang: 'en',
    type: '',
    image_number: 1,
    path: 'epm/qt/mus21/19/1.jpg',
    caption: 'Gold amulet',
    photographer: null,
    copyright: null,
  };

  // Copyright-only row — name = parent title + number
  const rowCopyrightOnly = {
    project_id: 'EPM',
    country: 'qt',
    museum_id: 'Mus21',
    number: 19,
    lang: 'en',
    type: '',
    image_number: 1,
    path: 'epm/qt/mus21/19/1.jpg',
    caption: null,
    photographer: null,
    copyright: '2023 EPM',
  };

  // Empty row — translation should be skipped
  const rowEmpty = {
    project_id: 'EPM',
    country: 'qt',
    museum_id: 'Mus21',
    number: 19,
    lang: 'fr',
    type: '',
    image_number: 1,
    path: 'epm/qt/mus21/19/1.jpg',
    caption: null,
    photographer: null,
    copyright: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.setMetadata('default_context_id', 'default-ctx-uuid');

    // Parent object Item
    tracker.set('mwnf3:objects:EPM:qt:Mus21:19', 'parent-item-uuid', 'item');
    // Context / collection / project
    tracker.set('mwnf3:projects:EPM', 'context-uuid', 'context');
    tracker.set('mwnf3:projects:EPM', 'collection-uuid', 'collection');
    tracker.set('mwnf3:projects:EPM', 'project-uuid', 'project');
    // Partner (museum)
    tracker.set('mwnf3:museums:Mus21:qt', 'partner-uuid', 'partner');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3.objects_pictures')) return [rowWithCaption];
      if (sql.includes('FROM mwnf3.objects')) return [{ name: 'Museum Object Title' }];
      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeItemMock = vi.fn().mockResolvedValue('new-picture-item-uuid');
    writeItemTranslationMock = vi.fn().mockResolvedValue(undefined);
    writeItemImageMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeItem: writeItemMock,
      writeItemTranslation: writeItemTranslationMock,
      writeItemImage: writeItemImageMock,
      writeArtist: vi.fn().mockResolvedValue('artist-uuid'),
      attachArtistsToItem: vi.fn().mockResolvedValue(undefined),
      findArtistByInternalName: vi.fn().mockResolvedValue('artist-uuid'),
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('creates translation with parent title as name and caption in description when caption is present', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.objects_pictures')) return [rowWithCaption];
      if (sql.includes('FROM mwnf3.objects')) return [{ name: 'Museum Object Title' }];
      return [];
    });
    const importer = new ObjectPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Museum Object Title (1)', description: 'Gold amulet' })
    );
  });

  it('falls back to a generic "Picture N" name when the parent object title is unavailable', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.objects_pictures')) return [rowWithCaption];
      if (sql.includes('FROM mwnf3.objects')) return []; // parent not found
      return [];
    });
    const importer = new ObjectPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Picture 1', description: 'Gold amulet' })
    );
  });

  it('creates translation with parent title and number for copyright-only rows', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.objects_pictures')) return [rowCopyrightOnly];
      if (sql.includes('FROM mwnf3.objects')) return [{ name: 'Museum Object Title' }];
      return [];
    });
    const importer = new ObjectPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Museum Object Title (1)',
        extra: JSON.stringify({ copyright: '2023 EPM' }),
      })
    );
  });

  it('skips translation when no caption, photographer, or copyright', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.objects_pictures')) return [rowEmpty];
      return [];
    });
    const importer = new ObjectPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).not.toHaveBeenCalled();
  });

  it('does not create Image N placeholder names', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.objects_pictures')) return [rowEmpty];
      return [];
    });
    const importer = new ObjectPictureImporter(context);
    await importer.import();

    const calls = writeItemTranslationMock.mock.calls.flat();
    for (const arg of calls) {
      if (arg && typeof arg === 'object' && 'name' in arg) {
        expect((arg as { name: string }).name).not.toMatch(/^Image \d+/);
      }
    }
  });

  it('skips an already-imported picture cleanly on a non-wiped rerun (no writes attempted)', async () => {
    // Simulates a second process run against a persisted (non-wiped) DB: the
    // picture Item's own backward_compatibility is already known — either
    // via the in-memory tracker or (in a real rerun, a fresh process) via
    // SqlWriteStrategy.exists('items', ...), which the mock below stands in
    // for. Regression guard for the bug where the importer gated on
    // entityExistsAsync(imageKey, 'image') instead — item_images has no
    // backward_compatibility column, so that check could never detect an
    // already-imported picture from a previous run, and would attempt (and,
    // pre-idempotent-write-fix, silently duplicate) the picture again.
    (strategy.exists as ReturnType<typeof vi.fn>).mockImplementation(
      async (table: string, backwardCompatibility: string) =>
        table === 'items' && backwardCompatibility === 'mwnf3:objects_pictures:EPM:qt:Mus21:19:1'
    );

    const importer = new ObjectPictureImporter(context);
    const result = await importer.import();

    expect(writeItemMock).not.toHaveBeenCalled();
    expect(writeItemImageMock).not.toHaveBeenCalled();
    expect(writeItemTranslationMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(0);
  });

  it('falls back to a generic name (no error) when parent object not found for metadata-only row', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.objects_pictures')) return [rowCopyrightOnly];
      if (sql.includes('FROM mwnf3.objects')) return []; // parent not found
      return [];
    });
    const importer = new ObjectPictureImporter(context);
    const result = await importer.import();

    expect(result.errors.length).toBe(0);
    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Picture 1' })
    );
  });

  describe('image copyright', () => {
    // The same picture, stored once per language, with the languages
    // disagreeing — as they do for some legacy object pictures.
    const czechRow = {
      ...rowCopyrightOnly,
      lang: 'cs',
      copyright: 'Moravská galerie v Brně, Muzeum města Brna',
    };
    const englishRow = { ...rowCopyrightOnly, lang: 'en', copyright: 'Muzeum města Brna' };

    function withPictureRows(rows: object[]): void {
      queryMock.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM mwnf3.objects_pictures')) return rows;
        if (sql.includes('FROM mwnf3.objects')) return [{ name: 'Museum Object Title' }];
        return [];
      });
    }

    it('writes the English copyright, burn-ready, on both the picture and its parent', async () => {
      withPictureRows([czechRow, englishRow]);

      await new ObjectPictureImporter(context).import();

      // Image 1 of type '' is the object's first image: written on the picture
      // Item and on the parent Item.
      expect(writeItemImageMock).toHaveBeenCalledTimes(2);
      expect(writeItemImageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          item_id: 'new-picture-item-uuid',
          copyright: '© Muzeum města Brna',
        })
      );
      expect(writeItemImageMock).toHaveBeenCalledWith(
        expect.objectContaining({ item_id: 'parent-item-uuid', copyright: '© Muzeum města Brna' })
      );
    });

    it("keeps each language's own text in its translation's extra.copyright", async () => {
      withPictureRows([czechRow, englishRow]);

      await new ObjectPictureImporter(context).import();

      expect(writeItemTranslationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          extra: JSON.stringify({ copyright: 'Moravská galerie v Brně, Muzeum města Brna' }),
        })
      );
      expect(writeItemTranslationMock).toHaveBeenCalledWith(
        expect.objectContaining({ extra: JSON.stringify({ copyright: 'Muzeum města Brna' }) })
      );
    });

    it('uses the first filled language when there is no English copyright', async () => {
      withPictureRows([{ ...rowEmpty, lang: 'fr' }, czechRow]);

      await new ObjectPictureImporter(context).import();

      for (const [image] of writeItemImageMock.mock.calls) {
        expect(image).toMatchObject({ copyright: '© Moravská galerie v Brně, Muzeum města Brna' });
      }
    });

    it('leaves the column null when no language has a copyright', async () => {
      withPictureRows([rowWithCaption]);

      await new ObjectPictureImporter(context).import();

      expect(writeItemImageMock).toHaveBeenCalled();
      for (const [image] of writeItemImageMock.mock.calls) {
        expect(image).toMatchObject({ copyright: null });
      }
    });
  });

  describe('partners whose captions are descriptions', () => {
    // epm/at/Mus24 wrote art-historical descriptions of the image into
    // `caption`, where every other partner wrote a short label such as
    // "Detail". The prose belongs in the translation's `description` only.
    const mus24Caption =
      'On fol. 2b-3a, a richly decorated double page illuminates the beginning ' +
      'of the Diwan. The text, penned in <i>nasta&lsquo;liq</i> script, is ' +
      'inscribed within white cloud bands before a golden ground.';

    const mus24Row = {
      project_id: 'epm',
      country: 'at',
      museum_id: 'Mus24',
      number: 1,
      lang: 'en',
      type: '',
      image_number: 1,
      path: 'objects/epm/at/24/1/1.jpg',
      caption: mus24Caption,
      photographer: null,
      copyright: 'ANL',
    };

    beforeEach(() => {
      tracker.set('mwnf3:objects:epm:at:Mus24:1', 'parent-item-uuid', 'item');
      tracker.set('mwnf3:projects:epm', 'context-uuid', 'context');
      tracker.set('mwnf3:projects:epm', 'collection-uuid', 'collection');
      tracker.set('mwnf3:projects:epm', 'project-uuid', 'project');
      tracker.set('mwnf3:museums:Mus24:at', 'partner-uuid', 'partner');

      queryMock.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM mwnf3.objects_pictures')) return [mus24Row];
        if (sql.includes('FROM mwnf3.objects')) return [{ name: 'Diwan of Hafiz' }];
        return [];
      });
    });

    it('leaves alt_text empty and keeps the description, on both the picture and its parent', async () => {
      const importer = new ObjectPictureImporter(context);
      const result = await importer.import();

      expect(result.errors).toEqual([]);

      // Image 1 of type '' is the object's first image, so it is written twice:
      // once on the picture Item, once on the parent Item.
      expect(writeItemImageMock).toHaveBeenCalledTimes(2);
      for (const [image] of writeItemImageMock.mock.calls) {
        expect(image).toMatchObject({ alt_text: null });
      }

      expect(writeItemTranslationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('richly decorated double page'),
        })
      );
    });

    it('matches the partner whatever case legacy stores the identifiers in', async () => {
      queryMock.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM mwnf3.objects_pictures'))
          return [{ ...mus24Row, project_id: 'EPM', museum_id: 'MUS24' }];
        if (sql.includes('FROM mwnf3.objects')) return [{ name: 'Diwan of Hafiz' }];
        return [];
      });
      const importer = new ObjectPictureImporter(context);
      await importer.import();

      for (const [image] of writeItemImageMock.mock.calls) {
        expect(image).toMatchObject({ alt_text: null });
      }
    });

    it('does not affect other partners, whose captions are genuine labels', async () => {
      queryMock.mockImplementation(async (sql: string) => {
        // epm/at/Mus21 — a different museum in the same project and country.
        if (sql.includes('FROM mwnf3.objects_pictures'))
          return [{ ...rowWithCaption, caption: 'Detail' }];
        if (sql.includes('FROM mwnf3.objects')) return [{ name: 'Museum Object Title' }];
        return [];
      });
      const importer = new ObjectPictureImporter(context);
      await importer.import();

      expect(writeItemImageMock).toHaveBeenCalledWith(
        expect.objectContaining({ alt_text: 'Detail' })
      );
    });
  });
});
