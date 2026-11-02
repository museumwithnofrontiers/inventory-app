import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ShChronologyImporter,
  activityDate,
} from '../../src/importers/phase-05/sh-chronology-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

// Legacy Sharing History's Chronology: activity 351 and its public
// sub-activities become one timeline of the project's root collection, one
// event each, with their pictures.

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

const base = {
  subtitle: '',
  rea_from_month: '',
  rea_from_day: '',
  rea_to_month: '',
  rea_to_day: '',
  ongoing: 'N',
  coorganisers: '',
  participants: '',
  sponsors: '',
  eu_financing: '',
  eu_funding1: '',
  eu_funding2: '',
  remarks: '',
};
const activities = [
  {
    ...base,
    activity_id: 351,
    main_activity_id: null,
    title: 'SHARING HISTORY VIRTUAL EXHIBITIONS',
    description: 'The <i>Sharing History</i> Virtual Museum',
    rea_from_year: '2012',
    rea_to_year: '2015',
    rea_countries: 'Different venues',
    rea_cities: '',
    organisers: 'Museum With No Frontiers (MWNF)',
  },
  {
    ...base,
    activity_id: 352,
    main_activity_id: 351,
    title: 'FIRST CURATORIAL COORDINATION MEETING, EUROFORUM',
    description: 'The curators met.<br/>\n<br/>\nThey agreed.',
    rea_from_year: '2012',
    rea_from_month: '12',
    rea_from_day: '12',
    rea_to_year: '2012',
    rea_to_month: '12',
    rea_to_day: '16',
    rea_countries: 'Spain',
    rea_cities: 'San Lorenzo El Escorial (Madrid)',
    organisers: 'Museum With No Frontiers (MWNF)',
    remarks: '<a href="http://youtu.be/x" target="_blank">Watch video</a>',
  },
];
const files = [
  {
    file_id: 2,
    activity_id: 352,
    path: 'activities/352/2.jpg',
    order: 2,
    caption: '',
    type: 'image',
  },
  {
    file_id: 1,
    activity_id: 352,
    path: 'activities/352/1.jpg',
    order: 1,
    caption: 'Escorial',
    type: 'image',
  },
];

describe('activityDate', () => {
  it('is the whole date, or nothing', () => {
    expect(activityDate('2012', '12', '6')).toBe('2012-12-06');
    expect(activityDate('2012', '', '')).toBeNull();
    expect(activityDate('', '12', '6')).toBeNull();
  });
});

describe('ShChronologyImporter', () => {
  let context: ImportContext;
  let strategy: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    const tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.set('en', 'eng', 'language');
    tracker.set('mwnf3_sharing_history:sh_projects:awe', 'sh-root-uuid', 'collection');

    const query = vi.fn(async (sql: string) =>
      sql.includes('act_activities_files') ? files : activities
    );
    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      imageExists: vi.fn().mockResolvedValue(null),
      writeTimeline: vi.fn().mockResolvedValue('timeline-uuid'),
      writeTimelineEvent: vi.fn().mockResolvedValue('event-uuid'),
      writeTimelineEventTranslation: vi.fn().mockResolvedValue(undefined),
      writeTimelineEventImage: vi.fn().mockResolvedValue('image-uuid'),
    };
    context = {
      legacyDb: {
        query,
        execute: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as ILegacyDatabase,
      strategy: strategy as unknown as IWriteStrategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it("writes the root activity as a timeline of the project's root collection", async () => {
    const result = await new ShChronologyImporter(context).import();
    expect(result.errors).toEqual([]);

    const timeline = strategy.writeTimeline!.mock.calls[0]![0];
    expect(timeline).toMatchObject({
      collection_id: 'sh-root-uuid',
      country_id: null,
      backward_compatibility: 'mwnf3:act_activities:351',
    });
    expect(JSON.parse(timeline.extra)).toEqual({
      title: 'SHARING HISTORY VIRTUAL EXHIBITIONS',
      rea_from_year: '2012',
      rea_to_year: '2015',
      rea_countries: 'Different venues',
      organisers: 'Museum With No Frontiers (MWNF)',
      description: 'The *Sharing History* Virtual Museum',
    });
  });

  it('writes each sub-activity as an event, each legacy column its own field', async () => {
    await new ShChronologyImporter(context).import();

    expect(strategy.writeTimelineEvent).toHaveBeenCalledTimes(1);
    expect(strategy.writeTimelineEvent!.mock.calls[0]![0]).toMatchObject({
      timeline_id: 'timeline-uuid',
      year_from: 2012,
      year_to: 2012,
      date_from: '2012-12-12',
      date_to: '2012-12-16',
      display_order: 1,
      backward_compatibility: 'mwnf3:act_activities:352',
      extra: JSON.stringify({ ongoing: 'N' }),
    });

    const translation = strategy.writeTimelineEventTranslation!.mock.calls[0]![0];
    expect(translation).toMatchObject({
      timeline_event_id: 'event-uuid',
      language_id: 'eng',
      name: 'FIRST CURATORIAL COORDINATION MEETING, EUROFORUM',
    });
    expect(translation.description).toContain('The curators met.');
    expect(JSON.parse(translation.extra)).toEqual({
      rea_cities: 'San Lorenzo El Escorial (Madrid)',
      rea_countries: 'Spain',
      organisers: 'Museum With No Frontiers (MWNF)',
      remarks: '[Watch video](http://youtu.be/x)',
    });
  });

  it('writes its pictures in their order, for image-sync to copy', async () => {
    await new ShChronologyImporter(context).import();

    expect(
      strategy.writeTimelineEventImage!.mock.calls.map(([image]) => [
        image.path,
        image.display_order,
        image.alt_text,
      ])
    ).toEqual([
      ['activities/352/2.jpg', 2, null],
      ['activities/352/1.jpg', 1, 'Escorial'],
    ]);
  });
});
