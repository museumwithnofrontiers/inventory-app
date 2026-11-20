import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThgTimelineImporter } from '../../src/importers/phase-10/thg-timeline-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ThgTimelineImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let writeTimelineMock: ReturnType<typeof vi.fn>;
  let writeTimelineEventMock: ReturnType<typeof vi.fn>;
  let writeTimelineEventTranslationMock: ReturnType<typeof vi.fn>;

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

    tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    tracker.set('mwnf3_thematic_gallery:thg_gallery:7', 'gallery-collection-uuid', 'collection');

    queryMock = vi.fn(async (sql: string) => {
      // Check hcr_events before hcr — hcr_events string also contains 'hcr'
      if (sql.includes('FROM mwnf3_thematic_gallery.hcr_events')) {
        return [
          {
            hcr_id: 10,
            lang_id: 'en',
            name: 'The Medieval Period',
            description: 'A detailed description.',
            datedesc_ah: '287-699 AH',
            datedesc_ad: '900-1300 AD',
          },
        ];
      }
      if (sql.includes('FROM mwnf3_thematic_gallery.hcr')) {
        return [
          {
            hcr_id: 10,
            gallery_id: 7,
            name: 'Medieval Period',
            from_ad: 900,
            to_ad: 1300,
            from_ah: 287,
            to_ah: 699,
          },
        ];
      }
      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeTimelineMock = vi.fn().mockResolvedValue('timeline-uuid');
    writeTimelineEventMock = vi.fn().mockResolvedValue('event-uuid');
    writeTimelineEventTranslationMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeTimeline: writeTimelineMock,
      writeTimelineEvent: writeTimelineEventMock,
      writeTimelineEventTranslation: writeTimelineEventTranslationMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('queries hcr WITHOUT display_order', async () => {
    const importer = new ThgTimelineImporter(context);
    await importer.import();

    const hcrCall = queryMock.mock.calls.find(
      (args: unknown[]) =>
        (args[0] as string).includes('FROM mwnf3_thematic_gallery.hcr') &&
        !(args[0] as string).includes('hcr_events')
    );
    expect(hcrCall).toBeDefined();
    const sql: string = hcrCall![0] as string;
    expect(sql).not.toContain('display_order');
  });

  it('queries hcr_events with lang_id — not lang', async () => {
    const importer = new ThgTimelineImporter(context);
    await importer.import();

    const eventsCall = queryMock.mock.calls.find((args: unknown[]) =>
      (args[0] as string).includes('FROM mwnf3_thematic_gallery.hcr_events')
    );
    expect(eventsCall).toBeDefined();
    const sql: string = eventsCall![0] as string;
    expect(sql).toContain('lang_id');
    expect(sql).not.toMatch(/\blang\b(?!_id)/);
  });

  it('creates a timeline bound to the gallery collection', async () => {
    const importer = new ThgTimelineImporter(context);
    const result = await importer.import();

    expect(writeTimelineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_id: 'gallery-collection-uuid',
        backward_compatibility: 'mwnf3_thematic_gallery:timeline:7',
      })
    );
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('creates a timeline event with sequential display_order', async () => {
    const importer = new ThgTimelineImporter(context);
    await importer.import();

    expect(writeTimelineEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        timeline_id: 'timeline-uuid',
        internal_name: 'Medieval Period',
        year_from: 900,
        year_to: 1300,
        display_order: 1,
        backward_compatibility: 'mwnf3_thematic_gallery:hcr:10',
      })
    );
  });

  it('writes no end year, not 0, when legacy has none (M16 G2 #2697)', async () => {
    const baseQuery = queryMock.getMockImplementation() as (sql: string) => Promise<unknown[]>;
    queryMock.mockImplementation(async (sql: string) =>
      sql.includes('FROM mwnf3_thematic_gallery.hcr') && !sql.includes('hcr_events')
        ? [{ hcr_id: 10, gallery_id: 7, name: 'Open-ended', from_ad: 900, to_ad: null, from_ah: 287, to_ah: null }]
        : baseQuery(sql)
    );

    await new ThgTimelineImporter(context).import();

    expect(writeTimelineEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ year_from: 900, year_to: null, year_to_ah: null })
    );
  });

  it('creates a timeline event translation using lang_id from hcr_events', async () => {
    const importer = new ThgTimelineImporter(context);
    await importer.import();

    expect(writeTimelineEventTranslationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        timeline_event_id: 'event-uuid',
        language_id: 'eng',
        name: 'The Medieval Period',
        description: 'A detailed description.',
      })
    );
  });

  it('skips creating a timeline when the gallery collection is missing', async () => {
    tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    // no collection for gallery 7

    context = { ...context, tracker };
    const importer = new ThgTimelineImporter(context);
    const result = await importer.import();

    expect(writeTimelineMock).not.toHaveBeenCalled();
    expect(result.skipped).toBeGreaterThan(0);
  });
});
