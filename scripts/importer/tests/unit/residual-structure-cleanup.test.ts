/**
 * M16 Epic J: the project-shell cleanup (J1, #2708) and the orphan author
 * cleanup (J4, #2711), in the SQL strategy and in their importers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqlWriteStrategy } from '../../src/strategies/sql-strategy.js';
import { ProjectShellCleanupImporter } from '../../src/importers/phase-11/project-shell-cleanup-importer.js';
import { OrphanAuthorCleanupImporter } from '../../src/importers/phase-11/orphan-author-cleanup-importer.js';
import { UnifiedTracker } from '../../src/core/tracker.js';
import type { ITracker } from '../../src/core/tracker.js';
import type { ImportContext, ILegacyDatabase, ILogger } from '../../src/core/base-importer.js';
import type { IWriteStrategy, ProjectShellCleanup } from '../../src/core/strategy.js';

type Row = Record<string, unknown>;

/**
 * A database that answers by query shape: the foreign keys, the candidate
 * rows, and which ids each `table.column` holds.
 */
function makeDb(state: {
  fks: Record<string, Array<{ table: string; column: string }>>;
  candidates: Row[];
  held: Record<string, string[]>;
  links?: string[];
}) {
  const calls: string[] = [];
  const db = {
    execute: vi.fn(async (sql: string, values: unknown[] = []) => {
      calls.push(sql.replace(/\s+/g, ' ').trim());
      if (sql.includes('information_schema.KEY_COLUMN_USAGE')) {
        const fks = state.fks[String(values[0])] ?? [];
        return [fks.map((f) => ({ table_name: f.table, column_name: f.column })), []];
      }
      if (sql.includes('FROM collections c') || sql.includes('FROM authors')) {
        return [state.candidates, []];
      }
      if (sql.includes('FROM links')) {
        return [(state.links ?? []).includes(String(values[0])) ? [{ 1: 1 }] : [], []];
      }
      const ref = /SELECT 1 FROM `(\w+)` WHERE `(\w+)` = \?/.exec(sql);
      if (ref) {
        const key = `${ref[1]}.${ref[2]}`;
        return [(state.held[key] ?? []).includes(String(values[0])) ? [{ 1: 1 }] : [], []];
      }
      if (sql.startsWith('DELETE FROM collections')) {
        // A deleted collection no longer refers to its context.
        state.held['collections.context_id'] = (state.held['collections.context_id'] ?? []).filter(
          (id) => !state.candidates.some((c) => c.id === values[0] && c.context_id === id)
        );
      }
      return [{ affectedRows: 1 }, []];
    }),
    end: vi.fn(),
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
  };
  return { db, calls };
}

const tracker = {
  set: vi.fn(),
  get: vi.fn().mockReturnValue(null),
  has: vi.fn().mockReturnValue(false),
  resolve: vi.fn().mockResolvedValue(null),
} as unknown as ITracker;

function strategyOn(db: ReturnType<typeof makeDb>['db']): SqlWriteStrategy {
  return new SqlWriteStrategy(
    db as unknown as ConstructorParameters<typeof SqlWriteStrategy>[0],
    tracker
  );
}

const COLLECTION_FKS = [
  { table: 'collection_translations', column: 'collection_id' },
  { table: 'collections', column: 'parent_id' },
  { table: 'items', column: 'collection_id' },
];
const CONTEXT_FKS = [
  { table: 'author_translations', column: 'context_id' },
  { table: 'collections', column: 'context_id' },
];

describe('SqlWriteStrategy.deleteProjectShells (M16 J1)', () => {
  const shells = [
    { id: 'c-amu', backward_compatibility: 'mwnf3:projects:AMU', context_id: 'x-amu' },
    { id: 'c-clo', backward_compatibility: 'mwnf3:projects:CLO', context_id: 'x-clo' },
    {
      id: 'c-usa',
      backward_compatibility: 'mwnf3_sharing_history:sh_projects:usa',
      context_id: 'x-usa',
    },
  ];

  function state() {
    return {
      fks: { collections: COLLECTION_FKS, contexts: CONTEXT_FKS },
      candidates: shells,
      held: {
        'collection_translations.collection_id': ['c-amu', 'c-clo', 'c-usa'],
        'collections.parent_id': ['c-usa'],
        'author_translations.context_id': ['x-clo'],
        'collections.context_id': ['x-amu', 'x-clo', 'x-usa'],
      },
    };
  }

  it('removes a shell and its context, and keeps a root with children and a context with a CV', async () => {
    const { db, calls } = makeDb(state());
    const result = await strategyOn(db).deleteProjectShells(false);

    expect(result.collections.map((c) => c.backward_compatibility)).toEqual([
      'mwnf3:projects:AMU',
      'mwnf3:projects:CLO',
    ]);
    expect(result.contexts.map((c) => c.id)).toEqual(['x-amu']);
    expect(result.kept).toEqual([
      {
        kind: 'context',
        id: 'x-clo',
        backward_compatibility: 'mwnf3:projects:CLO',
        referencedBy: ['author_translations.context_id'],
      },
      {
        kind: 'collection',
        id: 'c-usa',
        backward_compatibility: 'mwnf3_sharing_history:sh_projects:usa',
        referencedBy: ['collections.parent_id'],
      },
    ]);
    expect(calls).toContain('DELETE FROM collections WHERE id = ?');
    expect(calls).toContain('DELETE FROM contexts WHERE id = ?');
    expect(db.commit).toHaveBeenCalled();
    expect(db.rollback).not.toHaveBeenCalled();
  });

  it("does not count the shell's own translations as a reference", async () => {
    const { db, calls } = makeDb(state());
    await strategyOn(db).deleteProjectShells(false);
    expect(calls.some((c) => c.includes('`collection_translations` WHERE `collection_id`'))).toBe(
      false
    );
  });

  it('keeps a shell that a link points at', async () => {
    const { db } = makeDb({ ...state(), links: ['c-amu'] });
    const result = await strategyOn(db).deleteProjectShells(false);
    expect(result.kept.find((k) => k.id === 'c-amu')?.referencedBy).toEqual(['links.linkable_id']);
  });

  it('rolls everything back on a dry run', async () => {
    const { db } = makeDb(state());
    const result = await strategyOn(db).deleteProjectShells(true);
    expect(result.collections).toHaveLength(2);
    expect(db.rollback).toHaveBeenCalled();
    expect(db.commit).not.toHaveBeenCalled();
  });

  it('only selects root collections keyed like a legacy project whose project row is gone', async () => {
    const { db, calls } = makeDb(state());
    await strategyOn(db).deleteProjectShells(false);
    const select = calls.find((c) => c.includes('FROM collections c')) ?? '';
    expect(select).toContain('c.parent_id IS NULL');
    expect(select).toContain("LIKE 'mwnf3:projects:%'");
    expect(select).toContain("LIKE 'mwnf3_sharing_history:sh_projects:%'");
    expect(select).toContain('NOT EXISTS ( SELECT 1 FROM projects p');
  });
});

