/**
 * Unit tests for ThgHiddenMuseumImporter (gap E6).
 *
 * exhibition_hidden_mwnf3_museums and exhibition_hidden_mwnf3_institutions
 * (MWNF-655) list the partners the curators suppressed from an exhibition's
 * partner pages. Partner lists are derived from membership at export time, so
 * without these exclusions a rebuilt site would show partners that legacy
 * deliberately hides.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThgHiddenMuseumImporter } from '../../src/importers/phase-10/thg-hidden-museum-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

describe('ThgHiddenMuseumImporter', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let queryMock: ReturnType<typeof vi.fn>;
  let getCollectionExtraMock: ReturnType<typeof vi.fn>;
  let setCollectionExtraMock: ReturnType<typeof vi.fn>;

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
    tracker.set('mwnf3_thematic_gallery:thg_gallery:54', 'collection-54', 'collection');
    tracker.set('mwnf3_thematic_gallery:thg_gallery:56', 'collection-56', 'collection');
    tracker.set('mwnf3:museums:Mus52:uk', 'partner-mus52-uk', 'partner');
    tracker.set('mwnf3:museums:Mus21:us', 'partner-mus21-us', 'partner');
    tracker.set('mwnf3:museums:Mus81:dz', 'partner-mus81-dz', 'partner');
    tracker.set('mwnf3:institutions:Mon01:es', 'partner-mon01-es', 'partner');

    queryMock = vi.fn(async (sql: string) =>
      sql.includes('exhibition_hidden_mwnf3_institutions')
        ? [{ gallery_id: 56, partner_id: 'Mon01', country_id: 'es' }]
        : [
            { gallery_id: 54, partner_id: 'Mus52', country_id: 'uk' },
            { gallery_id: 54, partner_id: 'Mus21', country_id: 'us' },
            { gallery_id: 56, partner_id: 'Mus81', country_id: 'dz' },
          ]
    );

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    getCollectionExtraMock = vi.fn().mockResolvedValue(null);
    setCollectionExtraMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      getCollectionExtra: getCollectionExtraMock,
      setCollectionExtra: setCollectionExtraMock,
    } as unknown as IWriteStrategy;

    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  it('stores one exclusion list per exhibition, resolved to partners', async () => {
    const importer = new ThgHiddenMuseumImporter(context);
    const result = await importer.import();

    expect(result.imported).toBe(4);
    expect(setCollectionExtraMock).toHaveBeenCalledTimes(2);

    const written = Object.fromEntries(
      setCollectionExtraMock.mock.calls.map((call: unknown[]) => [
        call[0] as string,
        JSON.parse(call[1] as string) as Record<string, Record<string, unknown>>,
      ])
    );

    expect(written['collection-54'].thg_gallery.hidden_partners).toEqual([
      { backward_compatibility: 'mwnf3:museums:Mus52:uk', partner_id: 'partner-mus52-uk' },
      { backward_compatibility: 'mwnf3:museums:Mus21:us', partner_id: 'partner-mus21-us' },
    ]);
    // One list per exhibition: its hidden institutions follow its hidden museums.
    expect(written['collection-56'].thg_gallery.hidden_partners).toEqual([
      { backward_compatibility: 'mwnf3:museums:Mus81:dz', partner_id: 'partner-mus81-dz' },
      { backward_compatibility: 'mwnf3:institutions:Mon01:es', partner_id: 'partner-mon01-es' },
    ]);
  });

  it('preserves the gallery anchor already stored in extra', async () => {
    getCollectionExtraMock.mockResolvedValue({
      thg_gallery: { mwnf3_project_id: 'EXAID', slug: 'arts_in_dialogue' },
    });

    const importer = new ThgHiddenMuseumImporter(context);
    await importer.import();

    const extra = JSON.parse(setCollectionExtraMock.mock.calls[0][1] as string) as Record<
      string,
      Record<string, unknown>
    >;

    expect(extra.thg_gallery.slug).toBe('arts_in_dialogue');
    expect(extra.thg_gallery.hidden_partners).toBeDefined();
  });

  it('keeps an exclusion whose partner never resolved', async () => {
    queryMock.mockImplementation(async (sql: string) =>
      sql.includes('exhibition_hidden_mwnf3_institutions')
        ? [{ gallery_id: 54, partner_id: 'Mon99', country_id: 'zz' }]
        : [{ gallery_id: 54, partner_id: 'Mus99', country_id: 'zz' }]
    );

    const importer = new ThgHiddenMuseumImporter(context);
    const result = await importer.import();

    const extra = JSON.parse(setCollectionExtraMock.mock.calls[0][1] as string) as Record<
      string,
      Record<string, unknown>
    >;

    expect(extra.thg_gallery.hidden_partners).toEqual([
      { backward_compatibility: 'mwnf3:museums:Mus99:zz', partner_id: null },
      { backward_compatibility: 'mwnf3:institutions:Mon99:zz', partner_id: null },
    ]);
    expect(result.warnings).toEqual([
      expect.stringContaining('mwnf3:museums:Mus99:zz'),
      expect.stringContaining('mwnf3:institutions:Mon99:zz'),
    ]);
  });

  it('warns and skips a gallery whose collection is missing', async () => {
    tracker = new UnifiedTracker();
    context = { ...context, tracker };

    const importer = new ThgHiddenMuseumImporter(context);
    const result = await importer.import();

    expect(setCollectionExtraMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(4);
  });

  it('reads the mwnf3 hidden-museum and hidden-institution tables only', async () => {
    const importer = new ThgHiddenMuseumImporter(context);
    await importer.import();

    const sql = queryMock.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(sql).toHaveLength(2);
    expect(sql[0]).toContain('exhibition_hidden_mwnf3_museums');
    expect(sql[1]).toContain('exhibition_hidden_mwnf3_institutions');
    expect(sql.join('\n')).not.toContain('exhibition_hidden_sh_museums');
  });

  it('still imports the hidden museums from a legacy copy without the institutions table', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('exhibition_hidden_mwnf3_institutions')) {
        throw new Error(
          "Table 'mwnf3_thematic_gallery.exhibition_hidden_mwnf3_institutions' doesn't exist"
        );
      }
      return [{ gallery_id: 56, partner_id: 'Mus81', country_id: 'dz' }];
    });

    const importer = new ThgHiddenMuseumImporter(context);
    const result = await importer.import();

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.warnings).toEqual([
      expect.stringContaining('exhibition_hidden_mwnf3_institutions'),
    ]);
    const extra = JSON.parse(setCollectionExtraMock.mock.calls[0][1] as string) as Record<
      string,
      Record<string, unknown>
    >;
    expect(extra.thg_gallery.hidden_partners).toEqual([
      { backward_compatibility: 'mwnf3:museums:Mus81:dz', partner_id: 'partner-mus81-dz' },
    ]);
  });

  it('writes nothing in dry-run mode', async () => {
    context.dryRun = true;

    const importer = new ThgHiddenMuseumImporter(context);
    await importer.import();

    expect(setCollectionExtraMock).not.toHaveBeenCalled();
  });
});
