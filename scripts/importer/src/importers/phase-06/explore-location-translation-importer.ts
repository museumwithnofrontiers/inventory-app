/**
 * Explore Location Translation Importer (Story 11.4)
 *
 * Enhances existing location collections with:
 * 1. Multilingual translations from locationtranslated (888 rows)
 *    spelling→title, description→description, extras for how_to_reach/info/contact/description_1/prepared_by
 *    The English row is ExploreLocationImporter's: it receives the extras, and
 *    the description when locationtranslated has one.
 * 2. showOnMonument flag from explorelocation (235 rows) → extra.showOnMonument
 * 3. locations_contact (1 row) → extra.contacts
 * 4. The location's historical background → the collection's
 *    extra.historical_background (see historicalBackgroundKeys)
 *
 * Dependencies:
 * - ExploreLocationImporter (location collections must exist)
 * - ExploreContextImporter
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';

/** A Travels location's key, as TravelsLocationImporter records it. */
function travelsLocationKey(
  project: string,
  country: string,
  trail: string | number,
  itinerary: string,
  number: string | number
): string {
  return `mwnf3_travels:location:${project}:${country}:${trail}:${itinerary}:${number}`;
}

/**
 * Parses `locations.et_loc_introduction`: the Travels locations the Explore
 * office picked as a location's introduction, as comma-separated
 * `project;country;itinerary;number;lang;trail#order`, in their order. An
 * order of `-` does not hide one from the live site, so it only sorts last.
 */
export function parseTravelsReferences(value: string | null): string[] {
  if (!value || !value.trim()) return [];
  const references = value.split(',').flatMap((part, index) => {
    const [reference = '', order = ''] = part.trim().split('#');
    const [project, country, itinerary, number, , trail] = reference.split(';');
    if (!project || !country || !itinerary || !number || !trail) return [];
    const rank = /^\d+$/.test(order) ? Number(order) : Number.POSITIVE_INFINITY;
    return [{ key: travelsLocationKey(project, country, trail, itinerary, number), rank, index }];
  });
  references.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return [...new Set(references.map((reference) => reference.key))];
}

/**
 * The Travels texts a location shows as its historical background, after its
 * own (the translation's description), as legacy's API picks them:
 * - the references the office picked, those that have a text;
 * - with none picked, the Travels location of the same country whose title is
 *   the location's name in the country's language (`fallback`, matched in SQL
 *   so legacy's collation decides).
 */
export function historicalBackgroundKeys(
  references: string[],
  withText: ReadonlySet<string>,
  fallback: string[]
): string[] {
  if (references.length === 0) return fallback;
  return references.filter((key) => withText.has(key));
}

/**
 * Contacts without repeats. Two contacts are the same when they hold the same
 * values: the database stores a JSON object's keys in its own order, so the
 * order they were written in does not count.
 */
