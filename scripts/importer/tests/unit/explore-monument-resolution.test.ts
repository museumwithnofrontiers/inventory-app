import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ILegacyDatabase } from '../../src/core/base-importer.js';
import { ExploreMonumentResolver } from '../../src/importers/phase-06/explore-monument-resolver.js';

describe('ExploreMonumentResolver', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let queryMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tracker = new UnifiedTracker();

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_explore.exploremonument_vm')) {
        return [
          {
            monumentId: 200,
            REF_monuments_project_id: 'IAM',
            REF_monuments_country: 'eg',
            REF_monuments_institution_id: 'Mus01',
            REF_monuments_number: 5,
          },
          {
            monumentId: 500,
            REF_monuments_project_id: 'IAM',
            REF_monuments_country: 'eg',
            REF_monuments_institution_id: 'Mus01',
            REF_monuments_number: 7,
          },
        ];
      }

      if (sql.includes('FROM mwnf3_explore.exploremonument_tr')) {
        return [
          {
            monumentId: 300,
            REF_tr_monuments_project_id: 'IAM',
            REF_tr_monuments_country: 'pt',
            REF_tr_monuments_itinerary_id: 'I',
            REF_tr_monuments_location_id: '1',
            REF_tr_monuments_number: 'b',
            REF_tr_monuments_trail_id: 1,
          },
          {
            monumentId: 500,
            REF_tr_monuments_project_id: 'IAM',
            REF_tr_monuments_country: 'pt',
            REF_tr_monuments_itinerary_id: 'I',
            REF_tr_monuments_location_id: '1',
            REF_tr_monuments_number: 'c',
            REF_tr_monuments_trail_id: 1,
          },
        ];
      }

      if (sql.includes('FROM mwnf3_explore.exploremonument_sh')) {
        return [
          {
            monumentId: 400,
            project_id: 'AWE',
            country: 'pt',
            number: 9,
          },
        ];
      }

      if (sql.includes('FROM mwnf3_explore.exploremonument')) {
        return [
          {
            monumentId: 100,
            REF_tr_monuments_project_id: null,
            REF_tr_monuments_country: null,
            REF_tr_monuments_itinerary_id: null,
            REF_tr_monuments_location_id: null,
            REF_tr_monuments_number: null,
            REF_tr_monuments_lang: null,
            REF_tr_monuments_trail_id: null,
            REF_monuments_project_id: null,
            REF_monuments_country: null,
            REF_monuments_institution_id: null,
            REF_monuments_number: null,
            REF_monuments_lang: null,
          },
          {
            monumentId: 200,
            REF_tr_monuments_project_id: null,
            REF_tr_monuments_country: null,
            REF_tr_monuments_itinerary_id: null,
            REF_tr_monuments_location_id: null,
            REF_tr_monuments_number: null,
            REF_tr_monuments_lang: null,
            REF_tr_monuments_trail_id: null,
            REF_monuments_project_id: null,
            REF_monuments_country: null,
            REF_monuments_institution_id: null,
            REF_monuments_number: null,
            REF_monuments_lang: null,
          },
          {
            monumentId: 300,
            REF_tr_monuments_project_id: null,
            REF_tr_monuments_country: null,
            REF_tr_monuments_itinerary_id: null,
            REF_tr_monuments_location_id: null,
            REF_tr_monuments_number: null,
            REF_tr_monuments_lang: null,
            REF_tr_monuments_trail_id: null,
            REF_monuments_project_id: null,
            REF_monuments_country: null,
            REF_monuments_institution_id: null,
            REF_monuments_number: null,
            REF_monuments_lang: null,
          },
          {
            monumentId: 400,
            REF_tr_monuments_project_id: null,
            REF_tr_monuments_country: null,
            REF_tr_monuments_itinerary_id: null,
            REF_tr_monuments_location_id: null,
            REF_tr_monuments_number: null,
            REF_tr_monuments_lang: null,
            REF_tr_monuments_trail_id: null,
            REF_monuments_project_id: null,
            REF_monuments_country: null,
            REF_monuments_institution_id: null,
            REF_monuments_number: null,
            REF_monuments_lang: null,
          },
          {
            monumentId: 500,
            REF_tr_monuments_project_id: null,
            REF_tr_monuments_country: null,
            REF_tr_monuments_itinerary_id: null,
            REF_tr_monuments_location_id: null,
            REF_tr_monuments_number: null,
            REF_tr_monuments_lang: null,
            REF_tr_monuments_trail_id: null,
            REF_monuments_project_id: null,
            REF_monuments_country: null,
            REF_monuments_institution_id: null,
            REF_monuments_number: null,
            REF_monuments_lang: null,
          },
          {
            monumentId: 600,
            REF_tr_monuments_project_id: null,
            REF_tr_monuments_country: null,
            REF_tr_monuments_itinerary_id: null,
            REF_tr_monuments_location_id: null,
            REF_tr_monuments_number: null,
            REF_tr_monuments_lang: null,
            REF_tr_monuments_trail_id: null,
            REF_monuments_project_id: 'IAM',
            REF_monuments_country: 'eg',
            REF_monuments_institution_id: 'Mus01',
            REF_monuments_number: 8,
            REF_monuments_lang: 'en',
            REF_tr_monuments_exists: 0,
            REF_monuments_exists: 1,
          },
          {
            // A direct reference to a record legacy doesn't have.
            monumentId: 800,
            REF_tr_monuments_project_id: null,
            REF_tr_monuments_country: null,
            REF_tr_monuments_itinerary_id: null,
            REF_tr_monuments_location_id: null,
            REF_tr_monuments_number: null,
            REF_tr_monuments_lang: null,
            REF_tr_monuments_trail_id: null,
            REF_monuments_project_id: 'EXHCOLOUR',
            REF_monuments_country: 'at',
            REF_monuments_institution_id: 'Mon11',
            REF_monuments_number: 2,
            REF_monuments_lang: 'en',
            REF_tr_monuments_exists: 0,
            REF_monuments_exists: 0,
          },
        ];
      }

      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    tracker.set('mwnf3:monuments:IAM:eg:Mus01:5', 'vm-item-uuid', 'item');
    tracker.set('mwnf3_travels:monument:IAM:pt:1:I:1:b', 'travels-item-uuid', 'item');
    tracker.set('mwnf3_sharing_history:sh_monuments:awe:pt:9', 'sh-item-uuid', 'item');
    tracker.set('mwnf3:monuments:IAM:eg:Mus01:7', 'vm-ambiguous-item-uuid', 'item');
    tracker.set('mwnf3_travels:monument:IAM:pt:1:I:1:c', 'travels-ambiguous-item-uuid', 'item');
    tracker.set('mwnf3:monuments:IAM:eg:Mus01:8', 'vm-direct-item-uuid', 'item');
  });

  it('resolves native, referenced, missing-target, and ambiguous monuments from verified link tables', async () => {
    const resolver = new ExploreMonumentResolver({
      legacyDb,
      tracker,
      getEntityUuid: async (backwardCompatibility, entityType) =>
        tracker.getUuid(backwardCompatibility, entityType),
    });

    await expect(resolver.resolve(100)).resolves.toMatchObject({
      mode: 'native',
      itemBackwardCompatibility: 'mwnf3_explore:monument:100',
    });

    await expect(resolver.resolve(200)).resolves.toMatchObject({
      mode: 'referenced',
      source: 'vm',
      itemBackwardCompatibility: 'mwnf3:monuments:IAM:eg:Mus01:5',
      itemId: 'vm-item-uuid',
    });

    await expect(resolver.resolve(300)).resolves.toMatchObject({
      mode: 'referenced',
      source: 'travels',
      itemBackwardCompatibility: 'mwnf3_travels:monument:IAM:pt:1:I:1:b',
      itemId: 'travels-item-uuid',
    });

    await expect(resolver.resolve(400)).resolves.toMatchObject({
      mode: 'referenced',
      source: 'sharing-history',
      itemBackwardCompatibility: 'mwnf3_sharing_history:sh_monuments:awe:pt:9',
      itemId: 'sh-item-uuid',
    });

    await expect(resolver.resolve(500)).resolves.toMatchObject({
      mode: 'resolvedCandidates',
      itemId: null,
      resolvedCandidates: expect.arrayContaining([
        expect.objectContaining({ source: 'vm', itemId: 'vm-ambiguous-item-uuid' }),
        expect.objectContaining({ source: 'travels', itemId: 'travels-ambiguous-item-uuid' }),
      ]),
    });

    await expect(resolver.resolve(600)).resolves.toMatchObject({
      mode: 'referenced',
      source: 'vm',
      itemBackwardCompatibility: 'mwnf3:monuments:IAM:eg:Mus01:8',
      itemId: 'vm-direct-item-uuid',
    });
  });

  it("serves a monument as Explore's own when its reference names a record legacy doesn't have", async () => {
    tracker.set('mwnf3_explore:monument:800', 'native-800-uuid', 'item');
    const resolver = new ExploreMonumentResolver({
      legacyDb,
      tracker,
      getEntityUuid: async (backwardCompatibility, entityType) =>
        tracker.getUuid(backwardCompatibility, entityType),
    });

    await expect(resolver.resolve(800)).resolves.toMatchObject({
      mode: 'native',
      itemBackwardCompatibility: 'mwnf3_explore:monument:800',
      itemId: 'native-800-uuid',
    });
    // The link tables are read the same way: only rows whose record legacy has.
    for (const table of ['exploremonument_vm', 'exploremonument_tr', 'exploremonument_sh']) {
      const sql = queryMock.mock.calls
        .map(([statement]) => String(statement))
        .find((statement) => statement.includes(`FROM mwnf3_explore.${table}`));
      expect(sql).toContain('WHERE EXISTS');
    }
  });

  it('reports missing targets explicitly when reference rows do not resolve to a source item', async () => {
    tracker = new UnifiedTracker();
    legacyDb = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM mwnf3_explore.exploremonument_vm')) {
          return [
            {
              monumentId: 700,
              REF_monuments_project_id: 'IAM',
              REF_monuments_country: 'eg',
              REF_monuments_institution_id: 'Mus01',
              REF_monuments_number: 99,
            },
          ];
        }

        if (sql.includes('FROM mwnf3_explore.exploremonument_tr')) {
          return [];
        }

        if (sql.includes('FROM mwnf3_explore.exploremonument_sh')) {
          return [];
        }

        if (sql.includes('FROM mwnf3_explore.exploremonument')) {
          return [
            {
              monumentId: 700,
              REF_tr_monuments_project_id: null,
              REF_tr_monuments_country: null,
              REF_tr_monuments_itinerary_id: null,
              REF_tr_monuments_location_id: null,
              REF_tr_monuments_number: null,
              REF_tr_monuments_lang: null,
              REF_tr_monuments_trail_id: null,
              REF_monuments_project_id: null,
              REF_monuments_country: null,
              REF_monuments_institution_id: null,
              REF_monuments_number: null,
              REF_monuments_lang: null,
            },
          ];
        }

        return [];
      }) as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    const resolver = new ExploreMonumentResolver({
      legacyDb,
      tracker,
      getEntityUuid: async () => null,
    });

    await expect(resolver.resolve(700)).resolves.toMatchObject({
      mode: 'missing-target',
      itemId: null,
    });
  });

  it('resolveForSource returns referenced when source matches a resolved candidate', async () => {
    const resolver = new ExploreMonumentResolver({
      legacyDb,
      tracker,
      getEntityUuid: async (backwardCompatibility, entityType) =>
        tracker.getUuid(backwardCompatibility, entityType),
    });

    await expect(resolver.resolveForSource(200, 'vm')).resolves.toMatchObject({
      mode: 'referenced',
      source: 'vm',
      itemBackwardCompatibility: 'mwnf3:monuments:IAM:eg:Mus01:5',
      itemId: 'vm-item-uuid',
    });
  });

  it('resolveForSource returns missing-target when requested source has no candidate', async () => {
    const resolver = new ExploreMonumentResolver({
      legacyDb,
      tracker,
      getEntityUuid: async (backwardCompatibility, entityType) =>
        tracker.getUuid(backwardCompatibility, entityType),
    });

    await expect(resolver.resolveForSource(200, 'travels')).resolves.toMatchObject({
      mode: 'missing-target',
      itemId: null,
      source: 'travels',
    });
  });

  it('resolveForSource returns native when monument has no candidates at all', async () => {
    tracker.set('mwnf3_explore:monument:100', 'native-item-uuid', 'item');
    const resolver = new ExploreMonumentResolver({
      legacyDb,
      tracker,
      getEntityUuid: async (backwardCompatibility, entityType) =>
        tracker.getUuid(backwardCompatibility, entityType),
    });

    await expect(resolver.resolveForSource(100, 'vm')).resolves.toMatchObject({
      mode: 'native',
      source: 'native',
      itemId: 'native-item-uuid',
    });
  });
});
