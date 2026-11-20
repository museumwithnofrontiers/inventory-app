import type { ItemData } from '../../core/types.js';
import { mapCountryCode, mapLanguageCode } from '../../utils/code-mappings.js';
import {
  selectItemInternalName,
  type ItemInternalNameCandidate,
} from './item-internal-name-transformer.js';

export interface ExploreMonumentNameTranslation {
  langId: string;
  name: string | null;
}

export interface ExploreLegacyMonument {
  monumentId: number;
  locationId: number | null;
  title: string;
  geoCoordinates: string | null;
  zoom: number | null;
  special_monument: string | null;
  related_monument: string | null;
  /**
   * The legacy 2-char country code of the monument's location, joined in from
   * `mwnf3_explore.locations.countryId`. Legacy stores no country on the
   * monument row itself and derives it at query time through this same hop.
   * See museumwithnofrontiers/inventory-app#1593.
   */
  countryId: string | null;
}

/**
 * One `exploremonumentext` row's period years (varchar columns holding integer
 * years, M16 G2 #2697).
 */
export interface ExploreMonumentPeriodRow {
  langId: string;
  period_from: string | null;
  period_to: string | null;
}

export interface ExploreMonumentPeriod {
  start_date: number | null;
  end_date: number | null;
  warnings: string[];
}

/**
 * The item's start and end years from a monument's `period_from` and
 * `period_to`, as written. The columns sit on the per-language rows, so a year
 * is kept only when every row that has one agrees, and only when it is a whole
 * number; otherwise it stays null, reported.
 */
export function selectExploreMonumentPeriod(
  backwardCompatibility: string,
  rows: readonly ExploreMonumentPeriodRow[]
): ExploreMonumentPeriod {
  const warnings: string[] = [];
  const year = (column: 'period_from' | 'period_to'): number | null => {
    const values = [
      ...new Set(
        rows.map((row) => (row[column] ?? '').trim()).filter((value) => value !== '')
      ),
    ];
    if (values.length === 0) return null;
    if (values.length > 1) {
      warnings.push(
        `Explore monument ${backwardCompatibility}: ${column} differs between languages (${values.join(', ')}), left empty`
      );
      return null;
    }
    const value = values[0]!;
    if (!/^-?\d+$/.test(value)) {
      warnings.push(
        `Explore monument ${backwardCompatibility}: ${column} '${value}' is not a whole year, left empty`
      );
      return null;
    }
    return Number(value);
  };

  return { start_date: year('period_from'), end_date: year('period_to'), warnings };
}

export interface TransformedExploreMonument {
  data: Omit<ItemData, 'collection_id' | 'partner_id' | 'project_id'>;
  backwardCompatibility: string;
  warnings: string[];
  locationId: number | null;
}

export function parseGeoCoordinates(coords: string | null): [number | null, number | null] {
  if (coords === null) {
    return [null, null];
  }

  if (coords.trim() === '') {
    return [null, null];
  }

  const cleaned = coords.replace(/\s+/g, '').trim();
  const parts = cleaned.split(',');
  if (parts.length !== 2) {
    return [null, null];
  }

  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lon)) {
    return [null, null];
  }

  return [lat, lon];
}

export function transformExploreMonument(
  legacy: ExploreLegacyMonument,
  translations: ExploreMonumentNameTranslation[],
  defaultLanguageId: string,
  periodRows: readonly ExploreMonumentPeriodRow[] = []
): TransformedExploreMonument {
  const backwardCompatibility = `mwnf3_explore:monument:${legacy.monumentId}`;
  const candidates: ItemInternalNameCandidate[] = [];

  for (const translation of translations) {
    candidates.push({
      languageId: mapLanguageCode(translation.langId),
      value: translation.name,
    });
  }

  const selectedInternalName = selectItemInternalName(
    candidates,
    defaultLanguageId,
    'Explore monument',
    backwardCompatibility
  );
  const [latitude, longitude] = parseGeoCoordinates(legacy.geoCoordinates);

  const warnings = selectedInternalName.warning ? [selectedInternalName.warning] : [];
  const period = selectExploreMonumentPeriod(backwardCompatibility, periodRows);
  warnings.push(...period.warnings);

  // Legacy resolves the country at query time via locationId → countries; the
  // 2-char code is mapped to the inventory's ISO alpha-3 id here. An unmappable
  // code is a per-row warning, never a failed import (#1593).
  let countryId: string | null = null;
  const legacyCountryCode = legacy.countryId?.trim();
  if (legacyCountryCode) {
    try {
      countryId = mapCountryCode(legacyCountryCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(
        `Explore monument ${backwardCompatibility}: country code '${legacyCountryCode}' cannot be mapped: ${message}`
      );
    }
  }

  return {
    data: {
      internal_name: selectedInternalName.internalName,
      backward_compatibility: backwardCompatibility,
      type: 'monument',
      country_id: countryId,
      parent_id: null,
      owner_reference: null,
      mwnf_reference: null,
      start_date: period.start_date,
      end_date: period.end_date,
      latitude,
      longitude,
      map_zoom: legacy.zoom,
    },
    backwardCompatibility,
    warnings,
    locationId: legacy.locationId,
  };
}
