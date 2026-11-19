/**
 * The collection relations that left `extra` for the model (M16 E3, #2649).
 * Each legacy id is resolved by its legacy key; none stays in the inventory.
 *
 * On the collection's English translation in its own context (where the
 * Explore importers write them):
 * - `country_ids` (legacy country codes) → `collection_country`, in order;
 * - `location_ids`, `territory_ids`, `theme_ids`, `additional_regions`
 *   (legacy Explore ids) → `collection_collection`, by kind, in order.
 *
 * On the collection:
 * - `historical_background` (collection legacy keys) → `collection_collection`;
 * - `thg_theme.cover_picture` → `collections.cover_item_id`;
 * - `days` → `collections.days`.
 *
 * The exporters give each key back to the packages
 * (`scripts/exporters/shared/collection-relations.mjs`), so keep the lists
 * equal.
 */

import { COUNTRY_CODE_ALIASES, COUNTRY_CODE_MAP } from './code-mappings.js';

export type CollectionRelationKind =
  | 'location'
  | 'territory'
  | 'theme'
  | 'additional_region'
  | 'historical_background';

export interface TranslationLinkKey {
  /** The key on the translation's `extra`: a list of legacy Explore ids. */
  key: string;
  kind: CollectionRelationKind;
  /** The legacy key prefix an id resolves under. */
  prefix: string;
}

export const TRANSLATION_LINK_KEYS: readonly TranslationLinkKey[] = [
  { key: 'location_ids', kind: 'location', prefix: 'mwnf3_explore:location:' },
  { key: 'territory_ids', kind: 'territory', prefix: 'mwnf3_explore:region:' },
  { key: 'theme_ids', kind: 'theme', prefix: 'mwnf3_explore:thematiccycle:' },
  { key: 'additional_regions', kind: 'additional_region', prefix: 'mwnf3_explore:region:' },
];

/** The translation keys this step moves. */
export const TRANSLATION_RELATION_KEYS: readonly string[] = [
  'country_ids',
  ...TRANSLATION_LINK_KEYS.map((entry) => entry.key),
];

/** The collection keys this step moves. */
export const COLLECTION_RELATION_KEYS: readonly string[] = [
  'historical_background',
  'thg_theme',
  'days',
];

/**
 * The ISO3 id of a legacy country code, or null when the code can't be given
 * back from it: unknown, an alias (`ix`, `px`), or sharing its ISO3 with
 * another code that is no alias.
 */
export function roundTripCountryId(code: unknown): string | null {
  if (typeof code !== 'string' || COUNTRY_CODE_ALIASES.includes(code)) return null;
  const iso3 = COUNTRY_CODE_MAP[code];
  if (!iso3) return null;
  const canonical = Object.entries(COUNTRY_CODE_MAP).filter(
    ([legacy, id]) => id === iso3 && !COUNTRY_CODE_ALIASES.includes(legacy)
  );
  return canonical.length === 1 ? iso3 : null;
}

/** The ISO3 ids of a `country_ids` list, in order, or null if it is empty or one doesn't round-trip. */
export function countryIdsOf(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const ids: string[] = [];
  for (const code of value) {
    const id = roundTripCountryId(code);
    if (id === null || ids.includes(id)) return null;
    ids.push(id);
  }
  return ids;
}

/** The legacy keys of a list of legacy Explore ids, in order, or null if one is no integer. */
export function legacyKeysOf(value: unknown, prefix: string): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const keys: string[] = [];
  for (const id of value) {
    if (typeof id !== 'number' || !Number.isInteger(id)) return null;
    const key = `${prefix}${id}`;
    if (keys.includes(key)) return null;
    keys.push(key);
  }
  return keys;
}

/** The legacy keys of `historical_background`, in order, or null if one is no text. */
export function backgroundKeysOf(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const keys: string[] = [];
  for (const key of value) {
    if (typeof key !== 'string' || key === '' || keys.includes(key)) return null;
    keys.push(key);
  }
  return keys;
}

/** The cover picture of `thg_theme`, when it is the only thing it holds. */
export function coverPictureOf(
  value: unknown
): { item_id: string; backward_compatibility: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const theme = value as Record<string, unknown>;
  if (Object.keys(theme).length !== 1) return null;
  const cover = theme['cover_picture'];
  if (!cover || typeof cover !== 'object' || Array.isArray(cover)) return null;
  const { item_id, backward_compatibility, ...rest } = cover as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return null;
  if (typeof item_id !== 'string' || typeof backward_compatibility !== 'string') return null;
  return { item_id, backward_compatibility };
}

/** `days`, when it is a positive integer. */
export function daysOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65535
    ? value
    : null;
}

/** The extra without the given keys, or null when nothing else is left. */
export function withoutKeys(
  extra: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> | null {
  const rest = Object.fromEntries(Object.entries(extra).filter(([key]) => !keys.includes(key)));
  return Object.keys(rest).length > 0 ? rest : null;
}
