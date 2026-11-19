/**
 * Explore's monuments on placements, which left `collection_item.extra` for
 * `collection_item_explore_monuments` (M16 C4, #2644; ADR 006). Explore lists
 * its monuments by its own ids, which the model doesn't hold: an Explore
 * monument merged into a Travels or mwnf3 record has no item of its own, and
 * one placed item can stand for several. So each Explore monument a
 * placement stands for is a row of the placement, kept as written:
 *
 * - On an Explore location (collection `mwnf3_explore:location:…`):
 *   `explore_monument_ids` (the list, in order) → one row per id, its
 *   `position` and its legacy key `mwnf3_explore:monument:<id>`;
 *   `explore_geo` (`{<id>: {latitude, longitude, map_zoom}}`) → that row's
 *   coordinates; `explore_museums` (`{<id>: [partner key]}`) → its museums,
 *   resolved by legacy key.
 * - On an Explore itinerary (collection `mwnf3_explore:itinerary:…`):
 *   `explore_monument_id` → one row; `location_id` → its location collection,
 *   resolved by legacy key; `desc_types`, `tr_mn_desc`, `explore_mn_desc`,
 *   `vm_mn_desc` (legacy's references to the texts it showed) → four columns,
 *   as written. Nothing reads these four today.
 *
 * A placement whose keys don't have that shape keeps them all in `extra`,
 * reported; so does one whose location or museum doesn't resolve. The
 * exporters put the keys back (`scripts/exporters/shared/explore-monuments.mjs`),
 * so keep the two in step.
 */

/** The `collection_item.extra` keys this module moves. */
export const EXPLORE_MONUMENT_KEYS: readonly string[] = [
  'explore_monument_ids',
  'explore_geo',
  'explore_museums',
  'explore_monument_id',
  'location_id',
  'desc_types',
  'tr_mn_desc',
  'explore_mn_desc',
  'vm_mn_desc',
];

const LOCATION_KEYS = ['explore_monument_ids', 'explore_geo', 'explore_museums'];
const ITINERARY_KEYS = [
  'explore_monument_id',
  'location_id',
  'desc_types',
  'tr_mn_desc',
  'explore_mn_desc',
  'vm_mn_desc',
];

/** Each itinerary description reference and its column. */
const DESCRIPTION_REFERENCES = [
  ['desc_types', 'description_types'],
  ['tr_mn_desc', 'travels_description_ref'],
  ['explore_mn_desc', 'explore_description_ref'],
  ['vm_mn_desc', 'virtual_museum_description_ref'],
] as const;

export const LOCATION_PREFIX = 'mwnf3_explore:location:';
export const ITINERARY_PREFIX = 'mwnf3_explore:itinerary:';
export const MONUMENT_PREFIX = 'mwnf3_explore:monument:';

/** A row of the placement, before its location and museums are resolved. */
export interface ExploreMonumentPlan {
  position: number;
  backward_compatibility: string;
  latitude: number | null;
  longitude: number | null;
  map_zoom: number | null;
  /** The legacy key of its location collection (itineraries). */
  location_key: string | null;
  description_types: string | null;
  travels_description_ref: string | null;
  explore_description_ref: string | null;
  virtual_museum_description_ref: string | null;
  /** The legacy keys of its museums, in order. */
  museum_keys: string[];
}

