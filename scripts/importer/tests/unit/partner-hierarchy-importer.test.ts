import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import { PartnerHierarchyImporter } from '../../src/importers/phase-01/partner-hierarchy-importer.js';

describe('PartnerHierarchyImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let attachPartnerToCollectionWithLevelMock: ReturnType<typeof vi.fn>;
  let findByBackwardCompatibilityMock: ReturnType<typeof vi.fn>;

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

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('mwnf3:museums:Mus01:jo', 'partner-uuid', 'partner');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM mwnf3.associated_museums')) {
        return [];
      }

      if (sql.includes('FROM mwnf3.partner_museums')) {
        return [];
      }

      if (sql.includes('FROM mwnf3.further_associated_museums')) {
        return [];
      }

      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    attachPartnerToCollectionWithLevelMock = vi.fn().mockResolvedValue(undefined);
    findByBackwardCompatibilityMock = vi.fn().mockResolvedValue(null);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: findByBackwardCompatibilityMock,
      attachPartnerToCollectionWithLevel: attachPartnerToCollectionWithLevelMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it("takes a missing associated_museums project_id from the museum's own row (M16 G3 #2699)", async () => {
    tracker.set('mwnf3:projects:ISL', 'isl-collection-uuid', 'collection');
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.associated_museums')) {
        return [
          {
            associated_id: 3,
            partner_id: null,
            project_id: null,
            museum_id: 'Mus01',
            country_id: 'jo',
            museum_project_id: 'ISL',
          },
        ];
      }

      return [];
    });

    const importer = new PartnerHierarchyImporter(context);
    const result = await importer.import();

    expect(attachPartnerToCollectionWithLevelMock).toHaveBeenCalledWith(
      'isl-collection-uuid',
      'partner-uuid',
      'project',
      'associated_partner'
    );
    expect(logger.warning).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it('joins the museum row to read its project', async () => {
    await new PartnerHierarchyImporter(context).import();

    const sql = queryMock.mock.calls
      .map((args: unknown[]) => args[0] as string)
      .find((query: string) => query.includes('FROM mwnf3.associated_museums'))!;
    expect(sql).toContain('LEFT JOIN mwnf3.museums m ON m.museum_id = a.museum_id AND m.country = a.country_id');
    expect(sql).toContain('m.project_id AS museum_project_id');
  });

  it("keeps explicit associated_museums project_id values unchanged, over the museum's", async () => {
    tracker.set('mwnf3:projects:ABC', 'abc-collection-uuid', 'collection');
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.associated_museums')) {
        return [
          {
            associated_id: 4,
            partner_id: 12,
            project_id: 'ABC',
            museum_id: 'Mus01',
            country_id: 'jo',
            museum_project_id: 'ISL',
          },
        ];
      }

      return [];
    });

    const importer = new PartnerHierarchyImporter(context);
    const result = await importer.import();

    expect(attachPartnerToCollectionWithLevelMock).toHaveBeenCalledWith(
      'abc-collection-uuid',
      'partner-uuid',
      'project',
      'associated_partner'
    );
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it('skips the row, reported, when neither it nor its museum has a project; no project is assumed', async () => {
    tracker.set('mwnf3:projects:ISL', 'isl-collection-uuid', 'collection');
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM mwnf3.associated_museums')) {
        return [
          {
            associated_id: 5,
            partner_id: null,
            project_id: null,
            museum_id: 'Mus01',
            country_id: 'jo',
            museum_project_id: null,
          },
        ];
      }

      return [];
    });

    const importer = new PartnerHierarchyImporter(context);
    const result = await importer.import();

    expect(attachPartnerToCollectionWithLevelMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.warnings).toEqual([
      'associated_museums id=5 has no project_id, and museum Mus01:jo has none either; skipped',
    ]);
  });
});
