import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShBibliographyHbImporter } from '../../src/importers/phase-03/sh-bibliography-hb-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';
import { compareGeneralCi, orderLikeLegacy } from '../../src/utils/legacy-collation.js';

// Legacy's bibliography page listed a list ordered by hand (sort_status 'Y')
// in its sort_order and any other — an item's always — by its text, in
// MySQL's utf8mb3_general_ci (class.br.inc.php). The importer keeps that
// order, so the websites show each list as it is.

describe('compareGeneralCi', () => {
  it('ignores case, accents and trailing spaces, then compares code points', () => {
    expect(compareGeneralCi('émile', 'Emile ')).toBe(0);
    expect(compareGeneralCi('Ramos', 'Reis')).toBeLessThan(0);
    expect(compareGeneralCi('<i>Guide</i>', 'Archive')).toBeLessThan(0);
    expect(['Various', 'costa', 'Reis', 'Ramos'].sort(compareGeneralCi)).toEqual([
      'costa',
      'Ramos',
      'Reis',
      'Various',
    ]);
  });

  it('keeps sort_order for a list ordered by hand', () => {
    const entries = [
      { sort_order: 2, text: 'A' },
      { sort_order: 1, text: 'B' },
    ];
    expect(orderLikeLegacy(entries, true).map((e) => e.text)).toEqual(['B', 'A']);
    expect(orderLikeLegacy(entries, false).map((e) => e.text)).toEqual(['A', 'B']);
  });
});

describe('ShBibliographyHbImporter bibliography order', () => {
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

  const bibliography = [
    { biblio_id: 1, original_title: '', lang: 'en', status: 'A' },
    { biblio_id: 2, original_title: '', lang: 'en', status: 'A' },
    { biblio_id: 3, original_title: '', lang: 'en', status: 'A' },
  ];
  const texts = [
    { biblio_id: 1, lang: 'en', desc: 'Various authors, <i>Datas</i>' },
    { biblio_id: 2, lang: 'en', desc: 'Costa, Leonor' },
    { biblio_id: 3, lang: 'en', desc: 'Ramos, Rui' },
  ];
  let exhibitionLinks: Array<Record<string, unknown>>;
  let itemExtra: Map<string, string>;
  let collectionExtra: Map<string, string>;
  let context: ImportContext;

  beforeEach(() => {
    vi.clearAllMocks();
    itemExtra = new Map();
    collectionExtra = new Map();

    const tracker = new UnifiedTracker();
    tracker.setMetadata('default_language_id', 'eng');
    tracker.set('en', 'eng', 'language');
    tracker.set('mwnf3_sharing_history:sh_objects:awe:pt:1', 'item-uuid', 'item');
    tracker.set('mwnf3_sharing_history:sh_exhibitions:5', 'exhibition-uuid', 'collection');

    const query = vi.fn(async (sql: string) => {
      if (sql.includes('rel_sh_bibliography_objects')) {
        return [1, 2, 3].map((biblio_id) => ({
          project_id: 'AWE',
          country: 'pt',
          number: 1,
          biblio_id,
        }));
      }
      if (sql.includes('rel_sh_bibliography_exhibition')) return exhibitionLinks;
      if (sql.includes('rel_sh_bibliography')) return [];
      if (sql.includes('sh_bibliography_langs')) return texts;
      if (sql.includes('sh_bibliography')) return bibliography;
      return [];
    });
    const legacyDb = {
      query,
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as ILegacyDatabase;
    const strategy = {
      exists: vi.fn().mockResolvedValue(false),
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      getCollectionTranslationLanguages: vi.fn().mockResolvedValue(['eng']),
      getItemTranslationLanguages: vi.fn().mockResolvedValue(['eng']),
      getCollectionTranslationExtra: vi.fn().mockResolvedValue(null),
      setCollectionTranslationExtra: vi.fn(async (id: string, _lang: string, extra: string) => {
        collectionExtra.set(id, extra);
      }),
      getItemTranslationExtra: vi.fn().mockResolvedValue(null),
      setItemTranslationExtra: vi.fn(async (id: string, _lang: string, extra: string) => {
        itemExtra.set(id, extra);
      }),
    } as unknown as IWriteStrategy;

    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  // Keyed by language id (#2394).
  const markdown = (extra: string | undefined, key: string) =>
    (JSON.parse(extra ?? '{}')[key]?.eng ?? []).map((entry: string) => entry.split(',')[0]);

  it("sorts an item's bibliography by its text", async () => {
    exhibitionLinks = [];
    await new ShBibliographyHbImporter(context).import();

    expect(markdown(itemExtra.get('item-uuid'), 'structured_bibliography')).toEqual([
      'Costa',
      'Ramos',
      'Various authors',
    ]);
  });

  it('keeps the sort_order of a list ordered by hand, and sorts any other by its text', async () => {
    exhibitionLinks = [
      { biblio_id: 1, exhibition_id: 5, sort_order: 1, sort_status: 'Y' },
      { biblio_id: 2, exhibition_id: 5, sort_order: 2, sort_status: 'Y' },
      { biblio_id: 3, exhibition_id: 5, sort_order: 3, sort_status: 'Y' },
    ];
    await new ShBibliographyHbImporter(context).import();
    expect(markdown(collectionExtra.get('exhibition-uuid'), 'bibliography')).toEqual([
      'Various authors',
      'Costa',
      'Ramos',
    ]);

    exhibitionLinks = exhibitionLinks.map((link) => ({ ...link, sort_status: 'N' }));
    await new ShBibliographyHbImporter(context).import();
    expect(markdown(collectionExtra.get('exhibition-uuid'), 'bibliography')).toEqual([
      'Costa',
      'Ramos',
      'Various authors',
    ]);
  });
});
