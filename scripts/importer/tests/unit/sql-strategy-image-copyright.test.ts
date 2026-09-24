/**
 * SqlWriteStrategy writes an image row's burn-ready `copyright` into its own
 * column (item_images, partner_images), and NULL — never undefined, which
 * mysql2 rejects — when the importer has none.
 */

import { describe, it, expect, vi } from 'vitest';
import { SqlWriteStrategy } from '../../src/strategies/sql-strategy.js';
import type { ITracker } from '../../src/core/tracker.js';

function makeRecordingDb() {
  return {
    execute: vi.fn(async (_sql: string, _values?: unknown[]) => [{}, []]),
    end: vi.fn(async () => {}),
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
  };
}

function makeTracker(): ITracker {
  return {
    register: vi.fn(),
    exists: vi.fn().mockReturnValue(false),
    getUuid: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    getByType: vi.fn().mockReturnValue([]),
    getStats: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    clear: vi.fn(),
    setMetadata: vi.fn(),
    getMetadata: vi.fn().mockReturnValue(null),
  } as unknown as ITracker;
}

/** The value bound to `column` by the single INSERT the strategy executed. */
function boundValue(db: ReturnType<typeof makeRecordingDb>, column: string): unknown {
  const [sql, values] = db.execute.mock.calls[0] as [string, unknown[]];
  const columns = /\(([^)]*)\)\s*VALUES/
    .exec(sql)![1]!
    .split(',')
    .map((name) => name.trim());
  expect(columns).toContain(column);

  return values[columns.indexOf(column)];
}

function makeStrategy(db: ReturnType<typeof makeRecordingDb>): SqlWriteStrategy {
  return new SqlWriteStrategy(
    db as unknown as ConstructorParameters<typeof SqlWriteStrategy>[0],
    makeTracker()
  );
}

const itemImage = {
  item_id: 'picture-item-1',
  path: 'objects/bar/cz/11/2/1.jpg',
  original_name: '1.jpg',
  mime_type: 'image/jpeg',
  size: 1,
  alt_text: null,
  display_order: 1,
};

const partnerImage = {
  partner_id: 'partner-1',
  path: 'museums/mus11/1.jpg',
  original_name: '1.jpg',
  mime_type: 'image/jpeg',
  size: 1,
  alt_text: null,
  display_order: 1,
};

describe('SqlWriteStrategy — image copyright column', () => {
  it('writeItemImage binds the copyright', async () => {
    const db = makeRecordingDb();
    await makeStrategy(db).writeItemImage({ ...itemImage, copyright: '© Moravská galerie v Brně' });

    expect(boundValue(db, 'copyright')).toBe('© Moravská galerie v Brně');
  });

  it('writeItemImage binds NULL when there is no copyright', async () => {
    const db = makeRecordingDb();
    await makeStrategy(db).writeItemImage(itemImage);

    expect(boundValue(db, 'copyright')).toBeNull();
  });

  it('writePartnerImage binds the copyright', async () => {
    const db = makeRecordingDb();
    await makeStrategy(db).writePartnerImage({ ...partnerImage, copyright: '© DZ Museum' });

    expect(boundValue(db, 'copyright')).toBe('© DZ Museum');
  });

  it('writePartnerImage binds NULL when there is no copyright', async () => {
    const db = makeRecordingDb();
    await makeStrategy(db).writePartnerImage(partnerImage);

    expect(boundValue(db, 'copyright')).toBeNull();
  });
});
