import { describe, expect, it, vi } from 'vitest';

import {
  TravelsTrailTranslationImporter,
  trailTextExtra,
} from '../../src/importers/phase-07/travels-trail-translation-importer.js';
import { itineraryTextExtra } from '../../src/importers/phase-07/travels-itinerary-translation-importer.js';
import {
  TravelsItineraryImporter,
  itineraryDays,
} from '../../src/importers/phase-07/travels-itinerary-importer.js';
import { itineraryMainPictures } from '../../src/importers/phase-07/travels-itinerary-picture-importer.js';
import { TravelsMonumentImporter } from '../../src/importers/phase-07/travels-monument-importer.js';
import {
  TravelsTrailEntryImporter,
  monumentTrailEntry,
  objectTrailEntry,
} from '../../src/importers/phase-07/travels-trail-entry-importer.js';
import {
  TravelsTrailPartnerImporter,
  trailStartingPoints,
} from '../../src/importers/phase-07/travels-trail-partner-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

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

function makeContext(
  tracker: UnifiedTracker,
  rowsFor: (sql: string) => unknown[],
  strategy: Partial<IWriteStrategy>
): ImportContext {
  const legacyDb: ILegacyDatabase = {
    query: vi.fn(async (sql: string) => rowsFor(sql)) as ILegacyDatabase['query'],
    execute: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  return {
    legacyDb,
    strategy: {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      ...strategy,
    } as unknown as IWriteStrategy,
    tracker,
    logger,
    dryRun: false,
  };
}

describe('Travels texts keep one field per legacy column', () => {
  it('puts each trail credit and the subtitle under its own extra key, never in the description', () => {
    expect(
      trailTextExtra({
        subtitle: ' The Umayyads ',
        curated_by: 'A. Curator',
        local_coordinator: '',
        photo_by: 'P. Hotographer',
        region_territory: null,
      })
    ).toEqual({ subtitle: 'The Umayyads', curated_by: 'A. Curator', photo_by: 'P. Hotographer' });
    expect(
      trailTextExtra({
        subtitle: null,
        curated_by: null,
        local_coordinator: null,
        photo_by: null,
        region_territory: ' ',
      })
    ).toBeNull();
  });

  it("keeps the itinerary's second description, author, introduction and preparer apart", () => {
    expect(
      itineraryTextExtra({
        description2: 'More',
        author: 'An Author',
        introduction: null,
        prepared_by: 'Someone',
      })
    ).toEqual({ description_2: 'More', author: 'An Author', prepared_by: 'Someone' });
  });

  it('reads the itinerary days once, from the first language row that has them', () => {
    expect(itineraryDays([{ days: null }, { days: 0 }, { days: 3 }, { days: 4 }])).toBe(3);
    expect(itineraryDays([{ days: null }])).toBeNull();
  });

  it('writes the trail description unmerged, and its credits into extra', async () => {
    const tracker = new UnifiedTracker();
    tracker.set('mwnf3_travels:context', 'ctx', 'context');
    tracker.set('mwnf3_travels:trail:IAM:jo:1', 'trail-jo', 'collection');
    tracker.set('en', 'eng', 'language');
    const write = vi.fn().mockResolvedValue('t');
    const context = makeContext(
      tracker,
      () => [
        {
          project_id: 'IAM',
          country: 'jo',
          lang: 'en',
          number: 1,
          title: 'The Umayyads',
          subtitle: 'Sub',
          description: 'The trail.',
          curated_by: 'Curator',
          local_coordinator: 'Coordinator',
          photo_by: 'Photographer',
          region_territory: 'North',
        },
      ],
      { writeCollectionTranslation: write }
    );

    const result = await new TravelsTrailTranslationImporter(context).import();

    expect(result.errors).toEqual([]);
    const data = write.mock.calls[0]![0];
    expect(data.description).toBe('The trail.');
    expect(data.description).not.toMatch(/Curated by|Local coordinator|Photography/);
    expect(JSON.parse(data.extra)).toEqual({
      subtitle: 'Sub',
      curated_by: 'Curator',
      local_coordinator: 'Coordinator',
      photo_by: 'Photographer',
      region_territory: 'North',
    });
  });

  it('stores the days on the itinerary collection', async () => {
    const tracker = new UnifiedTracker();
    tracker.set('mwnf3_travels:context', 'ctx', 'context');
    tracker.setMetadata('default_language_id', 'eng');
    tracker.set('mwnf3_travels:trail:IAM:jo:1', 'trail-jo', 'collection');
    const write = vi.fn().mockResolvedValue('it');
    const row = {
      project_id: 'IAM',
      country: 'jo',
      number: 'I',
      trail_id: 1,
      title: 'x',
      description: null,
    };
    const context = makeContext(
      tracker,
      () => [
        { ...row, lang: 'en', days: 2 },
        { ...row, lang: 'fr', days: 2 },
      ],
      { writeCollection: write }
    );

    await new TravelsItineraryImporter(context).import();

    expect(JSON.parse(write.mock.calls[0]![0].extra)).toEqual({ days: 2 });
  });
});

describe('Travels items carry their legacy project', () => {
  it('writes the IAM project on a Travels monument', async () => {
    const tracker = new UnifiedTracker();
    tracker.set('mwnf3_travels:context', 'ctx', 'context');
    tracker.setMetadata('default_language_id', 'eng');
    tracker.set('mwnf3_travels:location:IAM:jo:1:I:1', 'loc', 'collection');
    tracker.set('mwnf3:projects:IAM', 'project-iam', 'project');
    const writeItem = vi.fn().mockResolvedValue('item');
    const context = makeContext(
      tracker,
      () => [
        {
          project_id: 'IAM',
          country: 'jo',
          itinerary_id: 'I',
          location_id: '1',
          number: 'a',
          lang: 'en',
          trail_id: 1,
          title: 'Qusayr Amra',
        },
      ],
      { writeItem, writeCollectionItem: vi.fn() }
    );

    const result = await new TravelsMonumentImporter(context).import();

    expect(result.errors).toEqual([]);
    expect(writeItem.mock.calls[0]![0].project_id).toBe('project-iam');
  });
});

describe('Itinerary main pictures', () => {
  it('imports each itinerary file once, whatever the number of language rows', () => {
    const row = { project_id: 'IAM', country: 'eg', trail_id: 1, number: 'II' };
    expect(
      itineraryMainPictures([
        { ...row, lang: 'en', path: 'trails/iam/eg/1/ii/1/c/1.jpg' },
        { ...row, lang: 'fr', path: ' trails/iam/eg/1/ii/1/c/1.jpg ' },
        { ...row, lang: 'it', path: '' },
      ])
    ).toEqual([{ ...row, lang: 'en', path: 'trails/iam/eg/1/ii/1/c/1.jpg' }]);
  });
});

describe('Exhibition trail entries and starting points', () => {
  it('builds the trail and item keys as their importers do', () => {
    expect(
      objectTrailEntry({
        id: 1,
        o1_project_id: 'ISL',
        o1_country_id: 'de',
        o1_museum_id: 'Mus01',
        o1_number: 1,
        t1_project_id: 'IAM',
        t1_country_id: 'jo',
        t1_number: 1,
      })
    ).toEqual({
      trailBackwardCompat: 'mwnf3_travels:trail:IAM:jo:1',
      itemBackwardCompat: 'mwnf3:objects:ISL:de:Mus01:1',
      objectRelationId: 1,
    });
    expect(
      monumentTrailEntry({
        id: 51,
        m1_project_id: 'ISL',
        m1_country_id: 'dz',
        m1_institution_id: 'Mon01',
        m1_number: 8,
        t1_project_id: 'IAM',
        t1_country_id: 'tr',
        t1_number: 1,
      }).itemBackwardCompat
    ).toBe('mwnf3:monuments:ISL:dz:Mon01:8');
  });

  it('joins each entry to its trail, with its justification, and skips an unknown item', async () => {
    const tracker = new UnifiedTracker();
    tracker.set('mwnf3_travels:trail:IAM:jo:1', 'trail-jo', 'collection');
    tracker.set('mwnf3:objects:ISL:de:Mus01:1', 'obj-1', 'item');
    tracker.set('en', 'eng', 'language');
    const write = vi.fn();
    const trail = { t1_project_id: 'IAM', t1_country_id: 'jo', t1_number: 1 };
    const context = makeContext(
      tracker,
      (sql) => {
        if (sql.includes('objects_trails_justification')) {
          return [{ relation_id: 1, lang_id: 'en', justification: ' Why it is here ' }];
        }
        if (sql.includes('FROM mwnf3.objects_trails')) {
          return [
            {
              id: 1,
              o1_project_id: 'ISL',
              o1_country_id: 'de',
              o1_museum_id: 'Mus01',
              o1_number: 1,
              ...trail,
            },
            {
              id: 2,
              o1_project_id: 'ISL',
              o1_country_id: 'de',
              o1_museum_id: 'Mus01',
              o1_number: 99,
              ...trail,
            },
          ];
        }
        return [];
      },
      { writeCollectionItem: write }
    );

    const result = await new TravelsTrailEntryImporter(context).import();

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(write).toHaveBeenCalledWith({
      collection_id: 'trail-jo',
      item_id: 'obj-1',
      display_order: 1,
      extra: { contextual_descriptions: { eng: 'Why it is here' } },
    });
  });

  it("links each trail once to its 'Starting point' museum at level partner", async () => {
    const rows = [
      { project_id: 'IAM', country: 'jo', number: 1, museum_id: 'Mus01' },
      { project_id: 'IAM', country: 'jo', number: 1, museum_id: 'Mus01' },
      { project_id: 'GPA', country: 'pt', number: 1, museum_id: 'Mus01_C' },
    ];
    expect(trailStartingPoints(rows)).toEqual([
      {
        trailBackwardCompat: 'mwnf3_travels:trail:IAM:jo:1',
        partnerBackwardCompat: 'mwnf3:museums:Mus01:jo',
      },
      {
        trailBackwardCompat: 'mwnf3_travels:trail:GPA:pt:1',
        partnerBackwardCompat: 'mwnf3:museums:Mus01_C:pt',
      },
    ]);

    const tracker = new UnifiedTracker();
    tracker.set('mwnf3_travels:trail:IAM:jo:1', 'trail-jo', 'collection');
    tracker.set('mwnf3:museums:Mus01:jo', 'partner-jo', 'partner');
    const attach = vi.fn();
    const context = makeContext(tracker, () => rows, {
      attachPartnerToCollectionWithLevel: attach,
    });

    const result = await new TravelsTrailPartnerImporter(context).import();

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(attach).toHaveBeenCalledWith('trail-jo', 'partner-jo', 'collection', 'partner');
  });
});