describe('SqlWriteStrategy.deleteOrphanFreeTextAuthors (M16 J4)', () => {
  const AUTHOR_FKS = [
    { table: 'author_translations', column: 'author_id' },
    { table: 'item_translations', column: 'author_id' },
    { table: 'item_translations', column: 'translator_id' },
    { table: 'item_translation_author', column: 'author_id' },
  ];

  it('deletes the free-text authors nothing refers to and keeps the others', async () => {
    const { db, calls } = makeDb({
      fks: { authors: AUTHOR_FKS },
      candidates: [
        { id: 'a-1', name: 'Orphan' },
        { id: 'a-2', name: 'Credited' },
        { id: 'a-3', name: 'Translator' },
      ],
      held: {
        'item_translation_author.author_id': ['a-2'],
        'item_translations.translator_id': ['a-3'],
      },
    });
    const deleted = await strategyOn(db).deleteOrphanFreeTextAuthors(false);

    expect(deleted).toEqual([{ id: 'a-1', name: 'Orphan' }]);
    expect(calls.filter((c) => c.startsWith('DELETE FROM authors'))).toHaveLength(1);
    expect(db.commit).toHaveBeenCalled();
  });

  it('only considers authors without a legacy key', async () => {
    const { db, calls } = makeDb({ fks: { authors: AUTHOR_FKS }, candidates: [], held: {} });
    await strategyOn(db).deleteOrphanFreeTextAuthors(false);
    const select = calls.find((c) => c.includes('FROM authors')) ?? '';
    expect(select).toContain("backward_compatibility IS NULL OR backward_compatibility = ''");
  });

  it('rolls back on a dry run', async () => {
    const { db } = makeDb({
      fks: { authors: AUTHOR_FKS },
      candidates: [{ id: 'a-1', name: 'Orphan' }],
      held: {},
    });
    expect(await strategyOn(db).deleteOrphanFreeTextAuthors(true)).toHaveLength(1);
    expect(db.rollback).toHaveBeenCalled();
    expect(db.commit).not.toHaveBeenCalled();
  });
});

describe('the cleanup importers', () => {
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
  let deleteProjectShells: ReturnType<typeof vi.fn>;
  let deleteOrphanFreeTextAuthors: ReturnType<typeof vi.fn>;

  function contextFor(dryRun: boolean): ImportContext {
    return {
      legacyDb,
      strategy: { deleteProjectShells, deleteOrphanFreeTextAuthors } as unknown as IWriteStrategy,
      tracker: new UnifiedTracker(),
      logger,
      dryRun,
    };
  }

  beforeEach(() => {
    const cleanup: ProjectShellCleanup = {
      collections: [{ id: 'c-amu', backward_compatibility: 'mwnf3:projects:AMU' }],
      contexts: [{ id: 'x-amu', backward_compatibility: 'mwnf3:projects:AMU' }],
      kept: [
        {
          kind: 'context',
          id: 'x-clo',
          backward_compatibility: 'mwnf3:projects:CLO',
          referencedBy: ['author_translations.context_id'],
        },
      ],
    };
    deleteProjectShells = vi.fn().mockResolvedValue(cleanup);
    deleteOrphanFreeTextAuthors = vi.fn().mockResolvedValue([{ id: 'a-1', name: 'Orphan' }]);
  });

  it('reports the removed and kept project shells', async () => {
    const result = await new ProjectShellCleanupImporter(contextFor(false)).import();
    expect(deleteProjectShells).toHaveBeenCalledWith(false);
    expect(result).toMatchObject({ success: true, imported: 1, skipped: 1 });
  });

  it('passes a dry run on to the strategy', async () => {
    await new ProjectShellCleanupImporter(contextFor(true)).import();
    await new OrphanAuthorCleanupImporter(contextFor(true)).import();
    expect(deleteProjectShells).toHaveBeenCalledWith(true);
    expect(deleteOrphanFreeTextAuthors).toHaveBeenCalledWith(true);
  });

  it('counts the removed authors', async () => {
    const result = await new OrphanAuthorCleanupImporter(contextFor(false)).import();
    expect(result).toMatchObject({ success: true, imported: 1 });
  });

  it('fails the step when the strategy throws', async () => {
    deleteOrphanFreeTextAuthors.mockRejectedValue(new Error('boom'));
    const result = await new OrphanAuthorCleanupImporter(contextFor(false)).import();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('boom');
  });
});
