/**
 * The `site-config` command (M16 E4b, #2673): builds the site configuration
 * from the legacy database alone (SELECT only), with the importers' own
 * builders, and writes it into the instance files. It is not part of `import`.
 * Re-run it when legacy's gallery, exhibition or Explore tables change: the
 * change comes in as a diff of the instance files, reviewed in a pull request.
 *
 * `--check` compares what it builds with what an inventory database still
 * holds in `extra` (one imported before E4b), reading it only.
 */

import type { ILegacyDatabase, ILogger, ImportContext } from '../core/base-importer.js';
import type { IWriteStrategy } from '../core/strategy.js';
import { UnifiedTracker } from '../core/tracker.js';
import { ThgGalleryImporter } from '../importers/phase-10/thg-gallery-importer.js';
import { ThgHiddenMuseumImporter } from '../importers/phase-10/thg-hidden-museum-importer.js';
import { ThgGalleryTranslationImporter } from '../importers/phase-10/thg-gallery-translation-importer.js';
import { ThgGalleryLangImporter } from '../importers/phase-10/thg-gallery-lang-importer.js';
import { ThgGalleryContentImporter } from '../importers/phase-10/thg-gallery-content-importer.js';
import { Mwnf3ExhibitionTranslationImporter } from '../importers/phase-01/mwnf3-exhibition-translation-importer.js';
import { ShExhibitionShowFlagImporter } from '../importers/phase-11/sh-exhibition-show-flag-importer.js';
import { ShExhibitionImageImporter } from '../importers/phase-03/sh-exhibition-image-importer.js';
import { ExploreItineraryImporter } from '../importers/phase-06/explore-itinerary-importer.js';
import { ExploreHomeImporter } from '../importers/phase-06/explore-home-importer.js';
import { ExploreTravelImporter } from '../importers/phase-06/explore-travel-importer.js';
import { collectionUuid, legacyOnlyStrategy, mergeEntries, mysqlJsonOrdered } from './collect.js';
import { readInstanceFiles, routeRecords, writeInstanceFiles } from './instances.js';
import {
  SITE_COLLECTION_KEYS,
  SITE_TRANSLATION_KEYS,
  type SiteConfigBuilder,
  type SiteConfigEntry,
  type SiteConfigRecord,
} from './types.js';

/** The keys every text of a collection carries alike (one copy in `translation_extra`). */
const SHARED_TRANSLATION_KEYS: readonly string[] = ['thg_gallery', 'legacy_exhibition'];

export interface SiteConfigResult {
  records: Map<string, SiteConfigRecord>;
  /** collection uuid → its legacy key */
  keys: Map<string, string>;
}

/** Everything the importers build, from legacy alone. */
export async function buildSiteConfiguration(
  legacyDb: ILegacyDatabase,
  logger: ILogger
): Promise<SiteConfigResult> {
  const context: ImportContext = {
    legacyDb,
    strategy: legacyOnlyStrategy() as IWriteStrategy,
    tracker: new UnifiedTracker(),
    logger,
    dryRun: true,
  };
  const builders: SiteConfigBuilder[] = [
    new ThgGalleryImporter(context),
    new ThgHiddenMuseumImporter(context),
    new ThgGalleryTranslationImporter(context),
    new ThgGalleryLangImporter(context),
    new ThgGalleryContentImporter(context),
    new Mwnf3ExhibitionTranslationImporter(context),
    new ShExhibitionShowFlagImporter(context),
    new ShExhibitionImageImporter(context),
    new ExploreItineraryImporter(context),
    new ExploreHomeImporter(context),
    new ExploreTravelImporter(context),
  ];
  const entries: SiteConfigEntry[] = [];
  for (const builder of builders) {
    const built = await builder.siteConfiguration();
    logger.info(`${builder.getName()}: ${built.length} entr${built.length === 1 ? 'y' : 'ies'}`);
    entries.push(...built);
  }
  const keys = new Map(entries.map((entry) => [collectionUuid(entry.collection), entry.collection]));
  return { records: mergeEntries(entries), keys };
}

/** Writes the records into the instance files; throws when one has no file. */
export function writeSiteConfiguration(result: SiteConfigResult, instancesDirectory: string): string[] {
  const files = readInstanceFiles(instancesDirectory);
  const { bySlug, unrouted } = routeRecords(result.records, result.keys, files);
  if (unrouted.length > 0) {
    throw new Error(`No instance file for ${unrouted.length} collection(s): ${unrouted.join(', ')}`);
  }
  return writeInstanceFiles(files, bySlug);
}