export interface SplitExploreMonuments {
  /** The extra without the moved keys, or null when nothing else is left. */
  extra: Record<string, unknown> | null;
  /** The rows to write, in order; empty when the keys stay. */
  monuments: ExploreMonumentPlan[];
  /** Why the keys stay in `extra`, when they do. */
  kept: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

function rest(extra: Record<string, unknown>): Record<string, unknown> | null {
  const left = Object.fromEntries(
    Object.entries(extra).filter(([key]) => !EXPLORE_MONUMENT_KEYS.includes(key))
  );
  return Object.keys(left).length > 0 ? left : null;
}

function blank(position: number, id: number): ExploreMonumentPlan {
  return {
    position,
    backward_compatibility: `${MONUMENT_PREFIX}${id}`,
    latitude: null,
    longitude: null,
    map_zoom: null,
    location_key: null,
    description_types: null,
    travels_description_ref: null,
    explore_description_ref: null,
    virtual_museum_description_ref: null,
    museum_keys: [],
  };
}

/** A geo entry with exactly latitude, longitude and map_zoom, or null. */
function geoOf(value: unknown): { latitude: number; longitude: number; map_zoom: number } | null {
  if (!isObject(value) || Object.keys(value).length !== 3) return null;
  const { latitude, longitude, map_zoom: mapZoom } = value;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (typeof mapZoom !== 'number' || !Number.isInteger(mapZoom)) return null;
  return { latitude, longitude, map_zoom: mapZoom };
}

function splitLocation(extra: Record<string, unknown>): ExploreMonumentPlan[] | string {
  const ids = extra.explore_monument_ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isId)) {
    return 'explore_monument_ids is not a list of Explore monument ids';
  }
  if (new Set(ids).size !== ids.length) return 'explore_monument_ids repeats an id';
  const monuments = ids.map((id, index) => blank(index + 1, id));
  const byId = new Map(ids.map((id, index) => [String(id), monuments[index]!]));

  if ('explore_geo' in extra) {
    const geo = extra.explore_geo;
    if (!isObject(geo)) return 'explore_geo is not a map of id to coordinates';
    for (const [id, value] of Object.entries(geo)) {
      const monument = byId.get(id);
      const point = geoOf(value);
      if (!monument) return `explore_geo names ${id}, which explore_monument_ids doesn't list`;
      if (!point) return `explore_geo of ${id} is not {latitude, longitude, map_zoom}`;
      Object.assign(monument, point);
    }
  }
  if ('explore_museums' in extra) {
    const museums = extra.explore_museums;
    if (!isObject(museums)) return 'explore_museums is not a map of id to partner keys';
    for (const [id, keys] of Object.entries(museums)) {
      const monument = byId.get(id);
      if (!monument) return `explore_museums names ${id}, which explore_monument_ids doesn't list`;
      if (
        !Array.isArray(keys) ||
        keys.length === 0 ||
        !keys.every((key) => typeof key === 'string') ||
        new Set(keys).size !== keys.length
      ) {
        return `explore_museums of ${id} is not a list of distinct partner keys`;
      }
      monument.museum_keys = keys as string[];
    }
  }
  return monuments;
}

function splitItinerary(extra: Record<string, unknown>): ExploreMonumentPlan[] | string {
  const id = extra.explore_monument_id;
  const location = extra.location_id;
  if (!isId(id)) return 'explore_monument_id is not an Explore monument id';
  if (!isId(location)) return 'location_id is not an Explore location id';
  const monument = blank(1, id);
  monument.location_key = `${LOCATION_PREFIX}${location}`;
  for (const [key, column] of DESCRIPTION_REFERENCES) {
    if (!(key in extra)) continue;
    const value = extra[key];
    if (typeof value !== 'string' || value === '') return `${key} is not a text`;
    monument[column] = value;
  }
  return [monument];
}

/**
 * Splits a placement's Explore monuments off its extra.
 *
 * @param collectionBackwardCompatibility the legacy key of the placement's
 *   collection: an Explore location's placements list their monuments, an
 *   itinerary's name one.
 */
export function splitExploreMonuments(
  extra: Record<string, unknown>,
  collectionBackwardCompatibility: string | null
): SplitExploreMonuments {
  const present = EXPLORE_MONUMENT_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(extra, key)
  );
  if (present.length === 0) return { extra, monuments: [], kept: [] };
  const keep = (reason: string): SplitExploreMonuments => ({
    extra,
    monuments: [],
    kept: [`${present.join(', ')} (${reason})`],
  });

  const source = collectionBackwardCompatibility ?? '';
  const isLocation = source.startsWith(LOCATION_PREFIX);
  const isItinerary = source.startsWith(ITINERARY_PREFIX);
  if (!isLocation && !isItinerary) {
    return keep(`its collection ${JSON.stringify(collectionBackwardCompatibility)} is no Explore location or itinerary`);
  }
  const allowed = isLocation ? LOCATION_KEYS : ITINERARY_KEYS;
  const foreign = present.filter((key) => !allowed.includes(key));
  if (foreign.length > 0) {
    return keep(`${foreign.join(', ')} on an Explore ${isLocation ? 'location' : 'itinerary'}`);
  }

  const monuments = isLocation ? splitLocation(extra) : splitItinerary(extra);
  if (typeof monuments === 'string') return keep(monuments);
  return { extra: rest(extra), monuments, kept: [] };
}

/** The deterministic-uuid name of a placement's Explore monument: one per (placement, position). */
export function exploreMonumentUuidName(placementId: string, position: number): string {
  return `collection_item_explore_monument:${placementId}:${position}`;
}
