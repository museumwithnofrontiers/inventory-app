import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExploreCountryPictureImporter } from '../../src/importers/phase-06/explore-country-picture-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ExploreCountryPictureImporter', () => {
  let strategy: IWriteStrategy;
  let context: ImportContext;

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

  beforeEach(() => {
    vi.clearAllMocks();
    const tracker = new UnifiedTracker();
    tracker.set('mwnf3_explore:country:at', 'austria-uuid', 'collection');
    tracker.set('mwnf3_explore:country:jo', 'jordan-uuid', 'collection');

    strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      imageExists: vi.fn(async (_table: string, owner: string) =>
        owner === 'jordan-uuid' ? 'image-uuid' : null
      ),
      writeCollectionImage: vi.fn().mockResolvedValue('new-image-uuid'),
    } as unknown as IWriteStrategy;

    context = {
      legacyDb: {
        query: vi.fn(async () => [
          { countryId: 'at', path: 'explore/country/at/1.jpg' },
          { countryId: 'jo', path: 'explore/country/jo/1.jpg' },
          { countryId: 'ix', path: 'explore/country/ix/1.jpg' },
        ]) as ILegacyDatabase['query'],
        execute: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      },
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it("attaches each country's picture to its collection, for image-sync to copy", async () => {
    const result = await new ExploreCountryPictureImporter(context).import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(strategy.writeCollectionImage).toHaveBeenCalledTimes(1);
    expect(strategy.writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_id: 'austria-uuid',
        path: 'explore/country/at/1.jpg',
        original_name: '1.jpg',
        mime_type: 'image/jpeg',
        size: 1,
        display_order: 1,
      })
    );
  });

  it('skips a picture already imported, and a country Explore does not have', async () => {
    const result = await new ExploreCountryPictureImporter(context).import();

    // jo: already there; ix: no Explore country collection.
    expect(result.skipped).toBe(2);
  });
});
