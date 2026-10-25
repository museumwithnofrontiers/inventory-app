import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShMonumentPictureImporter } from '../../src/importers/phase-03/sh-monument-picture-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ShMonumentPictureImporter', () => {
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

  // SH monument image row (just path + PK)
  const imageRow = {
    project_id: 'SHP',
    country: 'hr',
    number: 1,
    type: '',
    image_number: 1,
    path: 'shp/hr/1/1.jpg',
  };

  // Text row with caption
  const textWithCaption = {
    project_id: 'SHP',
    country: 'hr',
    number: 1,
    type: '',
    image_number: 1,
    lang: 'en',
    caption: 'Harbour fortress',
    photographer: null,
    copyright: null,
  };

  // Metadata-only text row (photographer, no caption)
  const textMetadataOnly = {
    project_id: 'SHP',
    country: 'hr',
    number: 1,
    type: '',
    image_number: 1,
    lang: 'en',
    caption: null,
    photographer: 'Photo Artist',
    copyright: null,
  };

  // Empty text row — should be skipped
  const textEmpty = {
    project_id: 'SHP',
    country: 'hr',
    number: 1,
    type: '',
    image_number: 1,
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

    // Parent monument Item (SH backward compat uses lowercase)
    tracker.set('mwnf3_sharing_history:sh_monuments:shp:hr:1', 'parent-item-uuid', 'item');
    // Project / context / collection
    tracker.set(
      'mwnf3_sharing_history:sh_projects:shp',
      'context-uuid',
      'context'
    );
    tracker.set(
      'mwnf3_sharing_history:sh_projects:shp',
      'collection-uuid',
      'collection'
    );
    tracker.set(
      'mwnf3_sharing_history:sh_projects:shp',
      'project-uuid',
      'project'
    );

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('sh_monument_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_monument_image_texts')) return [textWithCaption];
      if (sql.includes('sh_monuments_texts')) return [{ name: 'Dubrovnik Fortress' }];
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
      if (sql.includes('sh_monument_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_monument_image_texts')) return [textWithCaption];
      if (sql.includes('sh_monuments_texts')) return [{ name: 'Dubrovnik Fortress' }];
      return [];
    });
    const importer = new ShMonumentPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Dubrovnik Fortress (1)', description: 'Harbour fortress' })
    );
  });

  it('falls back to a generic "Picture N" name when the parent SH monument title is unavailable', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_monument_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_monument_image_texts')) return [textWithCaption];
      if (sql.includes('sh_monuments_texts')) return []; // parent not found
      return [];
    });
    const importer = new ShMonumentPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Picture 1', description: 'Harbour fortress' })
    );
  });

  it('creates translation with parent title and image_number for metadata-only rows', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_monument_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_monument_image_texts')) return [textMetadataOnly];
      if (sql.includes('sh_monuments_texts')) return [{ name: 'Dubrovnik Fortress' }];
      return [];
    });
    const importer = new ShMonumentPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Dubrovnik Fortress (1)' })
    );
  });

  // Legacy shows a picture on a page only where it has a row in that language,
  // so a row with no text is kept: the row itself is the data.
  it('keeps a translation row with no caption, photographer or copyright', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_monument_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_monument_image_texts')) return [textEmpty];
      return [];
    });
    const importer = new ShMonumentPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledTimes(1);
    expect(writeItemTranslationMock.mock.calls[0]![0]).toMatchObject({ description: '' });
  });

  it('does not create Image N placeholder names', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_monument_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_monument_image_texts')) return [textEmpty];
      return [];
    });
    const importer = new ShMonumentPictureImporter(context);
    await importer.import();

    const calls = writeItemTranslationMock.mock.calls.flat();
    for (const arg of calls) {
      if (arg && typeof arg === 'object' && 'name' in arg) {
        expect((arg as { name: string }).name).not.toMatch(/^Image \d+/);
      }
    }
  });

  it('falls back to a generic name (no error) when parent SH monument not found for metadata-only row', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_monument_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_monument_image_texts')) return [textMetadataOnly];
      if (sql.includes('sh_monuments_texts')) return []; // parent not found
      return [];
    });
    const importer = new ShMonumentPictureImporter(context);
    const result = await importer.import();

    expect(result.errors.length).toBe(0);
    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Picture 1' })
    );
  });

  it('succeeds with no translations when picture text table does not exist', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_monument_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_monument_image_texts'))
        throw new Error('Table not found');
      return [];
    });
    const importer = new ShMonumentPictureImporter(context);
    const result = await importer.import();

    // Missing text table should not cause a fatal error (logged as warning only)
    expect(result.errors.length).toBe(0);
    expect(writeItemTranslationMock).not.toHaveBeenCalled();
  });
});
