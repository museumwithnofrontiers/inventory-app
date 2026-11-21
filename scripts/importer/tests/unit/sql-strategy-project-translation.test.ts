/**
 * A project's name in each language goes to `project_translations`, one row
 * per project and language, with a deterministic id; the context and the
 * description the transformer carries are not stored.
 */

import { describe, expect, it, vi } from 'vitest';
import { SqlWriteStrategy } from '../../src/strategies/sql-strategy.js';
import type { ITracker } from '../../src/core/tracker.js';
import { deterministicUuid } from '../../src/utils/deterministic-uuid.js';

describe('writeProjectTranslation', () => {
  it('writes the name of a project in one language', async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      execute: vi.fn(async (sql: string, values?: unknown) => {
        calls.push({ sql, values: (values ?? []) as unknown[] });
        return [{}, []];
      }),
    };
    const strategy = new SqlWriteStrategy(
      db as unknown as ConstructorParameters<typeof SqlWriteStrategy>[0],
      { set: vi.fn(), get: vi.fn().mockReturnValue(null) } as unknown as ITracker
    );

    await strategy.writeProjectTranslation({
      project_id: 'p1',
      language_id: 'fra',
      context_id: 'c1',
      name: "Découvrir l'art islamique",
      description: null,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.sql).toContain('INSERT INTO project_translations');
    expect(calls[0]!.values.slice(0, 4)).toEqual([
      deterministicUuid('project_translation:p1:fra'),
      'p1',
      'fra',
      "Découvrir l'art islamique",
    ]);
    expect(calls[0]!.values.some((value) => value === undefined)).toBe(false);
  });
});
