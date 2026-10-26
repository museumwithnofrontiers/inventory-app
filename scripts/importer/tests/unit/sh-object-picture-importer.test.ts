import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShObjectPictureImporter } from '../../src/importers/phase-03/sh-object-picture-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ShObjectPictureImporter', () => {
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
    project_id: 'SHO',
    country: 'qt',
    number: 5,
    type: '',
    image_number: 2,
    path: 'sho/qt/5/2.jpg',
  };

  const textWithCaption = {
    project_id: 'SHO',
    country: 'qt',
    number: 5,
    type: '',
    image_number: 2,
    lang: 'en',
    caption: 'Golden vessel',
    photographer: null,
    copyright: null,
  };

  const textCopyrightOnly = {
    project_id: 'SHO',
    country: 'qt',
    number: 5,
    type: '',
    image_number: 2,
    lang: 'en',
    caption: null,
    photographer: null,
    copyright: '2023 SHO',
  };

  const textEmpty = {
    project_id: 'SHO',
    country: 'qt',
    number: 5,
    type: '',
    image_number: 2,
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

    // Parent SH object Item
    tracker.set('mwnf3_sharing_history:sh_objects:sho:qt:5', 'parent-item-uuid', 'item');
    // Project / context / collection
    tracker.set('mwnf3_sharing_history:sh_projects:sho', 'context-uuid', 'context');
    tracker.set('mwnf3_sharing_history:sh_projects:sho', 'collection-uuid', 'collection');
    tracker.set('mwnf3_sharing_history:sh_projects:sho', 'project-uuid', 'project');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('sh_object_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_object_image_texts')) return [textWithCaption];
      if (sql.includes('sh_objects_texts')) return [{ name: 'SH Object Title' }];
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
      if (sql.includes('sh_object_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_object_image_texts')) return [textWithCaption];
      if (sql.includes('sh_objects_texts')) return [{ name: 'SH Object Title' }];
      return [];
    });
    const importer = new ShObjectPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'SH Object Title (2)', description: 'Golden vessel' })
    );
  });

  it('falls back to a generic "Picture N" name when the parent SH object title is unavailable', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_object_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_object_image_texts')) return [textWithCaption];
      if (sql.includes('sh_objects_texts')) return []; // parent not found
      return [];
    });
    const importer = new ShObjectPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Picture 2', description: 'Golden vessel' })
    );
  });

  it('creates translation with parent title and image_number for copyright-only rows', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_object_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_object_image_texts')) return [textCopyrightOnly];
      if (sql.includes('sh_objects_texts')) return [{ name: 'SH Object Title' }];
      return [];
    });
    const importer = new ShObjectPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'SH Object Title (2)',
        extra: JSON.stringify({ copyright: '2023 SHO' }),
      })
    );
  });

  // Legacy shows a picture on a page only where it has a row in that language,
  // so a row with no text is kept: the row itself is the data.
  it('keeps a translation row with no caption, photographer or copyright', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_object_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_object_image_texts')) return [textEmpty];
      return [];
    });
    const importer = new ShObjectPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledTimes(1);
    expect(writeItemTranslationMock.mock.calls[0]![0]).toMatchObject({ description: '' });
  });

  it('does not create Image N placeholder names', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_object_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_object_image_texts')) return [textEmpty];
      return [];
    });
    const importer = new ShObjectPictureImporter(context);
    await importer.import();

    const calls = writeItemTranslationMock.mock.calls.flat();
    for (const arg of calls) {
      if (arg && typeof arg === 'object' && 'name' in arg) {
        expect((arg as { name: string }).name).not.toMatch(/^Image \d+/);
      }
    }
  });

  it('falls back to a generic name (no error) when parent SH object not found for metadata-only row', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_object_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_object_image_texts')) return [textCopyrightOnly];
      if (sql.includes('sh_objects_texts')) return []; // parent not found
      return [];
    });
    const importer = new ShObjectPictureImporter(context);
    const result = await importer.import();

    expect(result.errors.length).toBe(0);
    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Picture 2' })
    );
  });

  it('queries sh_objects_texts (not sh_object_texts) for parent name lookup', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_object_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_object_image_texts')) return [textCopyrightOnly];
      if (sql.includes('sh_objects_texts')) return [{ name: 'SH Object Title' }];
      return [];
    });
    const importer = new ShObjectPictureImporter(context);
    await importer.import();

    const parentLookupCall = queryMock.mock.calls.find(
      (args: unknown[]) => (args[0] as string).includes('sh_objects_texts')
    );
    expect(parentLookupCall).toBeDefined();
    const sql = parentLookupCall![0] as string;
    expect(sql).toContain('sh_objects_texts');
    expect(sql).not.toContain('sh_object_texts');
  });

  it('truncates overlong metadata-only name to 255 characters', async () => {
    const longParentName = 'B'.repeat(260);
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('sh_object_images') && !sql.includes('texts')) return [imageRow];
      if (sql.includes('sh_object_image_texts')) return [textCopyrightOnly];
      if (sql.includes('sh_objects_texts')) return [{ name: longParentName }];
      return [];
    });
    const importer = new ShObjectPictureImporter(context);
    await importer.import();

    expect(writeItemTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.any(String) })
    );
    const name: string = (writeItemTranslationMock.mock.calls[0]![0] as { name: string }).name;
    expect(name.length).toBeLessThanOrEqual(255);
  });
});
