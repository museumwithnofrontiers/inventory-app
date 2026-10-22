import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorImporter } from '../../src/importers/phase-01/author-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy } from '../../src/core/strategy.js';

// Covers the SH author-item assignment key format: sh_authors_objects /
// sh_authors_monuments have NO museum/institution column and store the
// project id uppercase ('AWE'), while SH items were imported with lowercase
// 3-part keys (sh_objects:awe:gr:1). The importer historically built
// 4-part keys with an undefined museum segment, so every SH credit
// assignment silently failed to resolve (issue found 2026-08-22).
describe('AuthorImporter — SH author-item assignments', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let updateFkMock: ReturnType<typeof vi.fn>;
  let replaceCreditsMock: ReturnType<typeof vi.fn>;

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

  // Legacy fixture rows exactly as the SH junction tables provide them:
  // uppercase project id, no museum/institution column.
  const shAuthorObjects = [
    { author_id: 4, project_id: 'AWE', country: 'gr', number: 1, lang: 'en', type: 'writer', priority: 0 },
    { author_id: 7, project_id: 'AWE', country: 'gr', number: 1, lang: 'en', type: 'translator', priority: 0 },
  ];
  const shAuthorMonuments = [
    { author_id: 5, project_id: 'AWE', country: 'eg', number: 1, lang: 'en', type: 'writer', priority: 0 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    tracker.set('mwnf3_sharing_history:sh_authors:4', 'author-4', 'author');
    tracker.set('mwnf3_sharing_history:sh_authors:5', 'author-5', 'author');
    tracker.set('mwnf3_sharing_history:sh_authors:7', 'author-7', 'author');
    // Items exist under their real imported keys: lowercase, 3-part.
    tracker.set('mwnf3_sharing_history:sh_objects:awe:gr:1', 'item-obj-gr1', 'item');
    tracker.set('mwnf3_sharing_history:sh_monuments:awe:eg:1', 'item-mon-eg1', 'item');

    const queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('sh_authors_objects')) return shAuthorObjects;
      if (sql.includes('sh_authors_monuments')) return shAuthorMonuments;
      // Every other author table (mwnf3 + THG authors, CVs, mwnf3
      // assignments, dynasties, bridge tables) is empty in this fixture.
      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    updateFkMock = vi.fn().mockResolvedValue(undefined);
    replaceCreditsMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      updateItemTranslationAuthorFk: updateFkMock,
      replaceItemTranslationCredits: replaceCreditsMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb,
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('resolves SH object assignments with lowercase 3-part item keys', async () => {
    const importer = new AuthorImporter(context);
    const result = await importer.import();

    expect(updateFkMock).toHaveBeenCalledWith('item-obj-gr1', 'eng', 'author_id', 'author-4', true);
    expect(updateFkMock).toHaveBeenCalledWith('item-obj-gr1', 'eng', 'translator_id', 'author-7', true);
    expect(result.success).toBe(true);
  });

  it('resolves SH monument assignments with lowercase 3-part item keys', async () => {
    const importer = new AuthorImporter(context);
    const result = await importer.import();

    expect(updateFkMock).toHaveBeenCalledWith('item-mon-eg1', 'eng', 'author_id', 'author-5', true);
    expect(result.success).toBe(true);
    // All three fixture assignments resolved — nothing skipped for key reasons.
    expect(updateFkMock).toHaveBeenCalledTimes(3);
  });

  it('performs no writes in dry-run mode', async () => {
    context.dryRun = true;
    const importer = new AuthorImporter(context);
    const result = await importer.import();

    expect(updateFkMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});

// Covers the mwnf3 author-item assignment key format. Unlike the SH junction
// tables, mwnf3.authors_objects / authors_monuments / authors_dynasties use
// *_id column names (country_id, museum_id, object_id, monument_id, lang_id).
// The importer read them as country/number/lang, so every lookup key contained
// the string "undefined" and every mwnf3 credit silently failed to resolve —
// leaving EPM item sheets with no byline on any language but the one that
// happened to carry the denormalised objects.preparedby free text.
describe('AuthorImporter — mwnf3 author-item assignments', () => {
  let tracker: UnifiedTracker;
  let legacyDb: ILegacyDatabase;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let updateFkMock: ReturnType<typeof vi.fn>;
  let replaceCreditsMock: ReturnType<typeof vi.fn>;
  let updateDynastyFkMock: ReturnType<typeof vi.fn>;
  let queryMock: ReturnType<typeof vi.fn>;

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

  // Real legacy rows for mwnf3:objects:EPM:at:Mus22:51 — the object that
  // exposed this bug. Note there is no 'ar' row: the Arabic credit the
  // importer used to produce came from objects.preparedby, not from here.
  const authorObjects = [
    { author_id: 456, project_id: 'EPM', country_id: 'at', museum_id: 'Mus22', object_id: 51, lang_id: 'en', type: 'writer', priority: 0 },
    { author_id: 527, project_id: 'EPM', country_id: 'at', museum_id: 'Mus22', object_id: 51, lang_id: 'en', type: 'copyEditor', priority: 0 },
    { author_id: 536, project_id: 'EPM', country_id: 'at', museum_id: 'Mus22', object_id: 51, lang_id: 'de', type: 'writer', priority: 1 },
    { author_id: 535, project_id: 'EPM', country_id: 'at', museum_id: 'Mus22', object_id: 51, lang_id: 'de', type: 'writer', priority: 2 },
  ];
  const authorMonuments = [
    { author_id: 456, project_id: 'ISL', country_id: 'eg', institution_id: 'Ins01', monument_id: 7, lang_id: 'en', type: 'writer', priority: 0 },
  ];
  const authorDynasties = [
    { dynasty_id: 3, author_id: 456, lang_id: 'en', type: 'writer', priority: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    tracker.set('de', 'deu', 'language');
    tracker.set('mwnf3:authors:456', 'author-456', 'author');
    tracker.set('mwnf3:authors:527', 'author-527', 'author');
    tracker.set('mwnf3:authors:535', 'author-535', 'author');
    tracker.set('mwnf3:authors:536', 'author-536', 'author');
    tracker.set('mwnf3:objects:EPM:at:Mus22:51', 'item-epm-51', 'item');
    tracker.set('mwnf3:monuments:ISL:eg:Ins01:7', 'item-isl-mon-7', 'item');
    tracker.set('mwnf3:dynasties:3', 'dynasty-3', 'dynasty');

    queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('mwnf3.authors_objects')) return authorObjects;
      if (sql.includes('mwnf3.authors_monuments')) return authorMonuments;
      if (sql.includes('mwnf3.authors_dynasties')) return authorDynasties;
      return [];
    });

    legacyDb = {
      query: queryMock as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    updateFkMock = vi.fn().mockResolvedValue(undefined);
    replaceCreditsMock = vi.fn().mockResolvedValue(undefined);
    updateDynastyFkMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      updateItemTranslationAuthorFk: updateFkMock,
      replaceItemTranslationCredits: replaceCreditsMock,
      updateDynastyTranslationAuthorFk: updateDynastyFkMock,
    } as unknown as IWriteStrategy;

    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  it('credits the language the legacy junction names, not just the free-text one', async () => {
    const result = await new AuthorImporter(context).import();

    expect(updateFkMock).toHaveBeenCalledWith('item-epm-51', 'eng', 'author_id', 'author-456', true);
    expect(updateFkMock).toHaveBeenCalledWith(
      'item-epm-51',
      'eng',
      'text_copy_editor_id',
      'author-527',
      true
    );
    expect(updateFkMock).toHaveBeenCalledWith('item-epm-51', 'deu', 'author_id', 'author-536', true);
    expect(result.success).toBe(true);
  });

  it('never builds an item key containing an undefined segment', async () => {
    await new AuthorImporter(context).import();

    for (const [itemId] of updateFkMock.mock.calls) {
      expect(itemId).not.toContain('undefined');
    }
    expect(updateFkMock).toHaveBeenCalled();
  });

  it('resolves mwnf3 monument assignments with the 4-part institution key', async () => {
    await new AuthorImporter(context).import();

    expect(updateFkMock).toHaveBeenCalledWith('item-isl-mon-7', 'eng', 'author_id', 'author-456', true);
  });

  it('orders junction rows by legacy priority so the lowest-priority author wins', async () => {
    await new AuthorImporter(context).import();

    // item_translations holds one FK per role and the strategy only fills a
    // NULL column, so the first row offered for a (item, language, role) is the
    // one that sticks. That order has to come from the query, matching
    // legacy's ORDER BY NVL(priority, 0) ASC.
    const objectQuery = queryMock.mock.calls
      .map(([sql]) => sql as string)
      .find((sql) => sql.includes('mwnf3.authors_objects'));

    expect(objectQuery).toMatch(/ORDER BY IFNULL\(priority, 0\) ASC, author_id ASC/);
  });

  it('resolves dynasty assignments using the lang_id column', async () => {
    await new AuthorImporter(context).import();

    expect(updateDynastyFkMock).toHaveBeenCalledWith('dynasty-3', 'eng', 'author_id', 'author-456', true);
  });
});

// mwnf3.authors_dynasties is keyed (dynasty_id, lang_id, author_id, type) and
// has NO priority column, unlike authors_objects / authors_monuments. Ordering
// by one is a SQL error (1054), which the importer used to swallow into a
// single unnamed entry on result.errors with no log line — the run reported
// "1 errors" and step 4 printed its header and nothing else.
describe('AuthorImporter — dynasty assignments and step failure reporting', () => {
  let tracker: UnifiedTracker;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let updateDynastyFkMock: ReturnType<typeof vi.fn>;
  let queryMock: ReturnType<typeof vi.fn>;

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

  // Exactly the columns the legacy table has — no priority.
  const authorDynasties = [
    { dynasty_id: 3, author_id: 456, lang_id: 'en', type: 'writer' },
    { dynasty_id: 3, author_id: 527, lang_id: 'en', type: 'copyEditor' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('en', 'eng', 'language');
    tracker.set('mwnf3:authors:456', 'author-456', 'author');
    tracker.set('mwnf3:authors:527', 'author-527', 'author');
    tracker.set('mwnf3:dynasties:3', 'dynasty-3', 'dynasty');

    queryMock = vi.fn(async (sql: string) => {
      // Mirror MySQL: ordering by a column the table does not have is an error.
      if (sql.includes('authors_dynasties') && sql.includes('priority')) {
        throw new Error("Unknown column 'priority' in 'order clause'");
      }
      if (sql.includes('mwnf3.authors_dynasties')) return authorDynasties;
      return [];
    });

    updateDynastyFkMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      updateItemTranslationAuthorFk: vi.fn().mockResolvedValue(undefined),
      replaceItemTranslationCredits: vi.fn().mockResolvedValue(undefined),
      updateDynastyTranslationAuthorFk: updateDynastyFkMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb: {
        query: queryMock as ILegacyDatabase['query'],
        execute: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      },
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('does not order the dynasty junction by a column it does not have', async () => {
    const result = await new AuthorImporter(context).import();

    const dynastyQuery = queryMock.mock.calls
      .map(([sql]) => sql as string)
      .find((sql) => sql.includes('mwnf3.authors_dynasties'));

    expect(dynastyQuery).not.toContain('priority');
    expect(result.success).toBe(true);
  });

  it('credits dynasty translations from the junction', async () => {
    await new AuthorImporter(context).import();

    expect(updateDynastyFkMock).toHaveBeenCalledWith('dynasty-3', 'eng', 'author_id', 'author-456', true);
    expect(updateDynastyFkMock).toHaveBeenCalledWith(
      'dynasty-3',
      'eng',
      'text_copy_editor_id',
      'author-527',
      true
    );
  });

  it('names and logs a step that throws instead of swallowing it', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('mwnf3.authors_dynasties')) {
        throw new Error("Unknown column 'priority' in 'order clause'");
      }
      return [];
    });

    const result = await new AuthorImporter(context).import();

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Step 4');
    const errorCall = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(errorCall[0]).toContain('Step 4');
    expect(errorCall[1]).toContain('priority');
  });

  it('runs the remaining steps when an earlier one throws', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('mwnf3.authors_objects')) throw new Error('boom');
      if (sql.includes('mwnf3.authors_dynasties')) return authorDynasties;
      return [];
    });

    const result = await new AuthorImporter(context).import();

    // Step 3 died, but step 4 still credited the dynasty.
    expect(result.errors[0]).toContain('Step 3');
    expect(updateDynastyFkMock).toHaveBeenCalledWith('dynasty-3', 'eng', 'author_id', 'author-456', true);
  });
});

