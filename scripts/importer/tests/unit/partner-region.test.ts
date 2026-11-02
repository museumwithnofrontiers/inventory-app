import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import type { PartnerTranslationData } from '../../src/core/types.js';
import { PartnerImporter } from '../../src/importers/phase-01/partner-importer.js';
import { transformSchoolTranslation } from '../../src/domain/transformers/school-transformer.js';

/**
 * A partner's region (`region_id` → `mwnf3.regionnames`): legacy's Baroque
 * Art partner lists head a country's partners with it ("Italy / Bologna"), in
 * the page's language. Each partner translation keeps the name in its own
 * language as `extra.region`; legacy names regions in English only, so the
 * other languages get none.
 */
describe('partner region', () => {
  let context: ImportContext;
  let writeTranslationMock: ReturnType<typeof vi.fn>;

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

  const rows: Record<string, unknown[]> = {
    'FROM mwnf3.museums ': [
      {
        museum_id: 'Mus01',
        country: 'it',
        name: 'Galleria Borghese',
        project_id: 'BAR',
        region_id: 'it_vb',
      },
      { museum_id: 'Mus02', country: 'it', name: 'Museo Civico', project_id: 'BAR' },
    ],
    'FROM mwnf3.museumnames': [
      { museum_id: 'Mus01', country: 'it', lang: 'en', name: 'Borghese Gallery' },
      { museum_id: 'Mus01', country: 'it', lang: 'it', name: 'Galleria Borghese' },
      { museum_id: 'Mus02', country: 'it', lang: 'en', name: 'Civic Museum' },
    ],
    'FROM mwnf3.institutions ': [
      { institution_id: 'Ins01', country: 'it', name: 'Soprintendenza', region_id: 'it_ro' },
    ],
    'FROM mwnf3.institutionnames': [
      { institution_id: 'Ins01', country: 'it', lang: 'en', name: 'Superintendency' },
    ],
    'FROM mwnf3.regionnames': [
      { region: 'it_vb', lang: 'en', name: 'Villa Borghese' },
      { region: 'it_ro', lang: 'en', name: 'Rome ' },
    ],
  };

  const extras = () =>
    writeTranslationMock.mock.calls.map((call) => {
      const data = call[0] as PartnerTranslationData;
      return [data.name, data.extra ? JSON.parse(data.extra).region : undefined];
    });

  beforeEach(() => {
    vi.clearAllMocks();

    const tracker = new UnifiedTracker();
    tracker.setMetadata('default_context_id', 'context-uuid');

    writeTranslationMock = vi.fn().mockResolvedValue(undefined);

    context = {
      legacyDb: {
        query: vi.fn(async (sql: string) => {
          const key = Object.keys(rows).find((from) => `${sql} `.includes(from));
          return key ? rows[key] : [];
        }),
        execute: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as ILegacyDatabase,
      strategy: {
        exists: vi.fn().mockResolvedValue(false),
        findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
        writePartner: vi.fn().mockResolvedValue('partner-uuid'),
        writePartnerTranslation: writeTranslationMock,
      } as unknown as IWriteStrategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it("puts the region's name in the translation of the same language", async () => {
    await new PartnerImporter(context).import();

    expect(extras()).toEqual([
      ['Borghese Gallery', 'Villa Borghese'],
      ['Galleria Borghese', undefined],
      ['Civic Museum', undefined],
      ['Superintendency', 'Rome'],
    ]);
  });

  it('keeps the region id next to the name', async () => {
    await new PartnerImporter(context).import();

    const extra = JSON.parse(
      (writeTranslationMock.mock.calls[1][0] as PartnerTranslationData).extra!
    );
    expect(extra.region_id).toBe('it_vb');
    expect(extra.region).toBeUndefined();
  });

  it('carries a school region the same way', () => {
    const { data } = transformSchoolTranslation(
      { school_id: 'sch01', country: 'it', name: 'Liceo', project_id: 'BAR', region_id: 'it_bo' },
      { school_id: 'sch01', country: 'it', lang: 'en', name: 'High School' },
      'Bologna'
    );

    expect(JSON.parse(data.extra!).region).toBe('Bologna');
  });
});
