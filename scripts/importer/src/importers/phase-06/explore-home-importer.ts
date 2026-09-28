/**
 * Explore Home Importer
 *
 * The Explore website's home page records, on the site's root collection
 * (`mwnf3_explore:root`, purpose `explore-root`), in `extra.explore_home`:
 * - `banners`: the home page banners. Legacy's API serves one of them at
 *   random on each request, so the site keeps them all.
 * - `featured_partnerships`: the sponsors shown on the home page (`home`) and
 *   on the pages each is scoped to (see ./explore-scope.ts).
 *
 * Legacy schema:
 * - mwnf3_explore.explore_home_banners (bannerId, name, locationId, country,
 *   monumentId, img_url_type, img_url, path, status)
 * - mwnf3_explore.featured_partnerships (spon_id, number, cycleId, country,
 *   locationId, regionId, itineraryId, path, home_display_status)
 * - mwnf3_explore.featured_partnerships_langs (spon_id, lang, title, name, url)
 *
 * Images stay paths on legacy's media server, like a gallery's chrome. Texts
 * are keyed by the inventory's language id. The root's other `extra` stays.
 *
 * Dependencies:
 * - ExploreRootCollectionsImporter
 * - LanguageImporter
 */

import { BaseImporter } from '../../core/base-importer.js';
import type { ImportResult } from '../../core/types.js';
import { EXPLORE_ROOT_KEY } from './explore-root-collections-importer.js';
import { exploreScope, type ExploreScope } from './explore-scope.js';

interface LegacyBanner {
  bannerId: number;
  name: string | null;
  locationId: number | null;
  country: string | null;
  monumentId: number | null;
  img_url_type: 'E' | 'O' | null;
  img_url: string | null;
  path: string;
}

interface LegacyPartnership {
  spon_id: number;
  cycleId: string | null;
  country: string | null;
  locationId: string | null;
  regionId: string | null;
  itineraryId: string | null;
  path: string | null;
  home_display_status: 'Y' | 'N';
}

interface LegacyPartnershipText {
  spon_id: number;
  lang: string;
  title: string;
  name: string | null;
  url: string | null;
}

export interface ExploreBanner {
  id: number;
  name: string | null;
  country: string | null;
  location: number | null;
  monument: number | null;
  /** Legacy's `img_url_type`: the banner opens a monument's page, or a page outside Explore. */
  link: 'monument' | 'outside';
  url: string | null;
  image: string;
}

export interface ExplorePartnership {
  id: number;
  logo: string | null;
  home: boolean;
  scope: ExploreScope;
  texts: Record<string, { title: string; name: string | null; url: string | null }>;
}

const orNull = (value: string | null | undefined): string | null =>
  value && value.trim() ? value.trim() : null;

/** A banner as the site keeps it. */
export function exploreBanner(legacy: LegacyBanner): ExploreBanner {
  return {
    id: legacy.bannerId,
    name: orNull(legacy.name),
    country: orNull(legacy.country)?.toLowerCase() ?? null,
    location: legacy.locationId ?? null,
    monument: legacy.monumentId ?? null,
    link: legacy.img_url_type === 'O' ? 'outside' : 'monument',
    url: orNull(legacy.img_url),
    image: legacy.path,
  };
}

export class ExploreHomeImporter extends BaseImporter {
  getName(): string {
    return 'ExploreHomeImporter';
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

      // Hidden banners (status N) are not served.
      const banners = (
        await this.context.legacyDb.query<LegacyBanner>(
          `SELECT bannerId, name, locationId, country, monumentId, img_url_type, img_url, path
           FROM mwnf3_explore.explore_home_banners
           WHERE status = 'Y'
           ORDER BY bannerId`
        )
      ).map(exploreBanner);

      const partnershipRows = await this.context.legacyDb.query<LegacyPartnership>(
        `SELECT spon_id, cycleId, country, locationId, regionId, itineraryId, path, home_display_status
         FROM mwnf3_explore.featured_partnerships
         ORDER BY spon_id, number`
      );
      const partnershipTexts = await this.context.legacyDb.query<LegacyPartnershipText>(
        `SELECT spon_id, lang, title, name, url
         FROM mwnf3_explore.featured_partnerships_langs
         ORDER BY spon_id, lang`
      );
      const partnerships = await this.partnerships(partnershipRows, partnershipTexts);

      this.logInfo(
        `Found ${banners.length} banners and ${partnerships.length} featured partnerships`
      );
      result.imported = banners.length + partnerships.length;

      if (this.isDryRun || this.isSampleOnlyMode) {
        return result;
      }

      const extra = (await this.context.strategy.getCollectionExtra(rootId)) ?? {};
      await this.context.strategy.setCollectionExtra(
        rootId,
        JSON.stringify({ ...extra, explore_home: { banners, featured_partnerships: partnerships } })
      );
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Error in Explore home import: ${errorMessage}`);
      this.logError('ExploreHomeImporter', errorMessage);
      this.showError();
    }

    return result;
  }

  /** One record per sponsor: legacy may spread its scope over several rows. */
  private async partnerships(
    rows: LegacyPartnership[],
    texts: LegacyPartnershipText[]
  ): Promise<ExplorePartnership[]> {
    const bySponsor = new Map<number, LegacyPartnership[]>();
    for (const row of rows) {
      bySponsor.set(row.spon_id, [...(bySponsor.get(row.spon_id) ?? []), row]);
    }

    const partnerships: ExplorePartnership[] = [];
    for (const [id, sponsorRows] of bySponsor) {
      const byLanguage: ExplorePartnership['texts'] = {};
      for (const text of texts.filter((row) => row.spon_id === id)) {
        const languageId = await this.getLanguageIdByLegacyCodeAsync(text.lang);
        if (!languageId) {
          this.logWarning(`Unknown language '${text.lang}' on featured partnership ${id}`);
          continue;
        }
        byLanguage[languageId] = {
          title: text.title,
          name: orNull(text.name),
          url: orNull(text.url),
        };
      }
      partnerships.push({
        id,
        logo: sponsorRows.map((row) => orNull(row.path)).find((path) => path !== null) ?? null,
        home: sponsorRows.some((row) => row.home_display_status === 'Y'),
        scope: exploreScope(
          sponsorRows.map((row) => ({
            themes: row.cycleId,
            countries: row.country,
            territories: row.regionId,
            locations: row.locationId,
            itineraries: row.itineraryId,
          }))
        ),
        texts: byLanguage,
      });
    }
    return partnerships;
  }
}
