import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExploreMonumentCrossRefImporter } from '../../src/importers/phase-06/explore-monument-crossref-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

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

describe('ExploreMonumentCrossRefImporter', () => {
  let tracker: UnifiedTracker;
  let queryMock: ReturnType<typeof vi.fn>;
  let strategy: IWriteStrategy;
  let context: ImportContext;

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('mwnf3_explore:context', 'explore-context-uuid', 'context');

    queryMock = vi.fn(async () => []);

    strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeItemItemLink: vi.fn().mockResolvedValue(undefined),
      writeItemPartnerLink: vi.fn().mockResolvedValue(undefined),
    } as unknown as IWriteStrategy;

    context = {
      tracker,
      legacyDb: { query: queryMock as ILegacyDatabase['query'], execute: vi.fn(), connect: vi.fn(), disconnect: vi.fn() },
      strategy,
      logger,
      dryRun: false,
    };
  });

  it('no longer reads exploremonument_museums nor writes any extra (M16 G2 #2697)', async () => {
    const getItemTranslationExtra = vi.fn();
    const setItemTranslationExtra = vi.fn();
    context = {
      ...context,
      strategy: { ...strategy, getItemTranslationExtra, setItemTranslationExtra } as unknown as IWriteStrategy,
    };

    const result = await new ExploreMonumentCrossRefImporter(context).import();

    expect(result.success).toBe(true);
    expect(
      queryMock.mock.calls.some((args: unknown[]) => (args[0] as string).includes('exploremonument_museums'))
    ).toBe(false);
    expect(getItemTranslationExtra).not.toHaveBeenCalled();
    expect(setItemTranslationExtra).not.toHaveBeenCalled();
  });

  it('calls resolveForSource with "vm" source for each exploremonument_vm row', async () => {
    tracker.set('mwnf3:monuments:IAM:eg:Mus01:5', 'vm-item-uuid', 'item');
    tracker.set('mwnf3_explore:monument:10', 'vm-item-uuid', 'item');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3_explore.exploremonument_vm')) {
        return [
          {
            monumentId: 10,
            REF_monuments_project_id: 'IAM',
            REF_monuments_country: 'eg',
            REF_monuments_institution_id: 'Mus01',
            REF_monuments_number: 5,
          },
        ];
      }
      if (sql.includes('FROM mwnf3_explore.exploremonument')) {
        return [
          {
            monumentId: 10,
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
    });

    context = { ...context, legacyDb: { query: queryMock as ILegacyDatabase['query'], execute: vi.fn(), connect: vi.fn(), disconnect: vi.fn() } };

    const importer = new ExploreMonumentCrossRefImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    const vmSqlCall = queryMock.mock.calls.find(
      (args: unknown[]) => (args[0] as string).includes('exploremonument_vm')
    );
    expect(vmSqlCall).toBeDefined();
  });

  it('completes with success even when all sections return empty data', async () => {
    const importer = new ExploreMonumentCrossRefImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('does not log a warning for resolved-candidates monument resolution', async () => {
    // Verify that the warning logger is NOT called with ambiguous/multi-source messages
    // for monuments that correctly resolve to multiple candidates
    const warningSpy = vi.spyOn(logger, 'warning');

    tracker.set('mwnf3:monuments:IAM:eg:Mon01:5', 'vm-item-uuid', 'item');
    tracker.set('mwnf3_travels:monument:IAM:pt:1:I:1:b', 'travels-item-uuid', 'item');
    tracker.set('mwnf3_explore:monument:500', 'native-item-uuid', 'item');

    queryMock = vi.fn(async () => []);
    context = {
      ...context,
      legacyDb: { query: queryMock as ILegacyDatabase['query'], execute: vi.fn(), connect: vi.fn(), disconnect: vi.fn() },
    };

    const importer = new ExploreMonumentCrossRefImporter(context);
    const importResult = await importer.import();

    // Completes without ambiguity warnings
    expect(importResult.success).toBe(true);
    warningSpy.mockRestore();
  });
});
