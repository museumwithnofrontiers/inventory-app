/**
 * Legacy region names
 *
 * `mwnf3.regionnames` names a museum's, institution's or school's
 * `region_id` per language. Legacy's partner lists head a country's
 * partners with it ("Italy / Bologna", modules/pm_partner_list.php), in the
 * page's language. Each partner translation carries the name in its own
 * language as `extra.region`; a language without a name gets none.
 */

import type { ILegacyDatabase } from '../core/base-importer.js';

/** Region name by region id and legacy language code. */
export type RegionNames = Map<string, string>;

const regionKey = (regionId: string, lang: string): string => `${regionId}\u0000${lang}`;

export async function loadRegionNames(legacyDb: ILegacyDatabase): Promise<RegionNames> {
  const rows = await legacyDb.query<{ region: string; lang: string; name: string }>(
    'SELECT region, lang, name FROM mwnf3.regionnames'
  );
  return new Map(rows.map((row) => [regionKey(row.region, row.lang), row.name]));
}

/** The region's name in a legacy language, or undefined when it has none. */
export function regionName(
  names: RegionNames,
  regionId: string | null | undefined,
  lang: string
): string | undefined {
  if (!regionId) return undefined;
  return names.get(regionKey(regionId, lang))?.trim() || undefined;
}
