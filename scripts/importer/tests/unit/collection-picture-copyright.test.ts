/**
 * The Explore and Travels picture importers write each collection picture's
 * legacy copyright burn-ready on its collection_images row, picked from the
 * per-language legacy rows (English, else the first filled).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExploreLocationPictureImporter } from '../../src/importers/phase-06/explore-location-picture-importer.js';
import { ExploreThematicCyclePictureImporter } from '../../src/importers/phase-06/explore-thematiccycle-picture-importer.js';
import { TravelsTrailPictureImporter } from '../../src/importers/phase-07/travels-trail-picture-importer.js';
import { TravelsItineraryPictureImporter } from '../../src/importers/phase-07/travels-itinerary-picture-importer.js';
import { TravelsLocationPictureImporter } from '../../src/importers/phase-07/travels-location-picture-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type {
  BaseImporter,
  ImportContext,
  ILegacyDatabase,
  ILogger,
} from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

type Row = Record<string, unknown>;

interface ImporterCase {
  name: string;
  create: (context: ImportContext) => BaseImporter;
  /** backward_compatibility of the collection the pictures belong to */
  parent: string;
  /** One legacy row of the same picture, in the given language */
  row: (lang: string, copyright: string | null) => Row;
}

const common = {
  image_number: 1,
  thumb: null,
  caption: null,
  photographer: null,
  lastupdate: null,
};

const cases: ImporterCase[] = [
  {
    name: 'Explore location pictures',
    create: (context) => new ExploreLocationPictureImporter(context),
    parent: 'mwnf3_explore:location:409',
    row: (lang, copyright) => ({
      ...common,
      locationId: 409,
      type: '',
      path: 'explore/locations/409/1.jpg',
      lang,
      copyright,
    }),
  },
  {
    name: 'Explore thematic cycle pictures',
    create: (context) => new ExploreThematicCyclePictureImporter(context),
    parent: 'mwnf3_explore:thematiccycle:7',
    row: (lang, copyright) => ({
      ...common,
      cycleId: 7,
      type: '',
      path: 'explore/thematiccycles/7/1.jpg',
      lang,
      copyright,
    }),
  },
  {
    name: 'Travels trail pictures',
    create: (context) => new TravelsTrailPictureImporter(context),
    parent: 'mwnf3_travels:trail:iam:it:1',
    row: (lang, copyright) => ({
      ...common,
      project_id: 'iam',
      country: 'it',
      trail_id: 1,
      type: '',
      path: 'trails/iam/it/1/1.jpg',
      lang,
      copyright,
    }),
  },
  {
    name: 'Travels itinerary pictures',
    create: (context) => new TravelsItineraryPictureImporter(context),
    parent: 'mwnf3_travels:itinerary:iam:it:1:iii',
    row: (lang, copyright) => ({
      ...common,
      project_id: 'iam',
      country: 'it',
      trail_id: 1,
      number: 'iii',
      type: '',
      path: 'trails/iam/it/1/iii/1.jpg',
      lang,
      copyright,
    }),
  },
  {
    name: 'Travels location pictures',
    create: (context) => new TravelsLocationPictureImporter(context),
    parent: 'mwnf3_travels:location:iam:it:1:iii:2',
    row: (lang, copyright) => ({
      ...common,
      project_id: 'iam',
      country: 'it',
      trail_id: 1,
      itinerary_id: 'iii',
      number: '2',
      type: '',
      path: 'trails/iam/it/1/iii/2/1.jpg',
      lang,
      copyright,
    }),
  },
];

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

describe.each(cases)('$name: image copyright', ({ create, parent, row }) => {
  let rows: Row[];
  let context: ImportContext;
  let writeCollectionImageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    const tracker = new UnifiedTracker();
    tracker.set(parent, 'parent-collection-uuid', 'collection');

    rows = [];
    const legacyDb: ILegacyDatabase = {
      query: vi.fn(async () => rows) as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeCollectionImageMock = vi.fn().mockResolvedValue('new-collection-image-uuid');
    const strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      imageExists: vi.fn().mockResolvedValue(null),
      writeCollectionImage: writeCollectionImageMock,
    } as unknown as IWriteStrategy;

    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  async function importedCopyright(): Promise<unknown> {
    const result = await create(context).import();
    expect(result.errors).toEqual([]);
    expect(writeCollectionImageMock).toHaveBeenCalledTimes(1);
    return (writeCollectionImageMock.mock.calls[0]![0] as Row).copyright;
  }

  it('takes the English value over another language', async () => {
    rows = [row('es', 'Palacio Chigi'), row('en', 'Palazzo Chigi Ariccia')];
    expect(await importedCopyright()).toBe('© Palazzo Chigi Ariccia');
  });

  it('takes the first filled value when no English one is filled', async () => {
    rows = [row('en', '  '), row('it', 'MWNF'), row('es', 'Museo')];
    expect(await importedCopyright()).toBe('© MWNF');
  });

  it('is null when no language has a value', async () => {
    rows = [row('en', ''), row('es', null)];
    expect(await importedCopyright()).toBeNull();
  });

  it('does not double an existing ©', async () => {
    rows = [row('en', '© MWNF')];
    expect(await importedCopyright()).toBe('© MWNF');
  });
});
