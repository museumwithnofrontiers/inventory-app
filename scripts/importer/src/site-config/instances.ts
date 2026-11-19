/**
 * Writing the site configuration into the instance files
 * (`scripts/exporters/instances/*.json`), one copy per collection:
 * - a collection with an instance file of its own (a gallery, an exhibition,
 *   a mini-site) goes there;
 * - any other goes to the site that holds its records: thematic galleries to
 *   galleries.json, Explore to explore.json, Sharing History to
 *   sharinghistory.json, mwnf3 exhibitions to their project's site.
 * A collection no rule places fails the command, naming it.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SiteConfigRecord } from './types.js';

interface InstanceFile {
  path: string;
  slug: string;
  data: Record<string, unknown>;
}

/** The legacy key prefixes of collections with no instance file of their own, and their site. */
const SITE_BY_KEY_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ['mwnf3_thematic_gallery:', 'galleries'],
  ['mwnf3_explore:', 'explore'],
  ['mwnf3_sharing_history:', 'sharinghistory'],
];

/** An mwnf3 exhibition's site, by its legacy project. */
const SITE_BY_MWNF3_PROJECT: Record<string, string> = {
  ISL: 'islamicart',
  BAR: 'baroqueart',
};

export function readInstanceFiles(directory: string): InstanceFile[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const path = join(directory, name);
      return {
        path,
        slug: name.replace(/\.json$/, ''),
        data: JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>,
      };
    });
}

/**
 * The slug of the instance file each collection goes to.
 *
 * @param keys collection uuid → its legacy key
 */
export function routeRecords(
  records: Map<string, SiteConfigRecord>,
  keys: Map<string, string>,
  files: InstanceFile[]
): { bySlug: Map<string, Map<string, SiteConfigRecord>>; unrouted: string[] } {
  const ownFile = new Map<string, string>();
  for (const file of files) {
    const id = file.data['collection_id'];
    if (typeof id === 'string') ownFile.set(id, file.slug);
  }
  const slugs = new Set(files.map((file) => file.slug));
  const bySlug = new Map<string, Map<string, SiteConfigRecord>>();
  const unrouted: string[] = [];
  for (const [uuid, record] of records) {
    const key = keys.get(uuid) ?? '';
    let slug = ownFile.get(uuid);
    if (!slug) slug = SITE_BY_KEY_PREFIX.find(([prefix]) => key.startsWith(prefix))?.[1];
    if (!slug && key.startsWith('mwnf3:exhibitions:')) {
      const project = (record.translation_extra?.['legacy_exhibition'] as Record<string, unknown> | undefined)?.[
        'project_id'
      ];
      slug = typeof project === 'string' ? SITE_BY_MWNF3_PROJECT[project.toUpperCase()] : undefined;
    }
    if (!slug || !slugs.has(slug)) {
      unrouted.push(`${uuid} (${key})`);
      continue;
    }
    const map = bySlug.get(slug) ?? new Map<string, SiteConfigRecord>();
    map.set(uuid, record);
    bySlug.set(slug, map);
  }
  return { bySlug, unrouted };
}

/** The marker the command writes before a file's `collections`, always its last member. */
const COLLECTIONS_MEMBER = ',\n  "collections": ';

/**
 * The file's text with its `collections` replaced (sorted by uuid), or
 * removed when it has none. The rest of the file is left as written: the
 * command only ever appends `collections` as the last member.
 */
export function withCollections(text: string, records: Map<string, SiteConfigRecord> | undefined): string {
  const at = text.indexOf(COLLECTIONS_MEMBER);
  const head = (at >= 0 ? text.slice(0, at) : text.replace(/\s*\}\s*$/, '')).replace(/\s+$/, '');
  if (!records || records.size === 0) return `${head}\n}\n`;
  const sorted = Object.fromEntries([...records].sort(([a], [b]) => a.localeCompare(b)));
  const body = JSON.stringify(sorted, null, 2).replace(/\n/g, '\n  ');
  return `${head}${COLLECTIONS_MEMBER}${body}\n}\n`;
}

/**
 * Writes each file's `collections` (removed from a file that has none).
 * Returns the slugs whose file changed.
 */
export function writeInstanceFiles(
  files: InstanceFile[],
  bySlug: Map<string, Map<string, SiteConfigRecord>>
): string[] {
  const changed: string[] = [];
  for (const file of files) {
    const before = readFileSync(file.path, 'utf8');
    const after = withCollections(before, bySlug.get(file.slug));
    if (after !== before) {
      writeFileSync(file.path, after);
      changed.push(file.slug);
    }
  }
  return changed;
}
