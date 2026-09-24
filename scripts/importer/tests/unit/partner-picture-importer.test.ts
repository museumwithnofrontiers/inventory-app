import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PartnerPictureImporter } from '../../src/importers/phase-02/partner-picture-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('PartnerPictureImporter', () => {
  let tracker: UnifiedTracker;
  let strategy: IWriteStrategy;
  let context: ImportContext;
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

  const museumPicture = (imageNumber: number, caption: string | null) => ({
    museum_id: 'mus01',
    country: 'it',
    image_number: imageNumber,
    path: `museums/it/mus01/${imageNumber}.jpg`,
    caption,
    photographer: null,
    copyright: null,
  });

  const institutionPicture = (imageNumber: number, caption: string | null) => ({
    institution_id: 'ins01',
    country: 'jo',
    image_number: imageNumber,
    path: `institutions/jo/ins01/${imageNumber}.jpg`,
    caption,
    photographer: null,
    copyright: null,
  });

  let museumRows: unknown[];
  let institutionRows: unknown[];

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('mwnf3:museums:mus01:it', 'partner-museum-uuid', 'partner');
    tracker.set('mwnf3:institutions:ins01:jo', 'partner-institution-uuid', 'partner');

    museumRows = [];
    institutionRows = [];

    const legacyDb: ILegacyDatabase = {
      query: vi.fn(async (sql: string) =>
        sql.includes('museums_pictures') ? museumRows : institutionRows
      ) as ILegacyDatabase['query'],
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

    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  async function altTextFor(path: string): Promise<unknown> {
    const result = await new PartnerPictureImporter(context).import();
    expect(result.errors).toEqual([]);
    const call = writePartnerImageMock.mock.calls.find(([data]) => data.path === path);
    expect(call).toBeDefined();
    return call![0].alt_text;
  }

  describe.each([
    ['museum', (n: number, caption: string | null) => (museumRows = [museumPicture(n, caption)])],
    [
      'institution',
      (n: number, caption: string | null) => (institutionRows = [institutionPicture(n, caption)]),
    ],
  ])('%s pictures: alt text', (kind, givePicture) => {
    const pathOf = (n: number) =>
      kind === 'museum' ? `museums/it/mus01/${n}.jpg` : `institutions/jo/ins01/${n}.jpg`;

    it('uses the trimmed caption', async () => {
      givePicture(1, '  Courtyard, north side  ');
      expect(await altTextFor(pathOf(1))).toBe('Courtyard, north side');
    });

    it('is null, not the legacy path, when there is no caption', async () => {
      givePicture(2, null);
      expect(await altTextFor(pathOf(2))).toBeNull();
    });

    it('is null, not the legacy path, when the caption is blank', async () => {
      givePicture(3, '   ');
      expect(await altTextFor(pathOf(3))).toBeNull();
    });

    it('truncates a caption longer than 500 characters', async () => {
      givePicture(4, 'x'.repeat(600));
      expect(await altTextFor(pathOf(4))).toBe('x'.repeat(497) + '...');
    });
  });
});
