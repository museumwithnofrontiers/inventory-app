import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollectionFlagsImporter } from '../../src/importers/phase-11/collection-flags-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import { planCollectionFlags, stripCollectionFlags } from '../../src/utils/collection-flags.js';

describe('planCollectionFlags', () => {
  it('reads the exhibition show flag', () => {
    expect(
      planCollectionFlags([
        { legacy_exhibition: { show: 'n', project_id: 'ISL' } },
        { legacy_exhibition: { show: 'n', project_id: 'ISL' } },
      ])
    ).toEqual({ columns: { visible: false }, problems: [] });
  });

  it("reads a gallery's featured flag (A: featured) and live date", () => {
    expect(
      planCollectionFlags([
        { thg_gallery: { featured: 'A', live_date: '2026-03-24T00:00:00.000Z', has_timeline: false } },
      ])
    ).toEqual({ columns: { featured: true, published_at: '2026-03-24' }, problems: [] });
  });

  it('reads an Explore theme status', () => {
    expect(planCollectionFlags([{ legacy_status: 'i' }]).columns).toEqual({ visible: false });
  });

  it('keeps the flags when the translations disagree or a value is unknown', () => {
    expect(
      planCollectionFlags([
        { thg_gallery: { featured: 'A', image: 'a' } },
        { thg_gallery: { featured: 'H', image: 'a' } },
      ]).problems
    ).toHaveLength(1);
    expect(planCollectionFlags([{ legacy_exhibition: { show: 'x', project_id: 'ISL' } }]).problems).toHaveLength(1);
    expect(planCollectionFlags([{ thg_gallery: { live_date: '2026-03-24T23:00:00.000Z', image: 'a' } }]).problems).toHaveLength(1);
  });

  it('leaves a flag that is all its block holds', () => {
    expect(planCollectionFlags([{ legacy_exhibition: { show: 'y' } }]).columns).toEqual({});
  });
});

describe('stripCollectionFlags', () => {
  it('drops the codes and the moved flags, keeping the rest', () => {
    expect(
      stripCollectionFlags(
        {
          introd_type: 'ET-short#-',
          et_title: 'IAM;ma;VI;en;1',
          showOnMonument: true,
          legacy_exhibition: { show: 'y', project_id: 'ISL' },
          thg_gallery: { featured: 'H', live_date: 'x', image: 'a.jpg' },
          duration: 'One day',
        },
        true
      )
    ).toEqual({
      legacy_exhibition: { project_id: 'ISL' },
      thg_gallery: { image: 'a.jpg' },
      duration: 'One day',
    });
  });

  it('drops only the codes when the flags stay', () => {
    expect(stripCollectionFlags({ hb_type: 'country', legacy_status: 'e' }, false)).toEqual({
      legacy_status: 'e',
    });
    expect(stripCollectionFlags({ hb_general_type: 'topic' }, false)).toBeNull();
  });
});

describe('CollectionFlagsImporter', () => {
  let context: ImportContext;
  let strategy: Record<string, ReturnType<typeof vi.fn>>;

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

  const legacyDb: ILegacyDatabase = {
    query: vi.fn().mockResolvedValue([]) as ILegacyDatabase['query'],
    execute: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const row = (id: string, collection: string, extra: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
    id,
    collection_id: collection,
    collection_backward_compatibility: 'mwnf3:exhibitions:1',
    collection_context_id: 'x1',
    language_id: 'eng',
    context_id: 'x1',
    extra,
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = {
      findCollectionTranslationsWithExtraKeys: vi.fn().mockResolvedValue([]),
      setCollectionFlags: vi.fn(),
      setCollectionTranslationExtraAsStoredById: vi.fn(),
    };
    context = {
      legacyDb,
      strategy: strategy as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun: false,
    };
  });

  it('sets the columns once per collection and strips each translation', async () => {
    strategy.findCollectionTranslationsWithExtraKeys!.mockResolvedValue([
      row('t1', 'c1', { legacy_exhibition: { show: 'n', project_id: 'ISL' } }),
      row('t2', 'c1', { legacy_exhibition: { show: 'n', project_id: 'ISL' } }, { language_id: 'fra' }),
    ]);

    const result = await new CollectionFlagsImporter(context).import();

    expect(result.success).toBe(true);
    expect(strategy.setCollectionFlags).toHaveBeenCalledTimes(1);
    expect(strategy.setCollectionFlags).toHaveBeenCalledWith('c1', { visible: false });
    expect(strategy.setCollectionTranslationExtraAsStoredById).toHaveBeenCalledWith(
      't1',
      JSON.stringify({ legacy_exhibition: { project_id: 'ISL' } })
    );
  });

  it("moves an Explore theme's status only from its English text in its own context", async () => {
    strategy.findCollectionTranslationsWithExtraKeys!.mockResolvedValue([
      row('t1', 'c1', { legacy_status: 'e' }, { collection_backward_compatibility: 'mwnf3_explore:thematiccycle:3' }),
      row('t2', 'c2', { legacy_status: 'e' }, { collection_backward_compatibility: 'mwnf3_explore:region:3' }),
    ]);

    const result = await new CollectionFlagsImporter(context).import();

    expect(strategy.setCollectionFlags).toHaveBeenCalledWith('c1', { visible: true });
    expect(strategy.setCollectionFlags).not.toHaveBeenCalledWith('c2', expect.anything());
    expect(result.errors).toHaveLength(1);
  });

  it('reports disagreeing translations, leaves their flags and drops the codes', async () => {
    strategy.findCollectionTranslationsWithExtraKeys!.mockResolvedValue([
      row('t1', 'c1', { legacy_exhibition: { show: 'n', project_id: 'ISL' }, introd_type: 'x' }),
      row('t2', 'c1', { legacy_exhibition: { show: 'y', project_id: 'ISL' } }),
    ]);

    const result = await new CollectionFlagsImporter(context).import();

    expect(result.success).toBe(false);
    expect(strategy.setCollectionFlags).not.toHaveBeenCalled();
    expect(strategy.setCollectionTranslationExtraAsStoredById).toHaveBeenCalledTimes(1);
    expect(strategy.setCollectionTranslationExtraAsStoredById).toHaveBeenCalledWith(
      't1',
      JSON.stringify({ legacy_exhibition: { show: 'n', project_id: 'ISL' } })
    );
  });
});
