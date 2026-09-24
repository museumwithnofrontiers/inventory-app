import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SchoolImporter } from '../../src/importers/phase-01/school-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import type { LegacySchoolPicture } from '../../src/domain/types/index.js';

describe('SchoolImporter pictures', () => {
  let context: ImportContext;
  let writePartnerImageMock: ReturnType<typeof vi.fn>;
  let pictureRows: LegacySchoolPicture[];

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

  const picture = (overrides: Partial<LegacySchoolPicture>): LegacySchoolPicture => ({
    school_id: 'sch01',
    country: 'it',
    image_number: 1,
    path: 'schools/it/sch01/1.jpg',
    caption: '',
    photographer: '',
    copyright: '',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    const tracker = new UnifiedTracker();
    tracker.setMetadata('default_context_id', 'default-context-uuid');
    tracker.set('mwnf3:schools:sch01:it', 'partner-school-uuid', 'partner');

    pictureRows = [];

    // Only the pictures matter here: the schools and their names come back empty.
    const legacyDb: ILegacyDatabase = {
      query: vi.fn(async (sql: string) =>
        sql.includes('schools_pictures') ? pictureRows : []
      ) as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writePartnerImageMock = vi.fn().mockResolvedValue('new-partner-image-uuid');

    const strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      imageExists: vi.fn().mockResolvedValue(null),
      writePartnerImage: writePartnerImageMock,
    } as unknown as IWriteStrategy;

    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  async function importedImage(): Promise<Record<string, unknown>> {
    const result = await new SchoolImporter(context).import();
    expect(result.errors).toEqual([]);
    expect(writePartnerImageMock).toHaveBeenCalledTimes(1);
    return writePartnerImageMock.mock.calls[0]![0] as Record<string, unknown>;
  }

  describe('alt text', () => {
    it('uses the trimmed caption', async () => {
      pictureRows = [picture({ caption: '  Pupils at work  ' })];
      expect((await importedImage()).alt_text).toBe('Pupils at work');
    });

    it('is null, not the legacy path, when the caption is empty', async () => {
      pictureRows = [picture({ caption: '' })];
      expect((await importedImage()).alt_text).toBeNull();
    });

    it('is null, not the legacy path, when the caption is missing or blank', async () => {
      pictureRows = [
        picture({ caption: undefined }),
        picture({ image_number: 2, path: 'schools/it/sch01/2.jpg', caption: '  ' }),
      ];
      const result = await new SchoolImporter(context).import();
      expect(result.errors).toEqual([]);
      expect(writePartnerImageMock.mock.calls.map(([data]) => data.alt_text)).toEqual([null, null]);
    });

    it('truncates a caption longer than 500 characters', async () => {
      pictureRows = [picture({ caption: 'y'.repeat(600) })];
      expect((await importedImage()).alt_text).toBe('y'.repeat(497) + '...');
    });
  });
});
