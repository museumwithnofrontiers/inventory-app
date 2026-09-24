import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShPartnerPictureImporter } from '../../src/importers/phase-03/sh-partner-picture-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ShPartnerPictureImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writePartnerImageMock: ReturnType<typeof vi.fn>;

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

  // Sample rows matching the issue's AT_01/DZ_01 examples
  const at01Row1 = {
    image_number: 1,
    partners_id: 'AT_01',
    path: 'sharing_history/sh_partners/at_01/1.jpg',
    thumb: null,
    lastupdate: null,
    caption: 'Main gallery image',
    photographer: 'John Doe',
    copyright: '2023 Museum',
  };
  const at01Row2 = {
    image_number: 2,
    partners_id: 'AT_01',
    path: '2.jpg',
    thumb: null,
    lastupdate: null,
    caption: null,
    photographer: null,
    copyright: null,
  };
  const at01Row3 = {
    image_number: 3,
    partners_id: 'AT_01',
    path: '3.jpg',
    thumb: null,
    lastupdate: null,
    caption: '  ',
    photographer: null,
    copyright: null,
  };
  const dz01Row1 = {
    image_number: 1,
    partners_id: 'DZ_01',
    path: 'sharing_history/sh_partners/dz_01/1.jpg',
    thumb: null,
    lastupdate: null,
    caption: 'DZ gallery image',
    photographer: null,
    copyright: 'DZ Museum',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    // Register AT_01 and DZ_01 partners using the SH backward_compat key format
    tracker.set('mwnf3_sharing_history:sh_partners:at_01', 'partner-at01-uuid', 'partner');
    tracker.set('mwnf3_sharing_history:sh_partners:dz_01', 'partner-dz01-uuid', 'partner');

    queryMock = vi.fn(async () => {
      return [at01Row1, at01Row2, at01Row3, dz01Row1];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writePartnerImageMock = vi.fn().mockResolvedValue('new-partner-image-uuid');

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      imageExists: vi.fn().mockResolvedValue(null),
      writePartnerImage: writePartnerImageMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('imports AT_01 3 images and DZ_01 1 image successfully', async () => {
    const importer = new ShPartnerPictureImporter(context);
    const result = await importer.import();

    expect(result.imported).toBe(4);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.success).toBe(true);
    expect(writePartnerImageMock).toHaveBeenCalledTimes(4);
  });

  it('writes correct partner_id and path for AT_01 first picture', async () => {
    const importer = new ShPartnerPictureImporter(context);
    await importer.import();

    expect(writePartnerImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        partner_id: 'partner-at01-uuid',
        path: 'sharing_history/sh_partners/at_01/1.jpg',
        original_name: '1.jpg',
        mime_type: 'image/jpeg',
        size: 1,
        display_order: 1,
      })
    );
  });

  it('sets alt_text from non-empty caption', async () => {
    const importer = new ShPartnerPictureImporter(context);
    await importer.import();

    expect(writePartnerImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sharing_history/sh_partners/at_01/1.jpg',
        alt_text: 'Main gallery image',
      })
    );
  });

  it('sets alt_text to null when caption is null', async () => {
    const importer = new ShPartnerPictureImporter(context);
    await importer.import();

    // at01Row2 has caption: null
    expect(writePartnerImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '2.jpg',
        alt_text: null,
      })
    );
  });

  it('sets alt_text to null when caption is whitespace-only', async () => {
    const importer = new ShPartnerPictureImporter(context);
    await importer.import();

    // at01Row3 has caption: '  '
    expect(writePartnerImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '3.jpg',
        alt_text: null,
      })
    );
  });

  it('includes photographer and copyright in extra JSON', async () => {
    const importer = new ShPartnerPictureImporter(context);
    await importer.import();

    expect(writePartnerImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sharing_history/sh_partners/at_01/1.jpg',
        extra: JSON.stringify({ photographer: 'John Doe', copyright: '2023 Museum' }),
      })
    );
  });

  it('sets extra to null when photographer and copyright are absent', async () => {
    const importer = new ShPartnerPictureImporter(context);
    await importer.import();

    // at01Row2 has no photographer or copyright
    expect(writePartnerImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '2.jpg',
        extra: null,
      })
    );
  });

  it('includes only copyright in extra when photographer is absent', async () => {
    const importer = new ShPartnerPictureImporter(context);
    await importer.import();

    // dz01Row1 has copyright but no photographer
    expect(writePartnerImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sharing_history/sh_partners/dz_01/1.jpg',
        extra: JSON.stringify({ copyright: 'DZ Museum' }),
      })
    );
  });

  it('also stores the copyright burn-ready on the image row', async () => {
    const importer = new ShPartnerPictureImporter(context);
    await importer.import();

    expect(writePartnerImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sharing_history/sh_partners/dz_01/1.jpg',
        copyright: '© DZ Museum',
        extra: JSON.stringify({ copyright: 'DZ Museum' }),
      })
    );
  });

  it('leaves the image copyright null when the picture has none', async () => {
    const importer = new ShPartnerPictureImporter(context);
    await importer.import();

    // at01Row2 has no copyright
    expect(writePartnerImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: '2.jpg', copyright: null })
    );
  });

  it('reports error and skips row when path is null', async () => {
    const nullPathRow = {
      image_number: 99,
      partners_id: 'AT_01',
      path: null,
      thumb: null,
      lastupdate: null,
      caption: null,
      photographer: null,
      copyright: null,
    };
    queryMock.mockResolvedValue([nullPathRow]);

    const importer = new ShPartnerPictureImporter(context);
    const result = await importer.import();

    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('path is null or empty');
    expect(writePartnerImageMock).not.toHaveBeenCalled();
  });

  it('reports error and skips row when path is empty string', async () => {
    const emptyPathRow = {
      image_number: 99,
      partners_id: 'AT_01',
      path: '',
      thumb: null,
      lastupdate: null,
      caption: null,
      photographer: null,
      copyright: null,
    };
    queryMock.mockResolvedValue([emptyPathRow]);

    const importer = new ShPartnerPictureImporter(context);
    const result = await importer.import();

    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('path is null or empty');
    expect(writePartnerImageMock).not.toHaveBeenCalled();
  });

  it('reports error when parent partner is not found', async () => {
    // Use a partners_id that has no tracker entry
    const unknownPartnerRow = {
      image_number: 1,
      partners_id: 'XX_99',
      path: 'some/image.jpg',
      thumb: null,
      lastupdate: null,
      caption: null,
      photographer: null,
      copyright: null,
    };
    queryMock.mockResolvedValue([unknownPartnerRow]);

    const importer = new ShPartnerPictureImporter(context);
    const result = await importer.import();

    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Partner not found');
    expect(result.errors[0]).toContain('mwnf3_sharing_history:sh_partners:xx_99');
    expect(writePartnerImageMock).not.toHaveBeenCalled();
  });

  it('skips already-imported images (deduplication)', async () => {
    // Simulate a non-wiped rerun: partner_images has no
    // backward_compatibility column, so identity is (owner, legacy path) —
    // see SqlWriteStrategy.imageExists().
    (strategy.imageExists as ReturnType<typeof vi.fn>).mockImplementation(
      async (table: string, ownerId: string, path: string) =>
        table === 'partner_images' && ownerId === 'partner-at01-uuid' && path === at01Row1.path
          ? 'existing-image-uuid'
          : null
    );

    const importer = new ShPartnerPictureImporter(context);
    const result = await importer.import();

    // at01Row1 skipped, remaining 3 imported
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(3);
    expect(writePartnerImageMock).toHaveBeenCalledTimes(3);
  });

  it('does not write images in dry-run mode', async () => {
    context = { ...context, dryRun: true };
    const importer = new ShPartnerPictureImporter(context);
    const result = await importer.import();

    expect(result.imported).toBe(4);
    expect(writePartnerImageMock).not.toHaveBeenCalled();
  });

  it('returns success=false when query throws', async () => {
    queryMock.mockRejectedValue(new Error('DB connection lost'));

    const importer = new ShPartnerPictureImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Failed to import SH partner pictures');
  });

  it('queries sh_partner_pictures ordered by partners_id and image_number', async () => {
    const importer = new ShPartnerPictureImporter(context);
    await importer.import();

    const sql: string = queryMock.mock.calls[0][0] as string;
    expect(sql).toContain('mwnf3_sharing_history.sh_partner_pictures');
    expect(sql.toLowerCase()).toContain('order by');
    expect(sql.toLowerCase()).toContain('partners_id');
    expect(sql.toLowerCase()).toContain('image_number');
  });

  it('returns early with no errors when table is empty', async () => {
    queryMock.mockResolvedValue([]);
    const importer = new ShPartnerPictureImporter(context);
    const result = await importer.import();

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.success).toBe(true);
    expect(writePartnerImageMock).not.toHaveBeenCalled();
  });
});