type Query = (sql: string) => Promise<Array<Record<string, unknown>>>;

const parse = (raw: unknown): Record<string, unknown> | null =>
  raw === null || raw === undefined
    ? null
    : ((typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>);

const pick = (extra: Record<string, unknown> | null, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(extra ?? {}).filter(([key]) => keys.includes(key)));

/** The site configuration an inventory database still holds in `extra`, in the records' shape. */
export async function inventorySiteConfiguration(query: Query): Promise<Map<string, SiteConfigRecord>> {
  const records = new Map<string, SiteConfigRecord>();
  const record = (id: string) => {
    const existing = records.get(id) ?? {};
    records.set(id, existing);
    return existing;
  };
  for (const row of await query('SELECT id, extra FROM collections WHERE extra IS NOT NULL')) {
    const extra = pick(parse(row['extra']), SITE_COLLECTION_KEYS);
    if (Object.keys(extra).length > 0) record(String(row['id'])).extra = extra;
  }
  const shared = new Map<string, Map<string, string>>();
  for (const row of await query(
    'SELECT collection_id, language_id, extra FROM collection_translations WHERE extra IS NOT NULL ORDER BY collection_id, language_id'
  )) {
    const id = String(row['collection_id']);
    const extra = pick(parse(row['extra']), SITE_TRANSLATION_KEYS);
    for (const [key, value] of Object.entries(extra)) {
      const target = record(id);
      if (SHARED_TRANSLATION_KEYS.includes(key)) {
        const seen = shared.get(id) ?? new Map<string, string>();
        const text = JSON.stringify(mysqlJsonOrdered(value));
        if (seen.has(key) && seen.get(key) !== text) {
          throw new Error(`Collection ${id}: its texts carry different ${key}`);
        }
        seen.set(key, text);
        shared.set(id, seen);
        target.translation_extra = { ...(target.translation_extra ?? {}), [key]: value };
      } else {
        target.translations ??= {};
        const language = String(row['language_id']);
        target.translations[language] = { ...(target.translations[language] ?? {}), [key]: value };
      }
    }
  }
  for (const [id, value] of records) {
    if (Object.keys(value).length === 0) records.delete(id);
  }
  return records;
}

/** The differences between what the command builds and what the inventory holds, one line each. */
export function compareSiteConfiguration(
  built: Map<string, SiteConfigRecord>,
  held: Map<string, SiteConfigRecord>,
  keys: Map<string, string>
): string[] {
  const lines: string[] = [];
  const name = (id: string) => `${id} (${keys.get(id) ?? 'no legacy key built'})`;
  const parts = ['extra', 'translation_extra', 'translations'] as const;
  for (const id of new Set([...built.keys(), ...held.keys()])) {
    const a = built.get(id);
    const b = held.get(id);
    if (!b) {
      lines.push(`only built: ${name(id)}`);
      continue;
    }
    if (!a) {
      lines.push(`only in the inventory: ${name(id)}`);
      continue;
    }
    for (const part of parts) {
      const at = firstDifference(mysqlJsonOrdered(a[part] ?? {}), mysqlJsonOrdered(b[part] ?? {}), part);
      if (at) lines.push(`differs: ${name(id)} ${at}`);
    }
  }
  return lines;
}

/** Where two values first differ, with both values there, or null when they are equal. */
function firstDifference(left: unknown, right: unknown, path: string): string | null {
  if (JSON.stringify(left) === JSON.stringify(right)) return null;
  const bothObjects =
    left !== null && right !== null && typeof left === 'object' && typeof right === 'object';
  if (bothObjects && Array.isArray(left) === Array.isArray(right)) {
    const a = left as Record<string, unknown>;
    const b = right as Record<string, unknown>;
    if (Array.isArray(left) && (left as unknown[]).length !== (right as unknown[]).length) {
      return `${path}: ${(left as unknown[]).length} built, ${(right as unknown[]).length} in the inventory`;
    }
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const found = firstDifference(a[key], b[key], `${path}.${key}`);
      if (found) return found;
    }
    return `${path}: key order`;
  }
  const show = (value: unknown) => (value === undefined ? 'absent' : JSON.stringify(value).slice(0, 300));
  return `${path}: built ${show(left)}, inventory ${show(right)}`;
}
