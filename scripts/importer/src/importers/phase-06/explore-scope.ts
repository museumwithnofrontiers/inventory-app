/**
 * The pages an Explore site record is shown on.
 *
 * Legacy scopes each of its site records (a featured partnership, a travel
 * book, a useful website…) with one comma-separated list of ids per level:
 * `cycle`, `country`, `regionId`, `locationId`, `monumentId`, `itineraryId`.
 * The live API shows a record on a page when the page's id is in the list for
 * the page's level. The scope keeps those lists, as legacy ids: each names the
 * Explore collection `mwnf3_explore:{thematiccycle|country|region|location|
 * itinerary}:{id}`, and a monument id is the one location memberships keep in
 * `explore_monument_ids`, because a resolved monument has no Explore key.
 */

export interface ExploreScope {
  themes?: number[];
  countries?: string[];
  territories?: number[];
  locations?: number[];
  monuments?: number[];
  itineraries?: number[];
}

/** One level's list, as legacy stores it. */
export interface ExploreScopeColumns {
  themes?: string | null;
  countries?: string | null;
  territories?: string | null;
  locations?: string | null;
  monuments?: string | null;
  itineraries?: string | null;
}

function ids(value: string | null | undefined): number[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => /^\d+$/.test(part))
    .map(Number);
}

function codes(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => /^[a-z]{2}$/.test(part));
}

const unique = <T extends number | string>(values: T[]): T[] =>
  [...new Set(values)].sort((a, b) =>
    typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
  );

/**
 * A record's scope from its legacy lists. A record legacy stores over several
 * rows is scoped by all of them. A level with no id is left out.
 */
export function exploreScope(rows: ExploreScopeColumns[]): ExploreScope {
  const scope: ExploreScope = {};
  const themes = unique(rows.flatMap((row) => ids(row.themes)));
  const countries = unique(rows.flatMap((row) => codes(row.countries)));
  const territories = unique(rows.flatMap((row) => ids(row.territories)));
  const locations = unique(rows.flatMap((row) => ids(row.locations)));
  const monuments = unique(rows.flatMap((row) => ids(row.monuments)));
  const itineraries = unique(rows.flatMap((row) => ids(row.itineraries)));
  if (themes.length > 0) scope.themes = themes;
  if (countries.length > 0) scope.countries = countries;
  if (territories.length > 0) scope.territories = territories;
  if (locations.length > 0) scope.locations = locations;
  if (monuments.length > 0) scope.monuments = monuments;
  if (itineraries.length > 0) scope.itineraries = itineraries;
  return scope;
}
