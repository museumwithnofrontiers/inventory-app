import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ExploreTravelImporter,
  textFields,
  tourSubtitle,
} from '../../src/importers/phase-06/explore-travel-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('textFields', () => {
  it('keeps the fields legacy fills, under their new names', () => {
    expect(
      textFields(
        { title: 'Visit Jordan', link: 'http://www.visitjordan.com', note: '' },
        {
          title: 'title',
          link: 'link',
          note: 'note',
        }
      )
    ).toEqual({ title: 'Visit Jordan', link: 'http://www.visitjordan.com' });
  });
});

describe('tourSubtitle', () => {
  it('names the country, and its first place where the language has one', () => {
    expect(tourSubtitle([{ country: 'Jordan', place: 'Amman' }])).toBe('Jordan - Amman');
    expect(tourSubtitle([{ country: 'Jordania', place: null }])).toBe('Jordania');
  });
});

describe('ExploreTravelImporter', () => {
  let tracker: UnifiedTracker;
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

  const scope = { country: 'jo', locationId: '10,16', monumentId: '', regionId: '' };

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();
    tracker.set('mwnf3_explore:root', 'root-uuid', 'collection');
    tracker.set('en', 'eng', 'language');
    tracker.set('es', 'spa', 'language');

    strategy = {
      getCollectionExtra: vi.fn().mockResolvedValue({ explore_home: { banners: [] } }),
      setCollectionExtra: vi.fn().mockResolvedValue(undefined),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
    } as unknown as IWriteStrategy;

    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_explore.featured_books_explore')) {
        return [
          {
            book_id: 10,
            cycle: '1',
            ...scope,
            lang_id: 'en',
            title: 'The Umayyads',
            intro: 'Jordan, a MWNF Travel Book',
            read_more: 'https://books.museumwnf.org/book/4/en',
          },
          {
            book_id: 10,
            cycle: '1',
            ...scope,
            lang_id: 'es',
            title: 'The Umayyads',
            intro: 'Jordania',
            read_more: '',
          },
        ];
      }
      if (sql.includes('FROM mwnf3_travels.tr_images')) {
        return [
          { travel_id: 45, path: 'travels/45/128.jpg' },
          { travel_id: 45, path: 'travels/45/200.jpg' },
        ];
      }
      if (sql.includes('FROM mwnf3_travels.travels_countries')) {
        return [
          { travel_id: 45, lang: 'en', country: 'Jordan', place: 'Amman' },
          { travel_id: 45, lang: 'es', country: 'Jordania', place: null },
        ];
      }
      if (sql.includes('FROM mwnf3_explore.featured_tours_explore')) {
        return [
          {
            tours_id: 6,
            travel_id: 45,
            cycle: '1',
            ...scope,
            lang_id: 'en',
            title: 'THE UMAYYADS',
            intro: 'A MWNF Tour',
            read_more: 'https://travels.museumwnf.org/tourdetails.php?id=45',
          },
          {
            tours_id: 6,
            travel_id: 45,
            cycle: '1',
            ...scope,
            lang_id: 'es',
            title: 'THE UMAYYADS',
            intro: 'Un Tour',
            read_more: null,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_explore.accommodation_hotels_langs')) {
        return [
          {
            hotel_id: 3,
            langId: 'en',
            name: 'Il Melograno',
            description: '',
            street: 'Via Appia Nuova, 7F',
            zip: '',
            city: 'Ariccia',
            phone: '+39069331937',
            fax: '',
            email: '',
            url: 'www.melogranobb.com',
            note: '',
          },
        ];
      }
      if (sql.includes('FROM mwnf3_explore.accommodation_hotels')) {
        return [
          {
            hotel_id: 3,
            order: 2,
            type_code: 'BED',
            cycleId: '',
            country: 'it',
            locationId: '409',
            monumentId: '',
            regionId: '',
            itineraryId: '',
            path: '',
          },
        ];
      }
      if (sql.includes('FROM mwnf3_explore.accommodation_types')) {
        return [
          { type_code: 'BED', order: 3, langId: 'en', type_name: 'Bed & Breakfast' },
          { type_code: 'BED', order: 3, langId: 'es', type_name: 'Bed & Breakfast' },
        ];
      }
      if (sql.includes('FROM mwnf3_explore.guided_visits_contacts_langs')) {
        return [
          {
            contact_id: 1,
            langId: 'en',
            name: 'Guided Visit Ariccia',
            street: 'Piazza di Corte',
            zip: '00072',
            city: 'Ariccia',
            phone: '+39 06 9330053',
            fax: '',
            email: 'info@palazzochigiariccia.it',
            url: '',
            contact_person: null,
            note: '',
          },
        ];
      }
      if (sql.includes('FROM mwnf3_explore.guided_visits_contacts')) {
        return [
          {
            contact_id: 1,
            order: 1,
            cycle: null,
            country: null,
            locationId: '409',
            monumentId: null,
            regionId: null,
            itineraryId: null,
            path: null,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_explore.useful_websites')) {
        return [
          {
            web_id: 7,
            cycle: '',
            ...scope,
            itineraryId: '',
            title: 'Visit Jordan',
            link: 'http://www.visitjordan.com',
            note: '',
            lang_id: 'en',
            order: 7,
          },
          {
            web_id: 7,
            cycle: '',
            ...scope,
            itineraryId: '',
            title: 'Visit Jordan',
            link: 'http://www.visitjordan.com',
            note: '',
            lang_id: 'es',
            order: 7,
          },
        ];
      }
      return [];
    });

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

  it("writes every block once on the site root, with its scope, keeping the root's other extra", async () => {
    const result = await new ExploreTravelImporter(context).import();

    expect(result.success).toBe(true);
    const [id, json] = vi.mocked(strategy.setCollectionExtra).mock.calls[0]!;
    expect(id).toBe('root-uuid');
    const extra = JSON.parse(json);
    expect(extra.explore_home).toEqual({ banners: [] });
    const travel = extra.explore_travel;

    expect(travel.books).toEqual([
      {
        id: 10,
        scope: { themes: [1], countries: ['jo'], locations: [10, 16] },
        texts: {
          eng: {
            title: 'The Umayyads',
            intro: 'Jordan, a MWNF Travel Book',
            read_more: 'https://books.museumwnf.org/book/4/en',
          },
          spa: { title: 'The Umayyads', intro: 'Jordania' },
        },
      },
    ]);
    expect(travel.tours).toEqual([
      expect.objectContaining({
        id: 6,
        travel_id: 45,
        image: 'travels/45/128.jpg',
        texts: {
          eng: expect.objectContaining({ subtitle: 'Jordan - Amman' }),
          spa: expect.objectContaining({ subtitle: 'Jordania' }),
        },
      }),
    ]);
    expect(travel.accommodations).toEqual([
      {
        id: 3,
        order: 2,
        category: 'BED',
        image: null,
        scope: { countries: ['it'], locations: [409] },
        texts: {
          eng: {
            name: 'Il Melograno',
            street: 'Via Appia Nuova, 7F',
            city: 'Ariccia',
            phone: '+39069331937',
            url: 'www.melogranobb.com',
          },
        },
      },
    ]);
    expect(travel.accommodation_categories).toEqual([
      { code: 'BED', order: 3, names: { eng: 'Bed & Breakfast', spa: 'Bed & Breakfast' } },
    ]);
    expect(travel.guided_visits[0]).toMatchObject({
      id: 1,
      scope: { locations: [409] },
      texts: { eng: { name: 'Guided Visit Ariccia', email: 'info@palazzochigiariccia.it' } },
    });
    expect(travel.useful_websites).toEqual([
      {
        id: 7,
        order: 7,
        scope: { countries: ['jo'], locations: [10, 16] },
        texts: {
          eng: { title: 'Visit Jordan', link: 'http://www.visitjordan.com' },
          spa: { title: 'Visit Jordan', link: 'http://www.visitjordan.com' },
        },
      },
    ]);
  });

  it('fails without the site root', async () => {
    const result = await new ExploreTravelImporter({
      ...context,
      tracker: new UnifiedTracker(),
    }).import();

    expect(result.success).toBe(false);
    expect(strategy.setCollectionExtra).not.toHaveBeenCalled();
  });
});
