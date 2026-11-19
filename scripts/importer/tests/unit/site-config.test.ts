/**
 * The `site-config` command (M16 E4b, #2673): the site configuration is built
 * from legacy, merged per collection, routed to one instance file and written
 * there as its last member; `site-configuration-out` takes it out of `extra`.
 */

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { collectionUuid, mergeEntries } from '../../src/site-config/collect.js';
import {
  readInstanceFiles,
  routeRecords,
  withCollections,
} from '../../src/site-config/instances.js';
import {
  compareSiteConfiguration,
  localGalleryHosts,
  writeSiteConfiguration,
} from '../../src/site-config/run.js';
import type { SiteConfigRecord } from '../../src/site-config/types.js';
import {
  SiteConfigurationOutImporter,
  withoutSiteKeys,
} from '../../src/importers/phase-11/site-configuration-out-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

const GALLERY = 'mwnf3_thematic_gallery:thg_gallery:9';
const EXHIBITION = 'mwnf3:exhibitions:12';
const ITINERARY = 'mwnf3_explore:itinerary:3';

describe('mergeEntries', () => {
  it('merges the builders of one collection key by key, in MySQL JSON order', () => {
    const records = mergeEntries([
      {
        collection: GALLERY,
        extra: { thg_gallery: { slug: 'carpets', host: 'https://carpets.museumwnf.org' } },
      },
      { collection: GALLERY, extra: { thg_gallery: { hidden_partners: [] } } },
      { collection: GALLERY, translations: { eng: { thg_gallery_lang: { keywords: 'k' } } } },
    ]);
    const record = records.get(collectionUuid(GALLERY));
    expect(Object.keys(record?.extra?.['thg_gallery'] as object)).toEqual([
      'host',
      'slug',
      'hidden_partners',
    ]);
    expect(record?.translations).toEqual({ eng: { thg_gallery_lang: { keywords: 'k' } } });
    expect(record).not.toHaveProperty('translation_extra');
  });
});

describe('localGalleryHosts', () => {
  it('refuses a host that is no public https museumwnf address', () => {
    const records = new Map<string, SiteConfigRecord>([
      ['a', { extra: { thg_gallery: { host: 'https://carpets.museumwnf.org' } } }],
      ['b', { extra: { thg_gallery: { host: 'http://carpets.museumwnf.localhost' } } }],
      ['c', { extra: { logos: [] } }],
    ]);
    expect(localGalleryHosts(records, new Map([['b', GALLERY]]))).toEqual([
      `${GALLERY}: http://carpets.museumwnf.localhost`,
    ]);
  });
});

describe('routeRecords', () => {
  const files = [
    { path: 'carpets.json', slug: 'carpets', data: { collection_id: 'own' } },
    { path: 'galleries.json', slug: 'galleries', data: {} },
    { path: 'explore.json', slug: 'explore', data: {} },
    { path: 'islamicart.json', slug: 'islamicart', data: {} },
  ];

  it('places a collection in its own file, else by its legacy key or project', () => {
    const records = new Map<string, SiteConfigRecord>([
      ['own', { extra: { thg_gallery: {} } }],
      ['hub', { extra: { thg_gallery: {} } }],
      ['itinerary', { extra: { explore_itinerary: {} } }],
      ['exhibition', { translation_extra: { legacy_exhibition: { project_id: 'isl' } } }],
    ]);
    const keys = new Map([
      ['own', 'mwnf3_thematic_gallery:thg_gallery:9'],
      ['hub', 'mwnf3_thematic_gallery:thg_gallery:1'],
      ['itinerary', ITINERARY],
      ['exhibition', EXHIBITION],
    ]);
    const { bySlug, unrouted } = routeRecords(records, keys, files);
    expect(unrouted).toEqual([]);
    expect([...(bySlug.get('carpets')?.keys() ?? [])]).toEqual(['own']);
    expect([...(bySlug.get('galleries')?.keys() ?? [])]).toEqual(['hub']);
    expect([...(bySlug.get('explore')?.keys() ?? [])]).toEqual(['itinerary']);
    expect([...(bySlug.get('islamicart')?.keys() ?? [])]).toEqual(['exhibition']);
  });

  it('names a collection no rule places', () => {
    const records = new Map<string, SiteConfigRecord>([
      ['x', { translation_extra: { legacy_exhibition: {} } }],
    ]);
    const { unrouted } = routeRecords(records, new Map([['x', EXHIBITION]]), files);
    expect(unrouted).toEqual([`x (${EXHIBITION})`]);
  });
});

describe('withCollections', () => {
  const file = '{\n  "kind": "gallery",\n  "slug": "carpets"\n}\n';

  it('appends collections as the last member and leaves the rest as written', () => {
    const records = new Map<string, SiteConfigRecord>([
      ['b', { extra: { logos: [] } }],
      ['a', { extra: {} }],
    ]);
    const text = withCollections(file, records);
    expect(
      text.startsWith('{\n  "kind": "gallery",\n  "slug": "carpets",\n  "collections": {')
    ).toBe(true);
    expect(Object.keys(JSON.parse(text).collections)).toEqual(['a', 'b']);
  });

  it('replaces the member on a second run and removes it when there is none', () => {
    const once = withCollections(file, new Map([['a', { extra: { logos: [1] } }]]));
    const twice = withCollections(once, new Map([['a', { extra: { logos: [2] } }]]));
    expect(JSON.parse(twice).collections.a.extra.logos).toEqual([2]);
    expect(withCollections(twice, undefined)).toBe(file);
  });
});