// The legacy junction tables are authoritative over the denormalised
// objects.preparedby free text, so a junction credit replaces whatever a
// translation row already holds. First-wins across several junction rows for
// one (item, language, role) therefore has to be enforced by the importer
// rather than by the database's old IS NULL guard.
describe('AuthorImporter — junction is authoritative over free text', () => {
  let tracker: UnifiedTracker;
  let strategy: IWriteStrategy;
  let context: ImportContext;
  let updateFkMock: ReturnType<typeof vi.fn>;
  let replaceCreditsMock: ReturnType<typeof vi.fn>;
  let updateDynastyFkMock: ReturnType<typeof vi.fn>;

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

  // Two writers for (de, writer) — legacy shows the priority-1 author first.
  const authorObjects = [
    { author_id: 536, project_id: 'EPM', country_id: 'at', museum_id: 'Mus22', object_id: 51, lang_id: 'de', type: 'writer', priority: 1 },
    { author_id: 535, project_id: 'EPM', country_id: 'at', museum_id: 'Mus22', object_id: 51, lang_id: 'de', type: 'writer', priority: 2 },
  ];
  const authorDynasties = [
    { dynasty_id: 3, author_id: 456, lang_id: 'en', type: 'writer' },
    { dynasty_id: 3, author_id: 527, lang_id: 'en', type: 'writer' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    tracker = new UnifiedTracker();
    tracker.set('de', 'deu', 'language');
    tracker.set('en', 'eng', 'language');
    tracker.set('mwnf3:authors:456', 'author-456', 'author');
    tracker.set('mwnf3:authors:527', 'author-527', 'author');
    tracker.set('mwnf3:authors:535', 'author-535', 'author');
    tracker.set('mwnf3:authors:536', 'author-536', 'author');
    tracker.set('mwnf3:objects:EPM:at:Mus22:51', 'item-epm-51', 'item');
    tracker.set('mwnf3:dynasties:3', 'dynasty-3', 'dynasty');

    updateFkMock = vi.fn().mockResolvedValue(undefined);
    replaceCreditsMock = vi.fn().mockResolvedValue(undefined);
    updateDynastyFkMock = vi.fn().mockResolvedValue(undefined);

    strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      updateItemTranslationAuthorFk: updateFkMock,
      replaceItemTranslationCredits: replaceCreditsMock,
      updateDynastyTranslationAuthorFk: updateDynastyFkMock,
    } as unknown as IWriteStrategy;

    context = {
      legacyDb: {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('mwnf3.authors_objects')) return authorObjects;
          if (sql.includes('mwnf3.authors_dynasties')) return authorDynasties;
          return [];
        }) as ILegacyDatabase['query'],
        execute: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      },
      strategy,
      tracker,
      logger,
      dryRun: false,
    };
  });

  it('overwrites an existing credit rather than filling only NULLs', async () => {
    await new AuthorImporter(context).import();

    expect(updateFkMock).toHaveBeenCalledWith(
      'item-epm-51',
      'deu',
      'author_id',
      'author-536',
      true
    );
  });

  it('keeps the first author in the role FK column', async () => {
    await new AuthorImporter(context).import();

    const authorIdWrites = updateFkMock.mock.calls.filter(([, , column]) => column === 'author_id');
    expect(authorIdWrites).toHaveLength(1);
    expect(authorIdWrites[0][3]).toBe('author-536');
    expect(updateFkMock).not.toHaveBeenCalledWith(
      'item-epm-51',
      'deu',
      'author_id',
      'author-535',
      expect.anything()
    );
  });

  it('credits every author for a role, in priority order', async () => {
    await new AuthorImporter(context).import();

    expect(replaceCreditsMock).toHaveBeenCalledTimes(1);
    expect(replaceCreditsMock).toHaveBeenCalledWith('item-epm-51', 'deu', 'author_id', [
      'author-536',
      'author-535',
    ]);
  });

  it('applies the same first-wins rule to dynasty credits', async () => {
    await new AuthorImporter(context).import();

    expect(updateDynastyFkMock).toHaveBeenCalledTimes(1);
    expect(updateDynastyFkMock).toHaveBeenCalledWith(
      'dynasty-3',
      'eng',
      'author_id',
      'author-456',
      true
    );
  });

  it('is idempotent — a second run writes the same author', async () => {
    await new AuthorImporter(context).import();
    const first = updateFkMock.mock.calls.filter(([, , column]) => column === 'author_id');

    updateFkMock.mockClear();

    await new AuthorImporter(context).import();
    const second = updateFkMock.mock.calls.filter(([, , column]) => column === 'author_id');

    expect(second).toEqual(first);
  });

  it('writes nothing in dry-run mode', async () => {
    context.dryRun = true;
    const result = await new AuthorImporter(context).import();

    expect(updateFkMock).not.toHaveBeenCalled();
    expect(replaceCreditsMock).not.toHaveBeenCalled();
    expect(updateDynastyFkMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});

// Legacy Sharing History prints its own spelling of an author (sh_authors). The all_authors
// bridge says which mwnf3 author is the same person; merging into that author made the SH
// pages print the mwnf3 spelling.
describe('AuthorImporter — SH authors bridged to an mwnf3 author', () => {
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

  let tracker: UnifiedTracker;
  let writeAuthor: ReturnType<typeof vi.fn>;
  let context: ImportContext;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UnifiedTracker();
    const tables: Record<string, unknown[]> = {
      'mwnf3.authors_mwnf3_authors': [
        { author_id: 65, all_author_id: 165 },
        { author_id: 3, all_author_id: 103 },
      ],
      'mwnf3.authors_sh_authors': [
        { author_id: 58, all_author_id: 165 },
        { author_id: 22, all_author_id: 103 },
      ],
      'FROM mwnf3.authors ORDER': [
        { author_id: 65, firstname: 'Saloua', lastname: 'Zangar', givenname: '', originalname: '' },
        { author_id: 3, firstname: 'Aida', lastname: 'Naghawi', givenname: '', originalname: '' },
      ],
      'sh_authors ORDER': [
        {
          author_id: 58,
          firstname: 'Saloua',
          lastname: 'Khadhar Zangar',
          givenname: '',
          originalname: '',
        },
        { author_id: 22, firstname: 'Aida', lastname: 'NAGHAWI', givenname: '', originalname: '' },
      ],
    };
    const legacyDb: ILegacyDatabase = {
      query: vi.fn(
        async (sql: string) => Object.entries(tables).find(([k]) => sql.includes(k))?.[1] ?? []
      ) as ILegacyDatabase['query'],
      execute: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    writeAuthor = vi.fn(
      async (data: { backward_compatibility: string }) => `uuid:${data.backward_compatibility}`
    );
    const strategy = {
      findByBackwardCompatibility: vi.fn().mockResolvedValue(null),
      exists: vi.fn().mockResolvedValue(false),
      writeAuthor,
      writeAuthorTranslation: vi.fn(),
      updateItemTranslationAuthorFk: vi.fn(),
    } as unknown as IWriteStrategy;
    context = { legacyDb, strategy, tracker, logger, dryRun: false };
  });

  it('gives an SH author its own row when legacy SH spells the name differently', async () => {
    await new AuthorImporter(context).import();

    expect(writeAuthor).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Saloua Khadhar Zangar',
        backward_compatibility: 'mwnf3_sharing_history:sh_authors:58',
      })
    );
    expect(tracker.getUuid('mwnf3_sharing_history:sh_authors:58', 'author')).toBe(
      'uuid:mwnf3_sharing_history:sh_authors:58'
    );
  });

  it('keeps the merge when the spellings differ only in case or accents', async () => {
    await new AuthorImporter(context).import();

    expect(writeAuthor).not.toHaveBeenCalledWith(
      expect.objectContaining({ backward_compatibility: 'mwnf3_sharing_history:sh_authors:22' })
    );
    expect(tracker.getUuid('mwnf3_sharing_history:sh_authors:22', 'author')).toBe(
      'uuid:mwnf3:authors:3'
    );
  });
});
