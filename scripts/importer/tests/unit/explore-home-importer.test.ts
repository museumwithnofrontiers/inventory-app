import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ExploreHomeImporter,
  exploreBanner,
} from '../../src/importers/phase-06/explore-home-importer.js';
import { ExploreRootCollectionsImporter } from '../../src/importers/phase-06/explore-root-collections-importer.js';
import { exploreScope } from '../../src/importers/phase-06/explore-scope.js';
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

const legacyDb = (query: (sql: string) => unknown[]): ILegacyDatabase => ({
  query: vi.fn(async (sql: string) => query(sql)) as ILegacyDatabase['query'],
  execute: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
});

describe('exploreScope', () => {
  it("reads legacy's comma-separated lists, one level each, as ids", () => {
    expect(
      exploreScope([
        {
          themes: '1',
          countries: 'dz,eg, jo',
          locations: '42',
          territories: '',
          itineraries: '60,79,1',
        },
      ])
    ).toEqual({
      themes: [1],
      countries: ['dz', 'eg', 'jo'],
      locations: [42],
      itineraries: [1, 60, 79],
    });
  });

  it('scopes a record stored over several rows by all of them, and leaves out empty levels', () => {
    expect(exploreScope([{ locations: '558' }, { locations: '558,12', monuments: null }])).toEqual({
      locations: [12, 558],
    });
  });
});

describe('exploreBanner', () => {
  it("keeps where the banner leads and legacy's image path", () => {
    expect(
      exploreBanner({
        bannerId: 2,
        name: 'Jesuitenkirche Innsbruck',
        locationId: 558,
        country: 'at',
        monumentId: 1501,
        img_url_type: 'E',
        img_url: 'https://explore.museumwnf.org/countries/c-at/l-558/m-1501',
        path: 'explore/banners/homebanners/10.jpg',
      })
    ).toEqual({
      id: 2,
      name: 'Jesuitenkirche Innsbruck',
      country: 'at',
      location: 558,
      monument: 1501,
      link: 'monument',
      url: 'https://explore.museumwnf.org/countries/c-at/l-558/m-1501',
      image: 'explore/banners/homebanners/10.jpg',
    });
  });
});

