/**
 * Fields legacy prints on a sheet that have no column of their own, kept in
 * item_translations.extra (legacy parity story #2233, C10 and C16).
 */

import { describe, expect, it } from 'vitest';

import { transformObjectTranslation } from '../../src/domain/transformers/object-transformer.js';
import { transformShObjectTranslation } from '../../src/domain/transformers/sh-object-transformer.js';
import { transformShMonumentTranslation } from '../../src/domain/transformers/sh-monument-transformer.js';
import type { LegacyObject } from '../../src/domain/types/legacy.js';
import type { ShLegacyObjectText, ShLegacyMonumentText } from '../../src/domain/types/sh-legacy.js';

function extraOf(result: { data: { extra?: string | null } } | null): Record<string, unknown> {
  expect(result).not.toBeNull();
  return result!.data.extra ? (JSON.parse(result!.data.extra) as Record<string, unknown>) : {};
}

describe('artist life data (C10)', () => {
  it('keeps each language its own life data', () => {
    const base = { project_id: 'BAR', country: 'cz', museum_id: 'Mus11', number: '2', name: 'Painting' };
    const cs = extraOf(
      transformObjectTranslation({
        ...base,
        lang: 'cs',
        birthdate: '1630 Královec –  1706 Lubuš',
      } as LegacyObject)
    );
    const en = extraOf(
      transformObjectTranslation({
        ...base,
        lang: 'en',
        birthdate: '1630',
        birthplace: 'Königsberg',
        deathdate: '1706 ',
        deathplace: 'Lubiaz',
      } as LegacyObject)
    );

    expect(cs).toMatchObject({ artist_birthdate: '1630 Královec –  1706 Lubuš' });
    expect(cs).not.toHaveProperty('artist_birthplace');
    expect(en).toMatchObject({
      artist_birthdate: '1630',
      artist_birthplace: 'Königsberg',
      artist_deathdate: '1706',
      artist_deathplace: 'Lubiaz',
    });
  });
});

describe('Sharing History records as the galleries show them (C16)', () => {
  it('keeps an object’s descriptions, second name and keywords apart', () => {
    const result = transformShObjectTranslation({
      project_id: 'AWE',
      country: 'mc',
      number: 26,
      lang: 'en',
      name: 'Reliquary',
      name2: 'Ornament with prophylactic intention',
      second_name: 'Other',
      description2: 'Throughout the 19th century in Macedonia…',
      keywords: 'Reliquary; talisman; metalwork',
    } as ShLegacyObjectText);

    expect(result?.data.description).toBe('Throughout the 19th century in Macedonia…');
    expect(extraOf(result).gallery_sheet).toEqual({
      short_description: 'Throughout the 19th century in Macedonia…',
      also_known_as: 'Ornament with prophylactic intention',
      keywords: 'Reliquary; talisman; metalwork',
    });
  });

  it('keeps a monument’s history apart', () => {
    const result = transformShMonumentTranslation({
      project_id: 'AWE',
      country: 'jo',
      number: 1,
      lang: 'en',
      name: 'Monument',
      description: 'Description',
      history: 'History',
    } as ShLegacyMonumentText);

    expect(extraOf(result).gallery_sheet).toEqual({ description: 'Description', history: 'History' });
  });
});
