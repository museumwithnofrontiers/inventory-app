/**
 * Collecting the site configuration the importers build (see types.ts):
 * merging their entries per collection, in MySQL's JSON key order, and the
 * context the builders run in, which reads the legacy database and nothing
 * else.
 */

import { deterministicUuid } from '../utils/deterministic-uuid.js';
import { LANGUAGE_CODE_MAP } from '../utils/code-mappings.js';
import { sanitizeJsonField } from '../utils/html-to-markdown.js';
import type { SiteConfigEntry, SiteConfigRecord } from './types.js';

/** The uuid the importer gives a collection with this legacy key. */
export function collectionUuid(backwardCompatibility: string): string {
  return deterministicUuid(`collection:${backwardCompatibility.toLowerCase()}`);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The value with every object's keys in MySQL's JSON order (shorter keys
 * first, then by their UTF-8 bytes), as a JSON column stores them, so an
 * instance file reads as the inventory did.
 */
export function mysqlJsonOrdered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mysqlJsonOrdered);
  if (!isObject(value)) return value;
  const keys = Object.keys(value).sort((a, b) => {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    return left.length - right.length || Buffer.compare(left, right);
  });
  return Object.fromEntries(keys.map((key) => [key, mysqlJsonOrdered(value[key])]));
}

/**
 * A block as the inventory stored it: serialized as JSON (a legacy DATE
 * becomes its ISO string) and sanitized as every `extra` write is (HTML to
 * Markdown), so an instance file holds what the packages shipped.
 */
export function asStored(value: Record<string, unknown>): Record<string, unknown> {
  return sanitizeJsonField(JSON.parse(JSON.stringify(value)) as Record<string, unknown>);
}

/** One key's merge: objects merge key by key (two builders share `thg_gallery`), anything else is replaced. */
function mergeKeys(
  into: Record<string, unknown> | undefined,
  from: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!from) return into;
  const out: Record<string, unknown> = { ...(into ?? {}) };
  for (const [key, value] of Object.entries(from)) {
    out[key] = isObject(out[key]) && isObject(value) ? { ...out[key], ...value } : value;
  }
  return out;
}

/** The entries of every builder, as one record per collection uuid. */
export function mergeEntries(entries: SiteConfigEntry[]): Map<string, SiteConfigRecord> {
  const records = new Map<string, SiteConfigRecord>();
  for (const entry of entries) {
    const uuid = collectionUuid(entry.collection);
    const record = records.get(uuid) ?? {};
    record.extra = mergeKeys(record.extra, entry.extra);
    record.translation_extra = mergeKeys(record.translation_extra, entry.translationExtra);
    for (const [language, keys] of Object.entries(entry.translations ?? {})) {
      record.translations ??= {};
      record.translations[language] = mergeKeys(record.translations[language], keys)!;
    }
    records.set(uuid, record);
  }
  for (const [uuid, record] of records) {
    const ordered: SiteConfigRecord = {};
    if (record.extra && Object.keys(record.extra).length > 0) {
      ordered.extra = mysqlJsonOrdered(asStored(record.extra)) as Record<string, unknown>;
    }
    if (record.translation_extra && Object.keys(record.translation_extra).length > 0) {
      ordered.translation_extra = mysqlJsonOrdered(asStored(record.translation_extra)) as Record<string, unknown>;
    }
    if (record.translations && Object.keys(record.translations).length > 0) {
      const languages = Object.keys(record.translations).sort();
      ordered.translations = Object.fromEntries(
        languages.map((language) => [
          language,
          mysqlJsonOrdered(asStored(record.translations![language]!)) as Record<string, unknown>,
        ])
      );
    }
    records.set(uuid, ordered);
  }
  return records;
}

/** The tables whose uuid the importer derives from the legacy key, and the name prefix it uses. */
const DETERMINISTIC_TABLES: Record<string, string> = {
  collections: 'collection',
  contexts: 'context',
  partners: 'partner',
  items: 'item',
  projects: 'project',
  publications: 'publication',
};

/**
 * The write strategy the builders run with: lookups answer from the legacy
 * key alone (a language through the importer's code map, an entity through
 * the uuid the importer derives from its key); any write fails, as the
 * builders only read legacy.
 */
export function legacyOnlyStrategy(): unknown {
  const lookups: Record<string, (...args: unknown[]) => unknown> = {
    findByBackwardCompatibility: async (table: unknown, key: unknown) => {
      if (typeof key !== 'string') return null;
      if (table === 'languages') return LANGUAGE_CODE_MAP[key] ?? null;
      const prefix = typeof table === 'string' ? DETERMINISTIC_TABLES[table] : undefined;
      return prefix ? deterministicUuid(`${prefix}:${key.toLowerCase()}`) : null;
    },
    exists: async () => false,
  };
  return new Proxy(lookups, {
    get(target, property) {
      if (typeof property === 'string' && property in target) return target[property];
      return () => {
        throw new Error(`site-config: the builders read legacy only (${String(property)} called)`);
      };
    },
  });
}
