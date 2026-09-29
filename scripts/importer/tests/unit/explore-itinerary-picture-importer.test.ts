import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExploreItineraryPictureImporter } from '../../src/importers/phase-06/explore-itinerary-picture-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ExploreItineraryPictureImporter', () => {
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let query: ReturnType<typeof vi.fn>;

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
    tracker.set('mwnf3_explore:itinerary:1', 'tunisia-uuid', 'collection');
    tracker.set('mwnf3_explore:itinerary:4', 'spain-uuid', 'collection');

    strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      imageExists: vi.fn(async (_table: string, owner: string) =>
        owner === 'spain-uuid' ? 'image-uuid' : null
      ),
      writeCollectionImage: vi.fn().mockResolvedValue('new-image-uuid'),
    } as unknown as IWriteStrategy;

    // Legacy's rows as explore_itineraries holds them: a top-level itinerary's
    // picture; none of the sub-itineraries has one.
    query = vi.fn(async () => [
      { itineraries_id: 1, path: 'explore/itineraries/1/1.jpg' },
      { itineraries_id: 4, path: 'explore/itineraries/4/1.jpg' },
      { itineraries_id: 999, path: 'explore/itineraries/999/1.jpg' },
    ]);

    context = {
      legacyDb: {
        query: query as ILegacyDatabase['query'],
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

  it("attaches each itinerary's picture to its collection, for image-sync to copy", async () => {
    const result = await new ExploreItineraryPictureImporter(context).import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(strategy.writeCollectionImage).toHaveBeenCalledTimes(1);
    expect(strategy.writeCollectionImage).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_id: 'tunisia-uuid',
        path: 'explore/itineraries/1/1.jpg',
        original_name: '1.jpg',
        mime_type: 'image/jpeg',
        size: 1,
        display_order: 1,
      })
    );
  });

  it('reads only the itineraries that have a picture', async () => {
    await new ExploreItineraryPictureImporter(context).import();

    expect(query.mock.calls[0]![0]).toContain("path IS NOT NULL AND path <> ''");
  });

  it('skips a picture already imported, and an itinerary not imported', async () => {
    const result = await new ExploreItineraryPictureImporter(context).import();

    // 4: already there; 999: no itinerary collection.
    expect(result.skipped).toBe(2);
  });
});