describe('ExploreHomeImporter', () => {
  let tracker: UnifiedTracker;
  let strategy: IWriteStrategy;
  let context: ImportContext;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();
    tracker.set('mwnf3_explore:root', 'root-uuid', 'collection');
    tracker.set('en', 'eng', 'language');
    tracker.set('it', 'ita', 'language');

    strategy = {
      getCollectionExtra: vi.fn().mockResolvedValue({ note: 'kept' }),
      setCollectionExtra: vi.fn().mockResolvedValue(undefined),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
    } as unknown as IWriteStrategy;

    context = {
      legacyDb: legacyDb((sql) => {
        if (sql.includes('FROM mwnf3_explore.explore_home_banners')) {
          return [
            {
              bannerId: 15,
              name: 'Colourful Mosque',
              locationId: 638,
              country: 'mc',
              monumentId: 1638,
              img_url_type: 'O',
              img_url:
                'https://sharinghistory.museumwnf.org/database_item.php?id=monument;AWE;mc;10;en;N',
              path: 'explore/banners/homebanners/9.jpg',
            },
          ];
        }
        if (sql.includes('FROM mwnf3_explore.featured_partnerships_langs')) {
          return [
            {
              spon_id: 8,
              lang: 'en',
              title: 'Barakat',
              name: 'Barakat Trust',
              url: 'https://barakat.org/',
            },
            {
              spon_id: 8,
              lang: 'it',
              title: 'Barakat',
              name: 'Con il contributo di',
              url: 'https://barakat.org/',
            },
            {
              spon_id: 12,
              lang: 'en',
              title: 'Tirol Werbung',
              name: 'Tyrol Tourism Board',
              url: 'https://www.tyrol.com/',
            },
          ];
        }
        if (sql.includes('FROM mwnf3_explore.featured_partnerships')) {
          return [
            {
              spon_id: 8,
              cycleId: '1',
              country: 'dz,eg',
              locationId: '42',
              regionId: '',
              itineraryId: '60,79',
              path: 'explore/partners/8/8.jpg',
              home_display_status: 'Y',
            },
            {
              spon_id: 12,
              cycleId: '8',
              country: '',
              locationId: '558',
              regionId: '12',
              itineraryId: '',
              path: 'explore/partners/12/12.jpg',
              home_display_status: 'N',
            },
          ];
        }
        return [];
      }),
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('writes the banners and partnerships on the site root, keeping its other extra', async () => {
    const result = await new ExploreHomeImporter(context).import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(3);
    const [id, extra] = vi.mocked(strategy.setCollectionExtra).mock.calls[0]!;
    expect(id).toBe('root-uuid');
    const written = JSON.parse(extra);
    expect(written.note).toBe('kept');
    expect(written.explore_home.banners).toEqual([
      expect.objectContaining({
        id: 15,
        link: 'outside',
        image: 'explore/banners/homebanners/9.jpg',
      }),
    ]);
    expect(written.explore_home.featured_partnerships).toEqual([
      {
        id: 8,
        logo: 'explore/partners/8/8.jpg',
        home: true,
        scope: { themes: [1], countries: ['dz', 'eg'], locations: [42], itineraries: [60, 79] },
        texts: {
          eng: { title: 'Barakat', name: 'Barakat Trust', url: 'https://barakat.org/' },
          ita: { title: 'Barakat', name: 'Con il contributo di', url: 'https://barakat.org/' },
        },
      },
      {
        id: 12,
        logo: 'explore/partners/12/12.jpg',
        home: false,
        scope: { themes: [8], territories: [12], locations: [558] },
        texts: {
          eng: {
            title: 'Tirol Werbung',
            name: 'Tyrol Tourism Board',
            url: 'https://www.tyrol.com/',
          },
        },
      },
    ]);
  });

  it('fails without the site root', async () => {
    tracker = new UnifiedTracker();
    const result = await new ExploreHomeImporter({ ...context, tracker }).import();

    expect(result.success).toBe(false);
    expect(strategy.setCollectionExtra).not.toHaveBeenCalled();
  });
});

describe('ExploreRootCollectionsImporter', () => {
  it('files the section roots under the site root, and moves ones that predate it', async () => {
    const tracker = new UnifiedTracker();
    tracker.set('mwnf3_explore:context', 'context-uuid', 'context');
    tracker.setMetadata('default_language_id', 'eng');
    // A section root imported before the site root existed.
    tracker.set('mwnf3_explore:root:explore_by_theme', 'themes-uuid', 'collection');

    const strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeCollection: vi.fn(async (data: { backward_compatibility: string }) =>
        data.backward_compatibility === 'mwnf3_explore:root'
          ? 'site-uuid'
          : `${data.backward_compatibility}-uuid`
      ),
      writeCollectionTranslation: vi.fn().mockResolvedValue(undefined),
      getCollectionPurpose: vi.fn().mockResolvedValue('explore-themes-root'),
      getCollectionParentId: vi.fn().mockResolvedValue(null),
      updateCollectionParentId: vi.fn().mockResolvedValue(undefined),
      updateCollectionPurpose: vi.fn().mockResolvedValue(undefined),
    } as unknown as IWriteStrategy;

    const result = await new ExploreRootCollectionsImporter({
      legacyDb: legacyDb(() => []),
      strategy,
      tracker,
      logger,
      dryRun: false,
    }).import();

    expect(result.success).toBe(true);
    const written = vi.mocked(strategy.writeCollection).mock.calls.map(([data]) => data);
    expect(written[0]).toMatchObject({
      backward_compatibility: 'mwnf3_explore:root',
      purpose: 'explore-root',
      parent_id: null,
    });
    expect(written.slice(1).map((data) => data.parent_id)).toEqual(['site-uuid', 'site-uuid']);
    expect(strategy.updateCollectionParentId).toHaveBeenCalledWith('themes-uuid', 'site-uuid');
  });
});
