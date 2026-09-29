import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExploreThematicCycleImporter } from '../../src/importers/phase-06/explore-thematiccycle-importer.js';
import { ExploreThematicCycleTranslationImporter } from '../../src/importers/phase-06/explore-thematiccycle-translation-importer.js';
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

function contextFor(
  strategy: IWriteStrategy,
  tracker: UnifiedTracker,
  query: (sql: string) => unknown[]
): ImportContext {
  return {
    legacyDb: {
      query: vi.fn(async (sql: string) => query(sql)) as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
    strategy,
    tracker,
    logger,
    dryRun: false,
  };
}

describe('ExploreThematicCycleImporter', () => {
  let strategy: IWriteStrategy;
  let tracker: UnifiedTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.set('mwnf3_explore:context', 'explore-context', 'context');
    tracker.set('mwnf3_explore:root:explore_by_theme', 'themes-root', 'collection');
    tracker.set('mwnf3_explore:thematiccycle:1', 'cycle-1', 'collection');

    strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeCollection: vi.fn().mockResolvedValue('cycle-11'),
      writeCollectionTranslation: vi.fn().mockResolvedValue('translation-uuid'),
      updateCollectionDisplayOrder: vi.fn().mockResolvedValue(undefined),
    } as unknown as IWriteStrategy;
  });

  const cycles = () => [
    {
      cycleId: 11,
      cycleLabel: 'PAL',
      cycleDescription: "Explore Palestine's Islamic Art and Architecture",
      status: 'e',
      geoCoordinates: '25,10',
      zoom: 3,
      path: 'explore/theme/11/1.jpg',
      order: 1,
    },
    {
      cycleId: 1,
      cycleLabel: 'IHM',
      cycleDescription: 'Explore the Islamic Heritage of the Mediterranean',
      status: 'e',
      geoCoordinates: '25,10',
      zoom: 3,
      path: 'explore/theme/1/1.jpg',
      order: 2,
    },
  ];

  it("keeps legacy's order of the cycles, on a new cycle and on one already imported", async () => {
    const result = await new ExploreThematicCycleImporter(
      contextFor(strategy, tracker, cycles)
    ).import();

    expect(result.success).toBe(true);
    expect(strategy.writeCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        backward_compatibility: 'mwnf3_explore:thematiccycle:11',
        display_order: 1,
      })
    );
    expect(strategy.updateCollectionDisplayOrder).toHaveBeenCalledWith('cycle-1', 2);
  });
});

describe('ExploreThematicCycleTranslationImporter', () => {
  let strategy: IWriteStrategy;
  let tracker: UnifiedTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();
    tracker.set('mwnf3_explore:context', 'explore-context', 'context');
    tracker.set('mwnf3_explore:thematiccycle:1', 'cycle-1', 'collection');
    tracker.set('en', 'eng', 'language');
    tracker.set('es', 'spa', 'language');
    // Both rows already exist: the English one from ExploreThematicCycleImporter.
    tracker.set('mwnf3_explore:thematiccycle:1:translation:eng', 'tr-en', 'collection_translation');
    tracker.set('mwnf3_explore:thematiccycle:1:translation:spa', 'tr-es', 'collection_translation');

    strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      exists: vi.fn().mockResolvedValue(false),
      writeCollectionTranslation: vi.fn().mockResolvedValue('translation-uuid'),
      setCollectionTranslationDescriptionByKey: vi.fn().mockResolvedValue(undefined),
      getCollectionTranslationExtra: vi.fn().mockResolvedValue(null),
      setCollectionTranslationExtra: vi.fn().mockResolvedValue(undefined),
      imageExists: vi.fn().mockResolvedValue(null),
      writeCollectionImage: vi.fn().mockResolvedValue('image-uuid'),
    } as unknown as IWriteStrategy;
  });

  it("brings a cycle's introduction to the row already written, and leaves a row with none alone", async () => {
    const query = (sql: string) =>
      sql.includes('FROM mwnf3_explore.thematiccycletranslated')
        ? [
            {
              cycleId: 1,
              langId: 'en',
              spelling: 'Explore the Islamic Heritage of the Mediterranean',
              description: 'Did you know that Islam strongly influenced Christian art?',
            },
            {
              cycleId: 1,
              langId: 'es',
              spelling: 'Explorar el patrimonio islámico del Mediterráneo',
              description: '',
            },
          ]
        : [];

    const result = await new ExploreThematicCycleTranslationImporter(
      contextFor(strategy, tracker, query)
    ).import();

    expect(result.success).toBe(true);
    expect(strategy.writeCollectionTranslation).not.toHaveBeenCalled();
    expect(strategy.setCollectionTranslationDescriptionByKey).toHaveBeenCalledTimes(1);
    expect(strategy.setCollectionTranslationDescriptionByKey).toHaveBeenCalledWith(
      'cycle-1',
      'eng',
      'explore-context',
      'Did you know that Islam strongly influenced Christian art?'
    );
  });
});
