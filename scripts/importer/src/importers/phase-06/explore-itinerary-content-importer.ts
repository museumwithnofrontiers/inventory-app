/**
 * Explore Itinerary Content Importer (Story 12.1)
 *
 * Enhances existing itinerary collections with:
 * 1. Multilingual translations from explore_itineraries_langs (260 rows)
 * 2. Monument links from explore_itineraries_rel_monuments (1,060 rows) → collection_item
 * 3. Location/country/territory metadata (553 rows across 3 tables) → extra JSON
 * 4. Old itineraries from itineraries (34 rows) → new Collections
 * 5. Old itinerary monument links from itineraries_rel_mon (359 rows) → collection_item
 * 6. Cross-schema monument-itinerary links from mwnf3.monuments_explore_itineraries (372 rows)
 *
 * Dependencies:
 * - ExploreItineraryImporter (itinerary collections must exist)
 * - ExploreMonumentImporter (monuments must exist)
 * - ExploreLocationImporter (locations must exist)
 * - ExploreContextImporter
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { ExploreMonumentResolver } from './explore-monument-resolver.js';

interface LegacyItineraryLang {
  itineraries_id: number;
  langId: string;
  title: string | null;
  introduction: string | null;
  duration: string | null;
  local_team: string | null;
  author: string | null;
  introd_type: string | null;
  et_title: string | null;
  et_introduction: string | null;
}

interface LegacyItineraryMonument {
  itineraries_id: number;
  monumentId: number;
  locationId: number | null;
  mn_order: number | null;
  desc_types: string | null;
  explore_mn_desc: string | null;
  tr_mn_desc: string | null;
  vm_mn_desc: string | null;
}

interface LegacyItineraryLocation {
  itineraries_id: number;
  locationId: number;
}

interface LegacyItineraryCountry {
  itineraries_id: number;
  countryId: string;
}

interface LegacyItineraryTerritory {
  itineraries_id: number;
  regionId: number;
}

interface LegacyOldItinerary {
  itinerary_id: number;
  locationId: number | null;
  label: string;
  geoCoordinates: string | null;
  zoom: number | null;
}

interface LegacyOldItineraryMonument {
  itinerary_id: number;
  monumentId: number;
  itin_order: number | null;
}

interface LegacyCrossSchemaLink {
  project_id: string;
  country: string;
  institution_id: string;
  monument_numero: number;
  itineraryId: number;
}

interface LegacyTravelsDescription {
  description: string | null;
}

function parseGeoCoordinates(coords: string | null): [number | null, number | null] {
  if (!coords || !coords.trim()) return [null, null];
  const cleaned = coords.replace(/\s+/g, '').trim();
  const parts = cleaned.split(',');
  if (parts.length !== 2) return [null, null];
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lon)) return [null, null];
  return [lat, lon];
}

export class ExploreItineraryContentImporter extends BaseImporter {
  private exploreContextId!: string;
  private exploreByItineraryId: string | null = null;
  private monumentResolver!: ExploreMonumentResolver;

  getName(): string {
    return 'ExploreItineraryContentImporter';
  }

  async import(): Promise<ImportResult> {
    const result = this.createResult();

    try {
      // Resolve context
      const exploreContextBC = 'mwnf3_explore:context';
      const exploreContextId = await this.getEntityUuidAsync(exploreContextBC, 'context');
      if (!exploreContextId) {
        throw new Error(`Explore context not found (${exploreContextBC}).`);
      }
      this.exploreContextId = exploreContextId;
      this.monumentResolver = new ExploreMonumentResolver({
        legacyDb: this.context.legacyDb,
        tracker: this.context.tracker,
        getEntityUuid: (backwardCompatibility, entityType) =>
          this.getEntityUuidAsync(backwardCompatibility, entityType),
      });

      // Get Explore by Itinerary root
      const byItineraryBC = 'mwnf3_explore:root:explore_by_itinerary';
      this.exploreByItineraryId = await this.getEntityUuidAsync(byItineraryBC, 'collection');

      // 1. Multilingual translations
      await this.importTranslations(result);

      // 2. Monument links
      await this.importMonumentLinks(result);

      // 3. Metadata (location, country, territory)
      await this.importMetadata(result);

      // 4. Old itineraries
      await this.importOldItineraries(result);

      // 5. Old itinerary monument links
      await this.importOldItineraryMonumentLinks(result);

      // 6. Cross-schema links from mwnf3
      await this.importCrossSchemaLinks(result);
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in itinerary content import: ${errorMessage}`);
      this.logError('ExploreItineraryContentImporter', errorMessage);
      this.showError();
    }

    return result;
  }

  private async importTranslations(result: ImportResult): Promise<void> {
    this.logInfo('Importing itinerary translations...');
    const translations = await this.context.legacyDb.query<LegacyItineraryLang>(
      `SELECT itineraries_id, lang_id AS langId, title, introduction, duration, local_team, author, introd_type,
              et_short_introduction AS et_title, et_long_introduction AS et_introduction
       FROM mwnf3_explore.explore_itineraries_langs`
    );
    this.logInfo(`Found ${translations.length} itinerary translations`);

    for (const trans of translations) {
      try {
        const itineraryBC = `mwnf3_explore:itinerary:${trans.itineraries_id}`;
        const collectionId = await this.getEntityUuidAsync(itineraryBC, 'collection');
        if (!collectionId) {
          this.logWarning(`Itinerary not found: ${itineraryBC}, skipping translation`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const languageId = await this.getLanguageIdByLegacyCodeAsync(trans.langId);
        if (!languageId) {
          this.logWarning(
            `Unknown language code '${trans.langId}' for itinerary ${trans.itineraries_id}, skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const title = trans.title?.trim() ?? '';
        if (title === '') {
          // The itinerary importer used to write an English row, titled from
          // the theme's name, even where legacy gives no title: it goes.
          if (!this.isDryRun && !this.isSampleOnlyMode) {
            await this.context.strategy.deleteCollectionTranslations(
              collectionId,
              this.exploreContextId,
              languageId
            );
          }
          this.logWarning(
            `Explore itinerary ${itineraryBC} is missing a required source title for ${trans.langId}, skipping translation`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const translationBC = `${itineraryBC}:translation:${languageId}`;

        // Build extra for supplementary fields
        const extra: Record<string, unknown> = {};
        if (trans.duration) extra.duration = trans.duration;
        if (trans.local_team) extra.local_team = trans.local_team;
        if (trans.author) extra.author = trans.author;
        if (trans.introd_type) extra.introd_type = trans.introd_type;
        if (trans.et_title) extra.et_title = trans.et_title;
        if (trans.et_introduction) extra.et_introduction = trans.et_introduction;
        const extraJson = Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;
        const visibleDescription = await this.resolveVisibleDescription(trans);

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        // A row already written takes legacy's texts: the itinerary importer
        // used to write the English row itself, with a title composed from the
        // theme's name and no description. Its extra keeps what the metadata
        // step put there.
        const existing = await this.context.strategy.getCollectionTranslationByKey(
          collectionId,
          languageId,
          this.exploreContextId
        );
        if (existing) {
          await this.context.strategy.setCollectionTranslationTitleByKey(
            collectionId,
            languageId,
            this.exploreContextId,
            title
          );
          await this.context.strategy.setCollectionTranslationDescriptionByKey(
            collectionId,
            languageId,
            this.exploreContextId,
            visibleDescription
          );
          const merged = { ...(existing.extra ?? {}), ...extra };
          if (Object.keys(merged).length > 0) {
            await this.context.strategy.setCollectionTranslationExtraByKey(
              collectionId,
              languageId,
              this.exploreContextId,
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
          title,
          description: visibleDescription,
          extra: extraJson,
        });

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logWarning(
          `Failed itinerary translation ${trans.itineraries_id}/${trans.langId}: ${message}`
        );
      }
    }
  }

  private async importMonumentLinks(result: ImportResult): Promise<void> {
    this.logInfo('Importing itinerary-monument links...');
    // DDL columns: itineraries_id, country_id, territory_id, location_id, momument_id (typo in DDL),
    //   mn_order, desc_types, explore_mn_desc, tr_mn_desc, vm_mn_desc
    const links = await this.context.legacyDb.query<LegacyItineraryMonument>(
      `SELECT itineraries_id, momument_id AS monumentId, location_id AS locationId, mn_order, desc_types,
              explore_mn_desc, tr_mn_desc, vm_mn_desc
       FROM mwnf3_explore.explore_itineraries_rel_monuments
       ORDER BY itineraries_id, mn_order`
    );
    this.logInfo(`Found ${links.length} itinerary-monument links`);

    for (const link of links) {
      try {
        const itineraryBC = `mwnf3_explore:itinerary:${link.itineraries_id}`;
        const collectionId = await this.getEntityUuidAsync(itineraryBC, 'collection');
        if (!collectionId) {
          this.logWarning(`Itinerary not found: ${itineraryBC}, skipping monument link`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const monumentResolution = await this.monumentResolver.resolveForSource(link.monumentId, 'travels');
        if (!monumentResolution.itemId || !monumentResolution.itemBackwardCompatibility) {
          this.logWarning(
            `${monumentResolution.message ?? `Explore monument mwnf3_explore:monument:${link.monumentId} did not resolve to a travels item`}, skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        // Build extra with the monument's place and descriptions. The member is
        // the monument's Travels record; the Explore monument it stands for and
        // the location legacy files it under are kept with it, as on a
        // location's membership.
        const extra: Record<string, unknown> = {
          explore_monument_id: link.monumentId,
        };
        if (link.locationId) extra.location_id = link.locationId;
        if (link.mn_order !== null) extra.mn_order = link.mn_order;
        if (link.desc_types) extra.desc_types = link.desc_types;
        if (link.explore_mn_desc) extra.explore_mn_desc = link.explore_mn_desc;
        if (link.tr_mn_desc) extra.tr_mn_desc = link.tr_mn_desc;
        if (link.vm_mn_desc) extra.vm_mn_desc = link.vm_mn_desc;

        const linkBC = `mwnf3_explore:itinerary_monument:${link.itineraries_id}:${link.monumentId}`;
        await this.context.strategy.writeCollectionItem({
          collection_id: collectionId,
          item_id: monumentResolution.itemId,
          backward_compatibility: linkBC,
          display_order: link.mn_order,
          extra: Object.keys(extra).length > 0 ? extra : null,
        });

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Duplicate')) {
          this.logSkip(
            `Duplicate itinerary-monument link ${link.itineraries_id}/${link.monumentId}, skipping`
          );
          result.skipped++;
        } else {
          this.logWarning(
            `Failed itinerary-monument link ${link.itineraries_id}/${link.monumentId}: ${message}`
          );
        }
      }
    }
  }

  private async importMetadata(_result: ImportResult): Promise<void> {
    this.logInfo('Importing itinerary metadata (locations, countries, territories)...');

    // Locations, in legacy's order: `ln_order` of the English rows, as its API
    // reads them; a location only another language lists comes after.
    const locations = await this.context.legacyDb.query<LegacyItineraryLocation>(
      `SELECT itineraries_id, location_id AS locationId
       FROM mwnf3_explore.explore_itineraries_rel_locations
       ORDER BY itineraries_id, lang_id <> 'en', ln_order, location_id`
    );
    const locationsByItinerary = new Map<number, number[]>();
    for (const l of locations) {
      const list = locationsByItinerary.get(l.itineraries_id) ?? [];
      if (!list.includes(l.locationId)) list.push(l.locationId);
      locationsByItinerary.set(l.itineraries_id, list);
    }

    // Countries — DDL table: explore_itineraries_rel_country (singular), column: country_id
    const countries = await this.context.legacyDb.query<LegacyItineraryCountry>(
      `SELECT itineraries_id, country_id AS countryId FROM mwnf3_explore.explore_itineraries_rel_country`
    );
    const countriesByItinerary = new Map<number, string[]>();
    for (const c of countries) {
      const list = countriesByItinerary.get(c.itineraries_id) ?? [];
      list.push(c.countryId);
      countriesByItinerary.set(c.itineraries_id, list);
    }

    // Territories — DDL table: explore_itineraries_rel_territory (singular), column: territory_id
    const territories = await this.context.legacyDb.query<LegacyItineraryTerritory>(
      `SELECT itineraries_id, territory_id AS regionId FROM mwnf3_explore.explore_itineraries_rel_territory`
    );
    const territoriesByItinerary = new Map<number, number[]>();
    for (const t of territories) {
      const list = territoriesByItinerary.get(t.itineraries_id) ?? [];
      list.push(t.regionId);
      territoriesByItinerary.set(t.itineraries_id, list);
    }

    this.logInfo(
      `Found ${locations.length} location + ${countries.length} country + ${territories.length} territory metadata rows`
    );

    // Merge all into itinerary collection's English translation extra
    const allItineraryIds = new Set([
      ...locationsByItinerary.keys(),
      ...countriesByItinerary.keys(),
      ...territoriesByItinerary.keys(),
    ]);

    for (const itineraryId of allItineraryIds) {
      try {
        const itineraryBC = `mwnf3_explore:itinerary:${itineraryId}`;
        const collectionId = await this.getEntityUuidAsync(itineraryBC, 'collection');
        if (!collectionId) continue;

        if (this.isDryRun || this.isSampleOnlyMode) continue;

        const existingExtra = await this.context.strategy.getCollectionTranslationExtra(
          collectionId,
          'eng'
        );
        const extra = existingExtra ?? {};

        const locs = locationsByItinerary.get(itineraryId);
        if (locs) extra.location_ids = locs;

        const ctrs = countriesByItinerary.get(itineraryId);
        if (ctrs) extra.country_ids = ctrs;

        const terrs = territoriesByItinerary.get(itineraryId);
        if (terrs) extra.territory_ids = terrs;

        await this.context.strategy.setCollectionTranslationExtra(
          collectionId,
          'eng',
          JSON.stringify(extra)
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logWarning(`Failed metadata for itinerary ${itineraryId}: ${message}`);
      }
    }
  }

  private async importOldItineraries(result: ImportResult): Promise<void> {
    this.logInfo('Importing old itineraries...');
    const oldItineraries = await this.context.legacyDb.query<LegacyOldItinerary>(
      `SELECT itineraries_id AS itinerary_id,
              CAST(NULLIF(locationId, '') AS SIGNED) AS locationId,
              title AS label,
              NULL AS geoCoordinates,
              NULL AS zoom
       FROM mwnf3_explore.itineraries
       WHERE title IS NOT NULL AND title != ''
       ORDER BY CAST(NULLIF(locationId, '') AS SIGNED), itineraries_id,
                CASE WHEN lang_id IN ('en', 'eng') THEN 0 ELSE 1 END, lang_id`
    );
    this.logInfo(`Found ${oldItineraries.length} old itineraries`);

    for (const old of oldItineraries) {
      try {
        const backwardCompat = `mwnf3_explore:old_itinerary:${old.itinerary_id}`;

        if (await this.entityExistsAsync(backwardCompat, 'collection')) {
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Resolve parent location collection
        let parentId: string | null = null;
        if (old.locationId) {
          const locationBC = `mwnf3_explore:location:${old.locationId}`;
          parentId = await this.getEntityUuidAsync(locationBC, 'collection');
        }
        // Fall back to Explore by Itinerary root
        if (!parentId) {
          parentId = this.exploreByItineraryId;
        }

        const [latitude, longitude] = parseGeoCoordinates(old.geoCoordinates);
        const internalName = `old_itinerary_${old.itinerary_id}`;

        if (this.isDryRun || this.isSampleOnlyMode) {
          this.registerEntity('', backwardCompat, 'collection');
          result.imported++;
          this.showProgress();
          continue;
        }

        const collectionId = await this.context.strategy.writeCollection({
          internal_name: internalName,
          backward_compatibility: backwardCompat,
          context_id: this.exploreContextId,
          language_id: 'eng',
          parent_id: parentId,
          type: 'itinerary',
          latitude,
          longitude,
          map_zoom: old.zoom ?? null,
          country_id: null,
        });
        this.registerEntity(collectionId, backwardCompat, 'collection');

        await this.context.strategy.writeCollectionTranslation({
          collection_id: collectionId,
          language_id: 'eng',
          context_id: this.exploreContextId,
          backward_compatibility: `${backwardCompat}:translation:eng`,
          title: old.label,
          description: '',
        });

        result.imported++;
        this.showProgress();
      } catch (error) {
        result.success = false;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Old itinerary ${old.itinerary_id}: ${errorMessage}`);
        this.logError('ExploreItineraryContentImporter', errorMessage, {
          itinerary_id: old.itinerary_id,
        });
        this.showError();
      }
    }
  }

  private async importOldItineraryMonumentLinks(result: ImportResult): Promise<void> {
    this.logInfo('Importing old itinerary monument links...');
    const links = await this.context.legacyDb.query<LegacyOldItineraryMonument>(
      `SELECT itineraries_id AS itinerary_id, monumentId,
              \`order\` AS itin_order
       FROM mwnf3_explore.itineraries_rel_mon
       ORDER BY itineraries_id, \`order\``
    );
    this.logInfo(`Found ${links.length} old itinerary-monument links`);

    for (const link of links) {
      try {
        const itineraryBC = `mwnf3_explore:old_itinerary:${link.itinerary_id}`;
        const collectionId = await this.getEntityUuidAsync(itineraryBC, 'collection');
        if (!collectionId) {
          this.logWarning(`Old itinerary not found: ${itineraryBC}, skipping`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        const monumentResolution = await this.monumentResolver.resolveForSource(link.monumentId, 'travels');
        if (!monumentResolution.itemId || !monumentResolution.itemBackwardCompatibility) {
          this.logWarning(
            `${monumentResolution.message ?? `Explore monument mwnf3_explore:monument:${link.monumentId} did not resolve to a travels item`}, skipping`
          );
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        const linkBC = `mwnf3_explore:old_itinerary_monument:${link.itinerary_id}:${link.monumentId}`;
        await this.context.strategy.writeCollectionItem({
          collection_id: collectionId,
          item_id: monumentResolution.itemId,
          backward_compatibility: linkBC,
          display_order: link.itin_order,
        });

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Duplicate')) {
          this.logSkip(
            `Duplicate old itinerary-monument link ${link.itinerary_id}/${link.monumentId}, skipping`
          );
          result.skipped++;
        } else {
          this.logWarning(
            `Failed old itinerary-monument link ${link.itinerary_id}/${link.monumentId}: ${message}`
          );
        }
      }
    }
  }

  private async importCrossSchemaLinks(result: ImportResult): Promise<void> {
    this.logInfo('Importing cross-schema monument-itinerary links from mwnf3...');
    const links = await this.context.legacyDb.query<LegacyCrossSchemaLink>(
      `SELECT project_id, country, institution_id, number AS monument_numero, itineraries_id AS itineraryId
       FROM mwnf3.monuments_explore_itineraries
       ORDER BY itineraries_id, number`
    );
    this.logInfo(`Found ${links.length} cross-schema monument-itinerary links`);

    for (const link of links) {
      try {
        // Resolve mwnf3 monument
        const monumentBC = `mwnf3:monuments:${link.project_id}:${link.country}:${link.institution_id}:${link.monument_numero}`;
        const itemId = await this.getEntityUuidAsync(monumentBC, 'item');
        if (!itemId) {
          this.logWarning(`mwnf3 monument not found: ${monumentBC}, skipping`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        // Resolve itinerary collection
        const itineraryBC = `mwnf3_explore:itinerary:${link.itineraryId}`;
        const collectionId = await this.getEntityUuidAsync(itineraryBC, 'collection');
        if (!collectionId) {
          this.logWarning(`Itinerary not found: ${itineraryBC}, skipping`);
          result.skipped++;
          this.showSkipped();
          continue;
        }

        if (this.isDryRun || this.isSampleOnlyMode) {
          result.imported++;
          this.showProgress();
          continue;
        }

        const linkBC = `mwnf3:monuments_explore_itineraries:${link.project_id}:${link.country}:${link.institution_id}:${link.monument_numero}:${link.itineraryId}`;
        await this.context.strategy.writeCollectionItem({
          collection_id: collectionId,
          item_id: itemId,
          backward_compatibility: linkBC,
        });

        result.imported++;
        this.showProgress();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Duplicate')) {
          this.logSkip(
            `Duplicate cross-schema link ${link.country}:${link.monument_numero} → itinerary ${link.itineraryId}, skipping`
          );
          result.skipped++;
        } else {
          this.logWarning(
            `Failed cross-schema link ${link.country}:${link.monument_numero} → itinerary ${link.itineraryId}: ${message}`
          );
        }
      }
    }
  }

  private async resolveVisibleDescription(trans: LegacyItineraryLang): Promise<string> {
    if (trans.introduction && trans.introduction.trim() !== '') {
      return trans.introduction;
    }

    const shortDescription = await this.resolveTravelsDescriptionReference(
      trans.et_title,
      'description'
    );
    if (shortDescription) {
      return shortDescription;
    }

    const longDescription = await this.resolveTravelsDescriptionReference(
      trans.et_introduction,
      'description2'
    );
    if (longDescription) {
      return longDescription;
    }

    return '';
  }

  private async resolveTravelsDescriptionReference(
    reference: string | null,
    field: 'description' | 'description2'
  ): Promise<string | null> {
    if (!reference || reference.trim() === '') {
      return null;
    }

    const parts = reference.split(';').map((part) => part.trim());
    if (parts.length !== 5) {
      return null;
    }

    const [projectId, country, number, lang, trailIdRaw] = parts;
    const trailId = Number.parseInt(trailIdRaw, 10);
    if (!projectId || !country || !number || !lang || Number.isNaN(trailId)) {
      return null;
    }

    const rows = await this.context.legacyDb.query<LegacyTravelsDescription>(
      `SELECT ${field} AS description
       FROM mwnf3_travels.tr_itineraries
       WHERE project_id = ?
         AND country = ?
         AND number = ?
         AND lang = ?
         AND trail_id = ?
       LIMIT 1`,
      [projectId, country, number, lang, trailId]
    );

    const description = rows[0]?.description ?? null;
    return description && description.trim() !== '' ? description : null;
  }
}
