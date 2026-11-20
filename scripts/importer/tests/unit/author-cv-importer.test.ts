import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorImporter } from '../../src/importers/phase-01/author-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

/**
 * Authors 436 and 437 are merged by name into 252 and 360, whose CVs are empty
 * in the languages where 436 and 437 have one. The empty rows came first and
 * won, so the texts were dropped as duplicates (M16 G3 #2699). The outcome
 * must not depend on the order of the rows.
 */
describe('AuthorImporter — CVs of merged authors (M16 G3 #2699)', () => {
  let tracker: UnifiedTracker;
  let context: ImportContext;
  let writeAuthorTranslationMock: ReturnType<typeof vi.fn>;
  let cvRows: Array<{ author_id: number; project_id: string; lang_id: string; curriculum: string }>;

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
    tracker.set('en', 'eng', 'language');
    tracker.set('pt', 'por', 'language');
    tracker.set('mwnf3:projects:BAR', 'ctx-bar', 'context');
    // 436 was merged into 252: both keys point to the same author.
    tracker.set('mwnf3:authors:252', 'author-252', 'author');
    tracker.set('mwnf3:authors:436', 'author-252', 'author');
    cvRows = [];

    const legacyDb: ILegacyDatabase = {
      query: vi.fn(async (sql: string) => (sql.includes('FROM mwnf3.authors_cv') ? cvRows : [])) as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    writeAuthorTranslationMock = vi.fn().mockResolvedValue(undefined);
    const strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      writeAuthor: vi.fn(),
      writeAuthorTranslation: writeAuthorTranslationMock,
    } as unknown as IWriteStrategy;

    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  const cvsWritten = () =>
    writeAuthorTranslationMock.mock.calls.map(([data]) => ({
      author: (data as { author_id: string }).author_id,
      language: (data as { language_id: string }).language_id,
      curriculum: (data as { curriculum: string }).curriculum,
    }));

  it("gives the merged author the other author's CV when its own row is empty", async () => {
    cvRows = [
      { author_id: 252, project_id: 'BAR', lang_id: 'en', curriculum: '' },
      { author_id: 252, project_id: 'BAR', lang_id: 'pt', curriculum: '  ' },
      { author_id: 436, project_id: 'BAR', lang_id: 'en', curriculum: 'SURNAME: Cândido' },
      { author_id: 436, project_id: 'BAR', lang_id: 'pt', curriculum: 'APELIDO: Cândido' },
    ];

    const result = await new AuthorImporter(context).import();

    expect(cvsWritten()).toEqual([
      { author: 'author-252', language: 'eng', curriculum: 'SURNAME: Cândido' },
      { author: 'author-252', language: 'por', curriculum: 'APELIDO: Cândido' },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it('writes the same CVs whatever order the rows come in', async () => {
    cvRows = [
      { author_id: 436, project_id: 'BAR', lang_id: 'en', curriculum: 'SURNAME: Cândido' },
      { author_id: 252, project_id: 'BAR', lang_id: 'en', curriculum: '' },
    ];

    await new AuthorImporter(context).import();

    expect(cvsWritten()).toEqual([
      { author: 'author-252', language: 'eng', curriculum: 'SURNAME: Cândido' },
    ]);
  });

  it('writes an identical second CV once', async () => {
    cvRows = [
      { author_id: 252, project_id: 'BAR', lang_id: 'en', curriculum: 'SURNAME: Soromenho' },
      { author_id: 436, project_id: 'BAR', lang_id: 'en', curriculum: 'SURNAME: Soromenho' },
    ];

    const result = await new AuthorImporter(context).import();

    expect(cvsWritten()).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('reports a different second CV, naming both rows, instead of dropping it silently', async () => {
    cvRows = [
      { author_id: 252, project_id: 'BAR', lang_id: 'en', curriculum: 'One text' },
      { author_id: 436, project_id: 'BAR', lang_id: 'en', curriculum: 'Another text' },
    ];

    const result = await new AuthorImporter(context).import();

    expect(cvsWritten()).toHaveLength(1);
    expect(result.errors).toEqual([
      expect.stringContaining(
        'mwnf3 author CV 436:BAR:en: a different CV than mwnf3 author CV 252:BAR:en'
      ),
    ]);
  });
});
