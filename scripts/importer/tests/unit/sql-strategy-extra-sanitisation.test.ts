/**
 * The value that reaches the database must be the sanitised one.
 *
 * `sanitizeAllStrings` is called at the top of every write, but three of them
 * then read `data.extra` rather than `sanitized.extra` when building the query
 * — so the converted copy was computed and thrown away, and the raw legacy HTML
 * went in. That is how 367 `<i>` tags in the Sharing History curator
 * justifications survived a reimport whose whole purpose was to convert them.
 *
 * These tests read the values actually handed to the driver, because that is
 * the only place the mistake was visible.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqlWriteStrategy } from '../../src/strategies/sql-strategy.js';
import type { ITracker } from '../../src/core/tracker.js';

function makeMockDb() {
  const calls: { sql: string; values: unknown[] }[] = [];
  return {
    calls,
    db: {
      execute: vi.fn(async (sql: string, values?: unknown) => {
        calls.push({ sql, values: (values ?? []) as unknown[] });
        return [{}, []];
      }),
      end: vi.fn(async () => {}),
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    },
  };
}

const tracker = () =>
  ({
    set: vi.fn(),
    get: vi.fn().mockReturnValue(null),
    has: vi.fn().mockReturnValue(false),
    resolve: vi.fn().mockResolvedValue(null),
  }) as unknown as ITracker;

describe('extra reaching the database', () => {
  let mock: ReturnType<typeof makeMockDb>;
  let strategy: SqlWriteStrategy;

  beforeEach(() => {
    mock = makeMockDb();
    strategy = new SqlWriteStrategy(
      mock.db as unknown as ConstructorParameters<typeof SqlWriteStrategy>[0],
      tracker()
    );
  });

  /** The value bound to the `extra` column of the last statement. */
  const extraWritten = (sql: string) => {
    const call = mock.calls.find((c) => c.sql.includes(sql))!;
    expect(call).toBeDefined();
    const columns = call.sql.slice(call.sql.indexOf('(') + 1, call.sql.indexOf(')')).split(',');
    return call.values[columns.findIndex((c) => c.trim() === 'extra')];
  };

  it('converts the curator justifications on a collection item', async () => {
    await strategy.writeCollectionItem({
      collection_id: 'c1',
      item_id: 'i1',
      extra: {
        justifications: {
          en: { curator: 'Walter Duncan’s <i>Fantasy in Egyptian Gallery</i>.', partner: null },
        },
        curator_status: 'Y',
      },
    } as unknown as Parameters<SqlWriteStrategy['writeCollectionItem']>[0]);

    const written = JSON.parse(extraWritten('INTO collection_item') as string);
    expect(written.justifications.en.curator).toBe(
      'Walter Duncan’s *Fantasy in Egyptian Gallery*.'
    );
    expect(written.curator_status).toBe('Y');
  });

  it('converts extra on a timeline event item', async () => {
    await strategy.writeTimelineEventItem({
      timeline_event_id: 'e1',
      item_id: 'i1',
      display_order: 1,
      extra: JSON.stringify({ note: 'A <b>bold</b> note' }),
    } as unknown as Parameters<SqlWriteStrategy['writeTimelineEventItem']>[0]);

    expect(JSON.parse(extraWritten('INTO timeline_event_item') as string)).toEqual({
      note: 'A **bold** note',
    });
  });

  it('converts extra written on its own, which passes no other sanitiser', async () => {
    await strategy.updateTimelineExtra('t1', JSON.stringify({ caption: '<i>Carthage</i>' }));

    const call = mock.calls.find((c) => c.sql.includes('UPDATE timelines'))!;
    expect(JSON.parse(call.values[0] as string)).toEqual({ caption: '*Carthage*' });
  });

  // Eight methods write `extra` on their own rather than through a
  // `write*` + `sanitizeAllStrings` pair, and each binds its argument straight
  // into the statement. Fixing `updateTimelineExtra` alone left seven, and one
  // of them — `setCollectionItemExtra` — is what the Sharing History curator
  // justifications go through, so the tags survived a fix, a full reimport and
  // a targeted re-run before this was found.
  describe('the methods that write extra on their own', () => {
    const cases: [string, string, () => Promise<unknown>][] = [
      [
        'setCollectionItemExtra',
        'UPDATE collection_item',
        () => strategy.setCollectionItemExtra('c1', 'i1', JSON.stringify({ t: '<i>Aeneid</i>' })),
      ],
      [
        'setCollectionTranslationExtra',
        'UPDATE collection_translations SET extra = ?, updated_at = ? WHERE collection_id = ? AND language_id = ?',
        () =>
          strategy.setCollectionTranslationExtra('c1', 'eng', JSON.stringify({ t: '<i>Aeneid</i>' })),
      ],
      [
        'setCollectionTranslationExtraByKey',
        'AND context_id = ?',
        () =>
          strategy.setCollectionTranslationExtraByKey(
            'c1',
            'eng',
            'ctx',
            JSON.stringify({ t: '<i>Aeneid</i>' })
          ),
      ],
      [
        'setCollectionTranslationExtraById',
        'UPDATE collection_translations SET extra = ?, updated_at = ? WHERE id = ?',
        () =>
          strategy.setCollectionTranslationExtraById('id1', JSON.stringify({ t: '<i>Aeneid</i>' })),
      ],
      [
        'setItemTranslationExtra',
        'UPDATE item_translations',
        () =>
          strategy.setItemTranslationExtra('i1', 'eng', JSON.stringify({ t: '<i>Aeneid</i>' })),
      ],
      [
        'setCollectionImageExtra',
        'UPDATE collection_images',
        () => strategy.setCollectionImageExtra('img1', JSON.stringify({ t: '<i>Aeneid</i>' })),
      ],
      [
        'setCollectionExtra',
        'UPDATE collections SET extra',
        () => strategy.setCollectionExtra('c1', JSON.stringify({ t: '<i>Aeneid</i>' })),
      ],
      [
        'updateTimelineExtra',
        'UPDATE timelines',
        () => strategy.updateTimelineExtra('t1', JSON.stringify({ t: '<i>Aeneid</i>' })),
      ],
    ];

    for (const [name, sql, run] of cases) {
      it(`${name} converts what it is given`, async () => {
        await run();
        const call = mock.calls.find((c) => c.sql.includes(sql))!;
        expect(call, `no statement matching ${sql}`).toBeDefined();
        expect(JSON.parse(call.values[0] as string)).toEqual({ t: '*Aeneid*' });
      });
    }
  });

  it('converts a description written on its own', async () => {
    await strategy.setCollectionTranslationDescriptionByKey(
      'c1',
      'eng',
      'ctx',
      'The <i>medina</i>.'
    );

    const call = mock.calls.find((c) => c.sql.includes('SET description = ?'))!;
    expect(call.values[0]).toBe('The *medina*.');
  });

  it('converts an item description written on its own', async () => {
    await strategy.setItemTranslationDescriptionByContext(
      'i1',
      'eng',
      'ctx',
      'The <i>kasbah</i>.'
    );

    const call = mock.calls.find((c) =>
      c.sql.includes('UPDATE item_translations SET description')
    )!;
    expect(call.values[0]).toBe('The *kasbah*.');
  });

  it('leaves a row with no extra alone', async () => {
    await strategy.writeCollectionItem({
      collection_id: 'c1',
      item_id: 'i1',
    } as unknown as Parameters<SqlWriteStrategy['writeCollectionItem']>[0]);

    expect(extraWritten('INTO collection_item')).toBeNull();
  });
});