export function uniqueContacts(
  contacts: Array<Record<string, string>>
): Array<Record<string, string>> {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const identity = JSON.stringify(
      Object.keys(contact)
        .sort()
        .map((key) => [key, contact[key]])
    );
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

interface LegacyTravelsKey {
  project_id: string;
  country: string;
  trail_id: number;
  itinerary_id: string;
  number: string;
}

interface LegacyLocationTranslation {
  locationId: number;
  langId: string;
  spelling: string | null;
  description: string | null;
  how_to_reach: string | null;
  info: string | null;
  contact: string | null;
  description_1: string | null;
  prepared_by: string | null;
}

interface LegacyExploreLocation {
  locationId: number;
  showOnMonument: number | null;
}

interface LegacyLocationContact {
  locationId: number;
  name: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
}

export class ExploreLocationTranslationImporter extends BaseImporter {
  private exploreContextId!: string;

  getName(): string {
    return 'ExploreLocationTranslationImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      // Resolve Explore context
      const exploreContextBC = 'mwnf3_explore:context';
      const exploreContextId = await this.getEntityUuidAsync(exploreContextBC, 'context');
      if (!exploreContextId) {
        throw new Error(`Explore context not found (${exploreContextBC}).`);
      }
      this.exploreContextId = exploreContextId;

      this.logInfo('Importing location translations...');

      // 1. Multilingual translations
      const translations = await this.context.legacyDb.query<LegacyLocationTranslation>(
        `SELECT locationId, langId, spelling, description, how_to_reach, info, contact, description_1, prepared_by
         FROM mwnf3_explore.locationtranslated`
      );
      this.logInfo(`Found ${translations.length} location translations`);

      for (const trans of translations) {
        try {
          const locationBC = `mwnf3_explore:location:${trans.locationId}`;
          const collectionId = await this.getEntityUuidAsync(locationBC, 'collection');
          if (!collectionId) {
            this.logWarning(`Location collection not found: ${locationBC}, skipping translation`);
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const languageId = await this.getLanguageIdByLegacyCodeAsync(trans.langId);
          if (!languageId) {
            this.logWarning(
              `Unknown language code '${trans.langId}' for location ${trans.locationId}, skipping`
            );
            result.skipped++;
            this.showSkipped();
            continue;
          }

          if (!trans.spelling || !trans.spelling.trim()) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          const translationBC = `${locationBC}:multilingual:${languageId}`;

          // Skip if already exists
          if (await this.entityExistsAsync(translationBC, 'collection_translation')) {
            result.skipped++;
            this.showSkipped();
            continue;
          }

          // Build extra JSON for additional fields
          const extra: Record<string, unknown> = {};
          if (trans.how_to_reach) extra.how_to_reach = trans.how_to_reach;
          if (trans.info) extra.info = trans.info;
          if (trans.contact) extra.contact = trans.contact;
          if (trans.description_1) extra.description_1 = trans.description_1;
          if (trans.prepared_by) extra.prepared_by = trans.prepared_by;
          const extraJson = Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;

          if (this.isDryRun || this.isSampleOnlyMode) {
            this.logInfo(
              `[${this.isSampleOnlyMode ? 'SAMPLE' : 'DRY-RUN'}] Would create location translation: location ${trans.locationId} / ${languageId}`
            );
            result.imported++;
            this.showProgress();
            continue;
          }

          // For English: the original ExploreLocationImporter already created an English translation.
          // If this is English, update the existing translation's extra instead of creating a new one.
          if (languageId === 'eng') {
            if (trans.description && trans.description.trim()) {
              await this.context.strategy.setCollectionTranslationDescriptionByKey(
                collectionId,
                'eng',
                this.exploreContextId,
                trans.description
              );
            }
            if (extraJson) {
              const existingExtra = await this.context.strategy.getCollectionTranslationExtra(
                collectionId,
                'eng'
              );
              const merged = existingExtra ?? {};
              Object.assign(merged, extra);
              await this.context.strategy.setCollectionTranslationExtra(
                collectionId,
                'eng',
                JSON.stringify(merged)
              );
            }
            result.imported++;
            this.showProgress();
            continue;
          }

          await this.context.strategy.writeCollectionTranslation({
            collection_id: collectionId,
            language_id: languageId,
            context_id: this.exploreContextId,
            backward_compatibility: translationBC,
            title: trans.spelling,
            description: trans.description ?? '',
            extra: extraJson,
          });

          result.imported++;
          this.showProgress();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logWarning(
            `Failed location translation ${trans.locationId}/${trans.langId}: ${message}`
          );
        }
      }

      // 2. showOnMonument flag from explorelocation → extra.showOnMonument
      const exploreLocations = await this.context.legacyDb.query<LegacyExploreLocation>(
        `SELECT locationId, showOnMonument FROM mwnf3_explore.explorelocation`
      );
      this.logInfo(`Found ${exploreLocations.length} explorelocation visibility flags`);

      for (const loc of exploreLocations) {
        try {
          const locationBC = `mwnf3_explore:location:${loc.locationId}`;
          const collectionId = await this.getEntityUuidAsync(locationBC, 'collection');
          if (!collectionId) continue;

          if (this.isDryRun || this.isSampleOnlyMode) continue;

          const existingExtra = await this.context.strategy.getCollectionTranslationExtra(
            collectionId,
            'eng'
          );
          const extra = existingExtra ?? {};
          extra.showOnMonument = loc.showOnMonument === 1;

          await this.context.strategy.setCollectionTranslationExtra(
            collectionId,
            'eng',
            JSON.stringify(extra)
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logWarning(`Failed showOnMonument for location ${loc.locationId}: ${message}`);
        }
      }

      // 3. locations_contact → extra.contacts
      const contacts = await this.context.legacyDb.query<LegacyLocationContact>(
        `SELECT locationId, institution AS name,
                CONCAT_WS(', ', NULLIF(street, ''), CONCAT_WS(' ', NULLIF(zip, ''), NULLIF(city, ''))) AS address,
                phone, fax, email, url AS website
         FROM mwnf3_explore.locations_contact`
      );
      this.logInfo(`Found ${contacts.length} location contacts`);

      for (const c of contacts) {
        try {
          const locationBC = `mwnf3_explore:location:${c.locationId}`;
          const collectionId = await this.getEntityUuidAsync(locationBC, 'collection');
          if (!collectionId) continue;

          if (this.isDryRun || this.isSampleOnlyMode) continue;

          const existingExtra = await this.context.strategy.getCollectionTranslationExtra(
            collectionId,
            'eng'
          );
          const extra = existingExtra ?? {};
          const contactObj: Record<string, string> = {};
          if (c.name) contactObj.name = c.name;
          if (c.address) contactObj.address = c.address;
          if (c.phone) contactObj.phone = c.phone;
          if (c.fax) contactObj.fax = c.fax;
          if (c.email) contactObj.email = c.email;
          if (c.website) contactObj.website = c.website;

          // A re-run meets the contact it already added: it is not added twice,
          // and a copy an earlier run left is dropped.
          const existing = (extra.contacts as Array<Record<string, string>> | undefined) ?? [];
          const contacts = uniqueContacts([...existing, contactObj]);
          if (
            Object.keys(contactObj).length > 0 &&
            JSON.stringify(contacts) !== JSON.stringify(existing)
          ) {
            extra.contacts = contacts;
            await this.context.strategy.setCollectionTranslationExtra(
              collectionId,
              'eng',
              JSON.stringify(extra)
            );
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logWarning(`Failed contact for location ${c.locationId}: ${message}`);
        }
      }

      await this.importHistoricalBackgrounds();
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in location translation import: ${errorMessage}`);
      this.logError('ExploreLocationTranslationImporter', errorMessage);
      this.showError();
    }

    return result;
  }

  /**
   * 4. Records on each location collection the Travels texts it shows as its
   * historical background: `extra.historical_background`, their keys in
   * order. The texts themselves are the Travels locations' translations
   * (TravelsLocationTranslationImporter), which this phase precedes, so the
   * key is what is kept. The collection's other `extra` stays.
   */
  private async importHistoricalBackgrounds(): Promise<void> {
    const picked = await this.context.legacyDb.query<{
      locationId: number;
      et_loc_introduction: string;
    }>(
      `SELECT locationId, et_loc_introduction
       FROM mwnf3_explore.locations
       WHERE et_loc_introduction IS NOT NULL AND et_loc_introduction <> ''`
    );
    const withText = await this.context.legacyDb.query<LegacyTravelsKey>(
      `SELECT DISTINCT project_id, country, trail_id, itinerary_id, number
       FROM mwnf3_travels.tr_locations
       WHERE description IS NOT NULL AND description <> ''`
    );
    // With no pick, legacy's API matches the location's name in its country's
    // language (English when the location has no name in it) against the
    // titles of that country's Travels locations, in legacy's collation: case,
    // accents and trailing spaces do not count.
    const matched = await this.context.legacyDb.query<LegacyTravelsKey & { locationId: number }>(
      `SELECT l.locationId, trl.project_id, trl.country, trl.trail_id, trl.itinerary_id, trl.number
       FROM mwnf3_explore.locations l
       LEFT JOIN mwnf3.countries mc ON mc.country = l.countryId
       JOIN mwnf3_explore.locationtranslated lt
         ON lt.locationId = l.locationId
        AND lt.langId = IF(EXISTS (SELECT 1 FROM mwnf3_explore.locationtranslated x
                                   WHERE x.locationId = l.locationId AND x.langId = mc.lang_id),
                           mc.lang_id, 'en')
       JOIN mwnf3_travels.tr_locations trl
         ON trl.country = l.countryId AND trl.lang = lt.langId AND trl.title = lt.spelling
       WHERE (l.et_loc_introduction IS NULL OR l.et_loc_introduction = '')
         AND trl.description IS NOT NULL AND trl.description <> ''
       ORDER BY l.locationId, trl.project_id, trl.trail_id, trl.itinerary_id, trl.number`
    );

    const keyOf = (row: LegacyTravelsKey) =>
      travelsLocationKey(row.project_id, row.country, row.trail_id, row.itinerary_id, row.number);
    const textKeys = new Set(withText.map(keyOf));
    const fallback = new Map<number, string[]>();
    for (const row of matched) {
      fallback.set(row.locationId, [...(fallback.get(row.locationId) ?? []), keyOf(row)]);
    }
    const references = new Map(
      picked.map((row) => [row.locationId, parseTravelsReferences(row.et_loc_introduction)])
    );

    const locationIds = [...new Set([...references.keys(), ...fallback.keys()])];
    let recorded = 0;
    for (const locationId of locationIds) {
      const keys = historicalBackgroundKeys(
        references.get(locationId) ?? [],
        textKeys,
        fallback.get(locationId) ?? []
      );
      if (keys.length === 0) continue;
      try {
        const collectionId = await this.getEntityUuidAsync(
          `mwnf3_explore:location:${locationId}`,
          'collection'
        );
        if (!collectionId || this.isDryRun || this.isSampleOnlyMode) continue;

        const extra = (await this.context.strategy.getCollectionExtra(collectionId)) ?? {};
        await this.context.strategy.setCollectionExtra(
          collectionId,
          JSON.stringify({ ...extra, historical_background: keys })
        );
        recorded++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logWarning(`Failed historical background for location ${locationId}: ${message}`);
      }
    }
    this.logInfo(`Recorded a Travels historical background on ${recorded} locations`);
  }
}
