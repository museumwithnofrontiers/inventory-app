import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MonumentDetailPictureImporter } from '../../src/importers/phase-02/monument-detail-picture-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('MonumentDetailPictureImporter', () => {
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

  // Caption row
  const rowWithCaption = {
    project_id: 'ISL',
    country_id: 'ma',
    institution_id: 'Mon01',
    monument_id: 1,
    detail_id: 5,
    lang_id: 'en',
    picture_id: 10,
    path: 'isl/ma/mon01/1/5/10.jpg',
    caption: 'Detail view',
    photographer: null,
    copyright: null,
  };

  // Photographer-only row — name = parent title + picture_id
  const rowPhotographerOnly = {
    project_id: 'ISL',
    country_id: 'ma',
    institution_id: 'Mon01',
    monument_id: 1,
    detail_id: 5,
    lang_id: 'en',
    picture_id: 10,
    path: 'isl/ma/mon01/1/5/10.jpg',
    caption: null,
    photographer: 'Ahmed Photographer',
    copyright: null,
  };

  // Empty row — translation should be skipped
  const rowEmpty = {
    project_id: 'ISL',
    country_id: 'ma',
    institution_id: 'Mon01',
    monument_id: 1,
    detail_id: 5,
    lang_id: 'fr',
    picture_id: 10,
    path: 'isl/ma/mon01/1/5/10.jpg',
    caption: null,
    photographer: null,
    copyright: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.setMetadata('default_context_id', 'default-ctx-uuid');

    // Parent monument detail Item
    tracker.set('mwnf3:monument_details:ISL:ma:Mon01:1:5', 'parent-item-uuid', 'item');
    // Context / collection / project
    tracker.set('mwnf3:projects:ISL', 'context-uuid', 'context');
    tracker.set('mwnf3:projects:ISL', 'collection-uuid', 'collection');
    tracker.set('mwnf3:projects:ISL', 'project-uuid', 'project');
    // Partner (institution)
    tracker.set('mwnf3:institutions:Mon01:ma', 'partner-uuid', 'partner');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_detail_pictures')) return [rowWithCaption];
      if (sql.includes('FROM mwnf3.monument_details')) return [{ name: 'Mosque Detail' }];
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
      if (sql.includes('FROM mwnf3.monument_detail_pictures')) return [rowWithCaption];
      if (sql.includes('FROM mwnf3.monument_details')) return [{ name: 'Mosque Detail' }];
      return [];
    });
    const importer = new MonumentDetailPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Mosque Detail (10)', description: 'Detail view' })
    );
  });

  it('falls back to a generic "Picture N" name when the parent detail title is unavailable', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_detail_pictures')) return [rowWithCaption];
      if (sql.includes('FROM mwnf3.monument_details')) return []; // parent not found
      return [];
    });
    const importer = new MonumentDetailPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Picture 10', description: 'Detail view' })
    );
  });

  it('creates translation with parent title and picture_id for photographer-only rows', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_detail_pictures')) return [rowPhotographerOnly];
      if (sql.includes('FROM mwnf3.monument_details')) return [{ name: 'Mosque Detail' }];
      return [];
    });
    const importer = new MonumentDetailPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Mosque Detail (10)' })
    );
  });

  it('skips translation when no caption, photographer, or copyright', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_detail_pictures')) return [rowEmpty];
      return [];
    });
    const importer = new MonumentDetailPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).not.toHaveBeenCalled();
  });

  it('does not create Image N placeholder names', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_detail_pictures')) return [rowEmpty];
      return [];
    });
    const importer = new MonumentDetailPictureImporter(context);
    await importer.import();

    const calls = writeItemTranslationMock.mock.calls.flat();
    for (const arg of calls) {
      if (arg && typeof arg === 'object' && 'name' in arg) {
        expect((arg as { name: string }).name).not.toMatch(/^Image \d+/);
      }
    }
  });

  it('falls back to a generic name (no error) when parent detail not found for metadata-only row', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_detail_pictures')) return [rowPhotographerOnly];
      if (sql.includes('FROM mwnf3.monument_details')) return []; // not found
      return [];
    });
    const importer = new MonumentDetailPictureImporter(context);
    const result = await importer.import();

    expect(result.errors.length).toBe(0);
    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Picture 10' })
    );
  });

  it('queries mwnf3.monument_details (not monuments_details) for parent name lookup', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_detail_pictures')) return [rowPhotographerOnly];
      if (sql.includes('FROM mwnf3.monument_details')) return [{ name: 'Mosque Detail' }];
      return [];
    });
    const importer = new MonumentDetailPictureImporter(context);
    await importer.import();

    const parentLookupCall = queryMock.mock.calls.find(
      (args: unknown[]) => (args[0] as string).includes('mwnf3.monument_details')
    );
    expect(parentLookupCall).toBeDefined();
    const sql = parentLookupCall![0] as string;
    expect(sql).toContain('FROM mwnf3.monument_details');
    expect(sql).not.toContain('FROM mwnf3.monuments_details');
  });

  it('truncates overlong metadata-only name to 255 characters', async () => {
    const longParentName = 'A'.repeat(260);
    const rowLong = { ...rowPhotographerOnly, picture_id: 99 };
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_detail_pictures')) return [rowLong];
      if (sql.includes('FROM mwnf3.monument_details')) return [{ name: longParentName }];
      return [];
    });
    const importer = new MonumentDetailPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.any(String) })
    );
    const name: string = (writeItemTranslationMock.mock.calls[0]![0] as { name: string }).name;
    expect(name.length).toBeLessThanOrEqual(255);
  });

  it('writes the English copyright, burn-ready, on the image row (rows keyed by lang_id)', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_detail_pictures'))
        return [
          { ...rowPhotographerOnly, lang_id: 'fr', copyright: 'Musée national' },
          { ...rowPhotographerOnly, lang_id: 'en', copyright: 'National Museum' },
        ];
      if (sql.includes('FROM mwnf3.monument_details')) return [{ name: 'Mosque Detail' }];
      return [];
    });
    const importer = new MonumentDetailPictureImporter(context);
    await importer.import();

    expect(writeItemImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ copyright: '© National Museum' })
    );
  });

  it('succeeds for a picture whose parent detail was imported without a parent monument (parentless detail)', async () => {
    // Parent monument is NOT in tracker — detail was imported with parent_id = null.
    // The picture importer should still succeed because it looks up the detail by BC, not the monument.
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.monument_detail_pictures')) return [rowWithCaption];
      return [];
    });
    const importer = new MonumentDetailPictureImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(writeItemMock).toHaveBeenCalled();
    expect(writeItemTranslationMock).toHaveBeenCalled();
  });
});
