/**
 * Explore Travel Importer
 *
 * The travel information Explore shows next to its heritage content, on the
 * site's root collection (`mwnf3_explore:root`), in `extra.explore_travel`.
 * Each record is kept once, with the pages it is shown on as its `scope` (see
 * ./explore-scope.ts):
 * - `books`: MWNF Travel Books (featured_books_explore), linking to the Books site,
 *   with the cover legacy shows from the Books database (see `bookCover`)
 * - `tours`: MWNF Tours (featured_tours_explore), with the tour's picture and
 *   its places from the Travels database
 * - `accommodations` (accommodation_hotels, _langs), in `accommodation_categories`
 *   (accommodation_types)
 * - `guided_visits` (guided_visits_contacts, _langs)
 * - `useful_websites` (useful_websites)
 *
 * The tables legacy's API does not serve are not read: the older
 * `explorecountry…` and `explorelocation…` link tables, `hotels`, `otherbooks`,
 * `othertravels`, `eating…`, `excursions…`, `guided_visits` (their
 * introductions) and `accommodation`.
 *
 * Images stay paths on legacy's media server. Texts are keyed by the
 * inventory's language id, and a field legacy leaves empty is left out. The
 * root's other `extra` stays.
 *
 * Dependencies:
 * - ExploreRootCollectionsImporter
 * - LanguageImporter
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { EXPLORE_ROOT_KEY } from './explore-root-collections-importer.js';
import { exploreScope, type ExploreScope, type ExploreScopeColumns } from './explore-scope.js';

type Texts = Record<string, Record<string, string>>;

export interface TravelRecord {
  id: number;
  scope: ExploreScope;
  texts: Texts;
  [field: string]: unknown;
}

type ScopedRow = {
  cycle?: string | null;
  cycleId?: string | null;
  country: string | null;
  locationId: string | null;
  monumentId: string | null;
  regionId: string | null;
  itineraryId?: string | null;
};

/** The row's own fields that are set, as a record's texts in one language. */
export function textFields(
  row: Record<string, unknown>,
  fields: Record<string, string>
): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const [column, field] of Object.entries(fields)) {
    const value = row[column];
    if (typeof value === 'string' && value.trim()) texts[field] = value.trim();
  }
  return texts;
}

const scopeColumns = (row: ScopedRow): ExploreScopeColumns => ({
  themes: row.cycle ?? row.cycleId ?? null,
  countries: row.country,
  territories: row.regionId,
  locations: row.locationId,
  monuments: row.monumentId,
  itineraries: row.itineraryId ?? null,
});

/**
 * A tour's subtitle in one language, as legacy composes it: each of its
 * countries, followed by its first place when the language has a name for it.
 */
export function tourSubtitle(places: Array<{ country: string; place: string | null }>): string {
  return places.map(({ country, place }) => (place ? `${country} - ${place}` : country)).join(', ');
}

/**
 * The Books database's id of the book a Travel Book's link names:
 * `https://books.museumwnf.org/book/{id}/{lang}` or the older
 * `books_detail.php?booklngid={id};{lang}`.
 */
export function booksId(readMore: string | null | undefined): number | null {
  const match = /\/book\/(\d+)\/|booklngid=(\d+);/.exec(readMore ?? '');
  return match ? Number(match[1] ?? match[2]) : null;
}

export interface BookCoverRow {
  lang_id: string;
  booktype: string;
  image_number: number;
  path: string;
}

/** The editions whose covers legacy shows, in its order; a `digp` cover never is. */
const COVER_BOOKTYPES = ['book', 'ebook'];

/**
 * The cover legacy shows for a Travel Book, among its book's `cover` pictures
 * in the Books database: the printed book's, else the eBook's; of those, the
 * highest number; on a tie, the English one. Checked against every book
 * legacy's API showed.
 */