describe('writeSiteConfiguration', () => {
  it('writes only the files whose collections changed', () => {
    const directory = mkdtempSync(join(tmpdir(), 'site-config-'));
    writeFileSync(join(directory, 'galleries.json'), '{\n  "slug": "galleries"\n}\n');
    writeFileSync(join(directory, 'explore.json'), '{\n  "slug": "explore"\n}\n');
    const uuid = collectionUuid(GALLERY);
    const result = {
      records: new Map<string, SiteConfigRecord>([
        [uuid, { extra: { thg_gallery: { slug: 'hub' } } }],
      ]),
      keys: new Map([[uuid, GALLERY]]),
    };
    expect(writeSiteConfiguration(result, directory)).toEqual(['galleries']);
    expect(writeSiteConfiguration(result, directory)).toEqual([]);
    expect(
      JSON.parse(readFileSync(join(directory, 'galleries.json'), 'utf8')).collections[uuid]
    ).toEqual({
      extra: { thg_gallery: { slug: 'hub' } },
    });
    expect(readInstanceFiles(directory).map((f) => f.slug)).toEqual(['explore', 'galleries']);
  });

  it('refuses a local copy of legacy before writing anything', () => {
    const uuid = collectionUuid(GALLERY);
    const result = {
      records: new Map<string, SiteConfigRecord>([
        [uuid, { extra: { thg_gallery: { host: 'http://x.localhost' } } }],
      ]),
      keys: new Map([[uuid, GALLERY]]),
    };
    expect(() => writeSiteConfiguration(result, '/nonexistent')).toThrow(/local copy of legacy/);
  });
});

describe('compareSiteConfiguration', () => {
  it('reports where the built and the held configuration first differ', () => {
    const built = new Map<string, SiteConfigRecord>([
      ['a', { extra: { thg_gallery: { slug: 'carpets' } } }],
      ['b', { extra: { logos: [] } }],
    ]);
    const held = new Map<string, SiteConfigRecord>([
      ['a', { extra: { thg_gallery: { slug: 'rugs' } } }],
      ['c', { extra: { logos: [] } }],
    ]);
    expect(compareSiteConfiguration(built, held, new Map([['a', GALLERY]]))).toEqual([
      `differs: a (${GALLERY}) extra.thg_gallery.slug: built "carpets", inventory "rugs"`,
      'only built: b (no legacy key built)',
      'only in the inventory: c (no legacy key built)',
    ]);
  });

  it('is empty when both hold the same values in another key order', () => {
    const built = new Map<string, SiteConfigRecord>([
      ['a', { extra: { thg_gallery: { slug: 's', host: 'h' } } }],
    ]);
    const held = new Map<string, SiteConfigRecord>([
      ['a', { extra: { thg_gallery: { host: 'h', slug: 's' } } }],
    ]);
    expect(compareSiteConfiguration(built, held, new Map())).toEqual([]);
  });
});

describe('SiteConfigurationOutImporter', () => {
  it('keeps the other keys of extra and nulls an extra left empty', () => {
    expect(withoutSiteKeys({ thg_gallery: {}, further_readings: [] }, ['thg_gallery'])).toEqual({
      further_readings: [],
    });
    expect(withoutSiteKeys({ logos: [] }, ['logos'])).toBeNull();
  });

  it('takes the site keys out of collections and their texts', async () => {
    const strategy = {
      findCollectionsWithExtraKeys: vi.fn().mockResolvedValue([
        { id: 'c1', extra: { thg_gallery: {}, further_readings: [1] } },
        { id: 'c2', extra: { logos: [] } },
      ]),
      findCollectionTranslationsWithExtraKeys: vi
        .fn()
        .mockResolvedValue([{ id: 't1', extra: { exhibition_i18n: {}, credits: 'x' } }]),
      setCollectionRelationColumnsAsStored: vi.fn().mockResolvedValue(undefined),
      setCollectionTranslationExtraAsStoredById: vi.fn().mockResolvedValue(undefined),
    };
    const logger: ILogger = {
      info: vi.fn(),
      warning: vi.fn(),
      skip: vi.fn(),
      error: vi.fn(),
      exception: vi.fn(),
      showProgress: vi.fn(),
      showSkipped: vi.fn(),
      showError: vi.fn(),
      showSummary: vi.fn(),
    };
    const context: ImportContext = {
      legacyDb: {} as ILegacyDatabase,
      strategy: strategy as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };

    const result = await new SiteConfigurationOutImporter(context).import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(3);
    expect(strategy.setCollectionRelationColumnsAsStored.mock.calls).toEqual([
      ['c1', {}, '{"further_readings":[1]}'],
      ['c2', {}, null],
    ]);
    expect(strategy.setCollectionTranslationExtraAsStoredById.mock.calls).toEqual([
      ['t1', '{"credits":"x"}'],
    ]);
  });
});
