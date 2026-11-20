/**
 * A partner translation written without its optional fields binds null, never
 * undefined: mysql2 refuses undefined ("Bind parameters must not contain
 * undefined"), which lost the four exhibition partners' translations
 * (M16 G3 #2699).
 */

import { describe, expect, it, vi } from 'vitest';
import { SqlWriteStrategy } from '../../src/strategies/sql-strategy.js';
import type { ITracker } from '../../src/core/tracker.js';

describe('writePartnerTranslation', () => {
  it('binds null for every optional field it is not given', async () => {
    const calls: unknown[][] = [];
    const db = {
      execute: vi.fn(async (_sql: string, values?: unknown) => {
        calls.push((values ?? []) as unknown[]);
        return [{}, []];
      }),
    };
    const strategy = new SqlWriteStrategy(
      db as unknown as ConstructorParameters<typeof SqlWriteStrategy>[0],
      { set: vi.fn(), get: vi.fn().mockReturnValue(null) } as unknown as ITracker
    );

    await strategy.writePartnerTranslation({
      partner_id: 'p1',
      language_id: 'eng',
      context_id: 'c1',
      backward_compatibility: 'mwnf3_thematic_gallery:exhibition_partner_i18n:4:en',
      name: 'UN Alliance of Civilisations',
      contact_website: 'https://www.unaoc.org/',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.some((value) => value === undefined)).toBe(false);
  });
});