export function bookCover(covers: BookCoverRow[]): string | null {
  const rank = (cover: BookCoverRow) => COVER_BOOKTYPES.indexOf(cover.booktype);
  const [first] = covers
    .filter((cover) => rank(cover) !== -1 && cover.path.trim())
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(b.image_number) - Number(a.image_number) ||
        Number(b.lang_id === 'en') - Number(a.lang_id === 'en') ||
        a.lang_id.localeCompare(b.lang_id)
    );
  return first ? first.path.trim() : null;
}

export class ExploreTravelImporter extends BaseImporter {
  private languages = new Map<string, string | null>();

  getName(): string {
    return 'ExploreTravelImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      const rootId = await this.getEntityUuidAsync(EXPLORE_ROOT_KEY, 'collection');
      if (!rootId) {
        throw new Error(
          `Explore root not found (${EXPLORE_ROOT_KEY}). Run ExploreRootCollectionsImporter first.`
        );
      }

      const travel = {
        books: await this.books(),
        tours: await this.tours(),
        accommodations: await this.accommodations(),
        accommodation_categories: await this.accommodationCategories(),
        guided_visits: await this.guidedVisits(),
        useful_websites: await this.usefulWebsites(),
      };
      for (const [block, records] of Object.entries(travel)) {
        this.logInfo(`${block}: ${records.length}`);
        result.imported += records.length;
      }

      if (this.isDryRun || this.isSampleOnlyMode) {
        return result;
      }

      const extra = (await this.context.strategy.getCollectionExtra(rootId)) ?? {};
      await this.context.strategy.setCollectionExtra(
        rootId,
        JSON.stringify({ ...extra, explore_travel: travel })
      );
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in Explore travel import: ${errorMessage}`);
      this.logError('ExploreTravelImporter', errorMessage);
      this.showError();
    }

    return result;
  }

  private async language(legacyCode: string): Promise<string | null> {
    if (!this.languages.has(legacyCode)) {
      const languageId = await this.getLanguageIdByLegacyCodeAsync(legacyCode);
      if (!languageId) this.logWarning(`Unknown language '${legacyCode}' in the travel layer`);
      this.languages.set(legacyCode, languageId);
    }
    return this.languages.get(legacyCode) ?? null;
  }

  /**
   * One record per id from rows legacy stores once per language: the scope
   * from all of them, and each language's texts from its own row.
   */
  private async perLanguage<R extends ScopedRow & Record<string, unknown>>(
    rows: R[],
    id: keyof R & string,
    language: keyof R & string,
    fields: Record<string, string>,
    extra: (first: R) => Record<string, unknown> = () => ({})
  ): Promise<TravelRecord[]> {
    const byId = new Map<number, R[]>();
    for (const row of rows) {
      const key = Number(row[id]);
      byId.set(key, [...(byId.get(key) ?? []), row]);
    }
    const records: TravelRecord[] = [];
    for (const [key, group] of byId) {
      const texts: Texts = {};
      for (const row of group) {
        const languageId = await this.language(String(row[language]));
        const values = textFields(row, fields);
        if (languageId && Object.keys(values).length > 0) texts[languageId] = values;
      }
      records.push({
        id: key,
        ...extra(group[0]!),
        scope: exploreScope(group.map(scopeColumns)),
        texts,
      });
    }
    return records;
  }

  private async books(): Promise<TravelRecord[]> {
    const rows = await this.context.legacyDb.query<
      ScopedRow & {
        book_id: number;
        lang_id: string;
        title: string;
        intro: string;
        read_more: string | null;
      }
    >(
      `SELECT book_id, cycle, country, locationId, monumentId, regionId, lang_id, title, intro, read_more
       FROM mwnf3_explore.featured_books_explore
       ORDER BY book_id, lang_id`
    );
    // The book in the Books database is the one its link names, in any language.
    const bookOf = new Map<number, number>();
    for (const row of rows) {
      const id = booksId(row.read_more);
      if (id !== null && !bookOf.has(Number(row.book_id))) bookOf.set(Number(row.book_id), id);
    }
    const covers = await this.context.legacyDb.query<BookCoverRow & { book_id: number }>(
      `SELECT book_id, lang_id, booktype, image_number, path
       FROM mwnf3.books_pictures
       WHERE type = 'cover'
       ORDER BY book_id, image_number, lang_id`
    );
    const coverOf = (exploreId: number): string | null => {
      const id = bookOf.get(exploreId);
      return id === undefined
        ? null
        : bookCover(covers.filter((cover) => Number(cover.book_id) === id));
    };
    return this.perLanguage(
      rows,
      'book_id',
      'lang_id',
      { title: 'title', intro: 'intro', read_more: 'read_more' },
      (first) => ({ image: coverOf(Number(first.book_id)) })
    );
  }

  private async tours(): Promise<TravelRecord[]> {
    const rows = await this.context.legacyDb.query<
      ScopedRow & {
        tours_id: number;
        travel_id: number | null;
        lang_id: string;
        title: string;
        intro: string;
        read_more: string | null;
      }
    >(
      `SELECT tours_id, travel_id, cycle, country, locationId, monumentId, regionId, lang_id, title, intro, read_more
       FROM mwnf3_explore.featured_tours_explore
       ORDER BY tours_id, lang_id`
    );
    // The tour's picture and places are the Travels database's.
    const images = await this.context.legacyDb.query<{ travel_id: number; path: string }>(
      `SELECT travel_id, path
       FROM mwnf3_travels.tr_images
       WHERE travel_id IN (SELECT travel_id FROM mwnf3_explore.featured_tours_explore)
       ORDER BY travel_id, n, image_id`
    );
    const places = await this.context.legacyDb.query<{
      travel_id: number;
      lang: string;
      country: string;
      place: string | null;
    }>(
      `SELECT tc.travel_id, cn.lang, cn.name AS country,
              (SELECT lt.location
                 FROM mwnf3_travels.travels_countries_locations tcl
                 JOIN mwnf3_travels.travels_clocations_texts lt
                   ON lt.loc_id = tcl.loc_id AND lt.lang_id = cn.lang
                WHERE tcl.travel_country_id = tc.id AND lt.location <> ''
                ORDER BY tcl.loc_id
                LIMIT 1) AS place
       FROM mwnf3_travels.travels_countries tc
       JOIN mwnf3.countrynames cn ON cn.country = tc.country_id
       WHERE tc.travel_id IN (SELECT travel_id FROM mwnf3_explore.featured_tours_explore)
       ORDER BY tc.travel_id, tc.n, tc.id`
    );

    const imageOf = new Map<number, string>();
    for (const image of images) {
      if (!imageOf.has(image.travel_id)) imageOf.set(image.travel_id, image.path);
    }
    const subtitle = (travelId: number | null, lang: string): string | null => {
      const of = places.filter((row) => row.travel_id === travelId && row.lang === lang);
      return of.length > 0 ? tourSubtitle(of) : null;
    };

    const withSubtitles = rows.map((row) => ({
      ...row,
      subtitle: subtitle(row.travel_id, row.lang_id),
    }));
    return this.perLanguage(
      withSubtitles,
      'tours_id',
      'lang_id',
      { title: 'title', subtitle: 'subtitle', intro: 'intro', read_more: 'read_more' },
      (first) => ({
        travel_id: first.travel_id ?? null,
        image: first.travel_id !== null ? (imageOf.get(first.travel_id) ?? null) : null,
      })
    );
  }

  private async accommodations(): Promise<TravelRecord[]> {
    const hotels = await this.context.legacyDb.query<
      ScopedRow & { hotel_id: number; order: number; type_code: string; path: string | null }
    >(
      `SELECT hotel_id, \`order\`, type_code, cycleId, country, locationId, monumentId, regionId, itineraryId, path
       FROM mwnf3_explore.accommodation_hotels
       ORDER BY hotel_id`
    );
    const texts = await this.context.legacyDb.query<
      Record<string, unknown> & { hotel_id: number; langId: string }
    >(
      `SELECT hotel_id, langId, name, description, street, zip, city, phone, fax, email, url, note
       FROM mwnf3_explore.accommodation_hotels_langs
       ORDER BY hotel_id, langId`
    );
    const records: TravelRecord[] = [];
    for (const hotel of hotels) {
      records.push({
        id: hotel.hotel_id,
        order: hotel.order,
        category: hotel.type_code,
        image: hotel.path && hotel.path.trim() ? hotel.path.trim() : null,
        scope: exploreScope([scopeColumns(hotel)]),
        texts: await this.textsOf(
          texts.filter((row) => row.hotel_id === hotel.hotel_id),
          'langId',
          CONTACT_FIELDS
        ),
      });
    }
    return records;
  }

  private async accommodationCategories(): Promise<Array<Record<string, unknown>>> {
    const rows = await this.context.legacyDb.query<{
      type_code: string;
      order: number;
      langId: string;
      type_name: string;
    }>(
      `SELECT type_code, \`order\`, langId, type_name
       FROM mwnf3_explore.accommodation_types
       ORDER BY \`order\`, type_code, langId`
    );
    const categories = new Map<
      string,
      { code: string; order: number; names: Record<string, string> }
    >();
    for (const row of rows) {
      const category = categories.get(row.type_code) ?? {
        code: row.type_code,
        order: row.order,
        names: {},
      };
      const languageId = await this.language(row.langId);
      if (languageId && row.type_name?.trim()) category.names[languageId] = row.type_name.trim();
      categories.set(row.type_code, category);
    }
    return [...categories.values()];
  }

  private async guidedVisits(): Promise<TravelRecord[]> {
    const contacts = await this.context.legacyDb.query<
      ScopedRow & { contact_id: number; order: number; path: string | null }
    >(
      `SELECT contact_id, \`order\`, cycle, country, locationId, monumentId, regionId, itineraryId, path
       FROM mwnf3_explore.guided_visits_contacts
       ORDER BY contact_id`
    );
    const texts = await this.context.legacyDb.query<
      Record<string, unknown> & { contact_id: number; langId: string }
    >(
      `SELECT contact_id, langId, name, street, zip, city, phone, fax, email, url, contact_person, note
       FROM mwnf3_explore.guided_visits_contacts_langs
       ORDER BY contact_id, langId`
    );
    const records: TravelRecord[] = [];
    for (const contact of contacts) {
      records.push({
        id: contact.contact_id,
        order: contact.order,
        image: contact.path && contact.path.trim() ? contact.path.trim() : null,
        scope: exploreScope([scopeColumns(contact)]),
        texts: await this.textsOf(
          texts.filter((row) => row.contact_id === contact.contact_id),
          'langId',
          { ...CONTACT_FIELDS, contact_person: 'contact_person' }
        ),
      });
    }
    return records;
  }

  private async usefulWebsites(): Promise<TravelRecord[]> {
    const rows = await this.context.legacyDb.query<
      ScopedRow & {
        web_id: number;
        lang_id: string;
        order: number;
        title: string;
        link: string;
        note: string;
      }
    >(
      `SELECT web_id, cycle, country, locationId, monumentId, regionId, itineraryId, title, link, note, lang_id, \`order\`
       FROM mwnf3_explore.useful_websites
       ORDER BY web_id, lang_id`
    );
    return this.perLanguage(
      rows,
      'web_id',
      'lang_id',
      { title: 'title', link: 'link', note: 'note' },
      (first) => ({ order: first.order })
    );
  }

  private async textsOf(
    rows: Array<Record<string, unknown>>,
    language: string,
    fields: Record<string, string>
  ): Promise<Texts> {
    const texts: Texts = {};
    for (const row of rows) {
      const languageId = await this.language(String(row[language]));
      const values = textFields(row, fields);
      if (languageId && Object.keys(values).length > 0) texts[languageId] = values;
    }
    return texts;
  }
}

/** An address as legacy's accommodation and guided-visit tables hold it. */
const CONTACT_FIELDS: Record<string, string> = {
  name: 'name',
  description: 'description',
  street: 'street',
  zip: 'zip',
  city: 'city',
  phone: 'phone',
  fax: 'fax',
  email: 'email',
  url: 'url',
  note: 'note',
};
