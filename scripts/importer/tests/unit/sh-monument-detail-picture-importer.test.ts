import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShMonumentDetailPictureImporter } from '../../src/importers/phase-03/sh-monument-detail-picture-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ShMonumentDetailPictureImporter', () => {
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

  const imageRow = {
    project_id: 'SHD',
    country: 'hr',
    number: 3,
    detail_id: 7,
    picture_id: 2,
    path: 'shd/hr/3/7/2.jpg',
  };

  const textWithCaption = {
    project_id: 'SHD',
    country: 'hr',
    number: 3,
    detail_id: 7,
    picture_id: 2,
    lang: 'en',
    caption: 'Carved stone detail',
    photographer: null,
    copyright: null,
  };

  const textPhotographerOnly = {
    project_id: 'SHD',
    country: 'hr',
    number: 3,
    detail_id: 7,
    picture_id: 2,
    lang: 'en',
    caption: null,
    photographer: 'Maria Photographer',
    copyright: null,
  };

  const textEmpty = {
    project_id: 'SHD',
    country: 'hr',
    number: 3,
    detail_id: 7,
    picture_id: 2,
    lang: 'fr',
    caption: null,
    photographer: null,
    copyright: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.setMetadata('default_context_id', 'default-ctx-uuid');

    // Parent SH monument detail Item
    tracker.set('mwnf3_sharing_history:sh_monument_details:shd:hr:3:7', 'parent-item-uuid', 'item');
    // Project / context / collection
    tracker.set('mwnf3_sharing_history:sh_projects:shd', 'context-uuid', 'context');
    tracker.set('mwnf3_sharing_history:sh_projects:shd', 'collection-uuid', 'collection');
    tracker.set('mwnf3_sharing_history:sh_projects:shd', 'project-uuid', 'project');

    queryMock = vi.fn(async (sql: string) => {
      if (
        sql.includes('sh_monument_detail_pictures') &&
        !sql.includes('texts')
      )
        return [imageRow];
      if (sql.includes('sh_monument_detail_picture_texts')) return [textWithCaption];
      if (sql.includes('sh_monument_detail_texts')) return [{ name: 'Detail Section' }];
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
      if (sql.includes('sh_monument_detail_pictures') && !sql.includes('texts'))
        return [imageRow];
      if (sql.includes('sh_monument_detail_picture_texts')) return [textWithCaption];
      if (sql.includes('sh_monument_detail_texts')) return [{ name: 'Detail Section' }];
      return [];
    });
    const importer = new ShMonumentDetailPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Detail Section (2)', description: 'Carved stone detail' })
    );
  });

  it('falls back to a generic "Picture N" name when the parent detail title is unavailable', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_monument_detail_pictures') && !sql.includes('texts'))
        return [imageRow];
      if (sql.includes('sh_monument_detail_picture_texts')) return [textWithCaption];
      if (sql.includes('sh_monument_detail_texts')) return []; // parent not found
      return [];
    });
    const importer = new ShMonumentDetailPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Picture 2', description: 'Carved stone detail' })
    );
  });

  it('creates translation with parent title and picture_id for photographer-only rows', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_monument_detail_pictures') && !sql.includes('texts'))
        return [imageRow];
      if (sql.includes('sh_monument_detail_picture_texts')) return [textPhotographerOnly];
      if (sql.includes('sh_monument_detail_texts')) return [{ name: 'Detail Section' }];
      return [];
    });
    const importer = new ShMonumentDetailPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Detail Section (2)' })
    );
  });

  // Legacy shows a picture on a page only where it has a row in that language,
  // so a row with no text is kept: the row itself is the data.
  it('keeps a translation row with no caption, photographer or copyright', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_monument_detail_pictures') && !sql.includes('texts'))
        return [imageRow];
      if (sql.includes('sh_monument_detail_picture_texts')) return [textEmpty];
      return [];
    });
    const importer = new ShMonumentDetailPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledTimes(1);
    expect(writeItemTranslationMock.mock.calls[0]![0]).toMatchObject({ description: '' });
  });

  it('does not create Image N placeholder names', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_monument_detail_pictures') && !sql.includes('texts'))
        return [imageRow];
      if (sql.includes('sh_monument_detail_picture_texts')) return [textEmpty];
      return [];
    });
    const importer = new ShMonumentDetailPictureImporter(context);
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
      if (sql.includes('sh_monument_detail_pictures') && !sql.includes('texts'))
        return [imageRow];
      if (sql.includes('sh_monument_detail_picture_texts')) return [textPhotographerOnly];
      if (sql.includes('sh_monument_detail_texts')) return []; // not found
      return [];
    });
    const importer = new ShMonumentDetailPictureImporter(context);
    const result = await importer.import();

    expect(result.errors.length).toBe(0);
    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Picture 2' })
    );
  });
});
