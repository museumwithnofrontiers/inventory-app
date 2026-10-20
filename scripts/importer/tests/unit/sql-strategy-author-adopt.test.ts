/**
 * Tests for SqlWriteStrategy.writeAuthor – adopting a record by name
 *
 * A free-text credit can create an author before the author step reaches the
 * legacy record of the same person. The legacy record then collides on the
 * name and adopts the free-text one, which holds the name alone: the Arabic
 * spelling (`originalname`) that the sites print on Arabic pages was lost.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqlWriteStrategy } from '../../src/strategies/sql-strategy.js';
import type { AuthorData } from '../../src/core/types.js';
import type { ITracker } from '../../src/core/tracker.js';

function makeMockDb() {
  const updates: { sql: string; values: unknown[] }[] = [];
  return {
    updates,
    db: {
      execute: vi.fn(async (sql: string, values?: unknown) => {
        if (sql.trimStart().startsWith('INSERT')) {
          throw new Error("Duplicate entry 'Houria Cherid' for key 'authors_name_unique'");
        }
        if (sql.trimStart().startsWith('UPDATE')) {
          updates.push({ sql, values: (values ?? []) as unknown[] });
          return [{}, []];
        }
        if (sql.includes('WHERE name = ?')) {
          return [[{ id: 'free-text-author' }], []];
        }
        return [[], []];
      }),
      end: vi.fn(async () => {}),
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    },
  };
}

function makeMockTracker(): ITracker {
  return {
    set: vi.fn(),
    get: vi.fn().mockReturnValue(null),
    getUuid: vi.fn().mockReturnValue(null),
    has: vi.fn().mockReturnValue(false),
    resolve: vi.fn().mockResolvedValue(null),
  } as unknown as ITracker;
}

describe('SqlWriteStrategy.writeAuthor – adopting a free-text record', () => {
  let mock: ReturnType<typeof makeMockDb>;
  let strategy: SqlWriteStrategy;

  const houria: AuthorData = {
    name: 'Houria Cherid',
    firstname: 'Houria',
    lastname: 'Cherid',
    givenname: null,
    originalname: 'حورية شريد',
    internal_name: 'Houria Cherid',
    backward_compatibility: 'mwnf3:authors:26',
  };

  beforeEach(() => {
    mock = makeMockDb();
    strategy = new SqlWriteStrategy(
      mock.db as unknown as ConstructorParameters<typeof SqlWriteStrategy>[0],
      makeMockTracker()
    );
  });

  it('returns the adopted record', async () => {
    await expect(strategy.writeAuthor(houria)).resolves.toBe('free-text-author');
  });

  it('sets the legacy key and fills the name parts and the original spelling', async () => {
    await strategy.writeAuthor(houria);

    expect(mock.updates).toHaveLength(1);
    const update = mock.updates[0]!;
    for (const column of [
      'backward_compatibility',
      'firstname',
      'lastname',
      'givenname',
      'originalname',
    ]) {
      expect(update.sql).toContain(column);
    }
    expect(update.values).toEqual([
      'mwnf3:authors:26',
      'Houria',
      'Cherid',
      null,
      'حورية شريد',
      'free-text-author',
    ]);
  });

  it('only fills columns the adopted record leaves empty', async () => {
    await strategy.writeAuthor(houria);

    const sql = mock.updates[0]!.sql;
    expect(sql).toContain("originalname = COALESCE(NULLIF(originalname, ''), ?)");
    expect(sql).toContain("firstname = COALESCE(NULLIF(firstname, ''), ?)");
    expect(sql).toContain("lastname = COALESCE(NULLIF(lastname, ''), ?)");
    expect(sql).toContain("givenname = COALESCE(NULLIF(givenname, ''), ?)");
  });

  it('passes no empty string for a part legacy leaves blank', async () => {
    await strategy.writeAuthor({ ...houria, firstname: '', originalname: '' });

    const values = mock.updates[0]!.values;
    expect(values[1]).toBeNull();
    expect(values[4]).toBeNull();
  });
});
