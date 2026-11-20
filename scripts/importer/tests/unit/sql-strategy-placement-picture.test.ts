/**
 * A placement's `picture` is a legacy path. In a full stage the
 * collection-item-columns step runs before image-sync, while the image row
 * still has the legacy path in `path` and only the base name in
 * `original_name`; image-sync moves the legacy path to `original_name`. The
 * lookup matches either, so the 128 Sharing History placements resolve in a
 * full stage too (M16 G4).
 */

import { describe, expect, it, vi } from 'vitest';
import { SqlWriteStrategy } from '../../src/strategies/sql-strategy.js';
import type { ITracker } from '../../src/core/tracker.js';

describe('findPictureItemIdsByOriginalName', () => {
  it('matches the legacy path in path (before image-sync) or original_name (after)', async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      execute: vi.fn(async (sql: string, values?: unknown) => {
        calls.push({ sql, values: (values ?? []) as unknown[] });
        return [[{ id: 'pic-1' }], []];
      }),
    };
    const strategy = new SqlWriteStrategy(
      db as unknown as ConstructorParameters<typeof SqlWriteStrategy>[0],
      { set: vi.fn(), get: vi.fn().mockReturnValue(null) } as unknown as ITracker
    );

    const legacyPath = 'sharing_history/sh_monuments/awe/gr/2/1.jpg';
    const ids = await strategy.findPictureItemIdsByOriginalName('parent-1', legacyPath);

    expect(ids).toEqual(['pic-1']);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.sql.replace(/\s+/g, ' ')).toContain('(ii.path = ? OR ii.original_name = ?)');
    expect(calls[0]!.values).toEqual(['parent-1', legacyPath, legacyPath]);
  });
});
