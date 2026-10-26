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

// Legacy prints each of these under a heading of its own, so each stays a
// field of its own: never two joined into one.
describe('Sharing History fields kept apart', () => {
  it('keeps an object’s descriptions, names and keywords apart', () => {
    const result = transformShObjectTranslation({
      project_id: 'AWE',
      country: 'mc',
      number: 26,
      lang: 'en',
      name: 'Reliquary',
      name2: 'Ornament with prophylactic intention',
      second_name: 'Other',
      third_name: 'Third',
      description: 'A reliquary.',
      description2: 'Throughout the 19th century in Macedonia…',
      keywords: 'Reliquary; talisman; metalwork',
    } as ShLegacyObjectText);

    expect(result?.data.description).toBe('A reliquary.');
    expect(result?.data.alternate_name).toBe('Ornament with prophylactic intention');
    expect(extraOf(result)).toMatchObject({
      description2: 'Throughout the 19th century in Macedonia…',
      second_name: 'Other',
      third_name: 'Third',
      keywords: 'Reliquary; talisman; metalwork',
    });
    expect(extraOf(result).gallery_sheet).toBeUndefined();
  });

  it('keeps a monument’s history out of its description', () => {
    const result = transformShMonumentTranslation({
      project_id: 'AWE',
      country: 'jo',
      number: 1,
      lang: 'en',
      name: 'Monument',
      description: 'Description',
      history: 'History',
    } as ShLegacyMonumentText);

    expect(result?.data.description).toBe('Description');
    expect(extraOf(result).history).toBe('History');
  });

  it('keeps the holder to the holding museum, never the institution’s own-language name', () => {
    const object = transformShObjectTranslation({
      project_id: 'AWE', country: 'pt', number: 70, lang: 'en', name: 'Banknote',
      holding_institution_org: 'Ministério das Finanças',
    } as ShLegacyObjectText);
    expect(object?.data.holder).toBeNull();
    expect(extraOf(object).holding_institution_org).toBe('Ministério das Finanças');

    const monument = transformShMonumentTranslation({
      project_id: 'AWE', country: 'tn', number: 1, lang: 'en', name: 'Palais du Bardo',
      responsible_institution_org: 'Institut national du Patrimoine',
    } as ShLegacyMonumentText);
    expect(monument?.data.holder).toBeNull();
    expect(extraOf(monument).responsible_institution_org).toBe('Institut national du Patrimoine');
  });

  it('keeps the credit columns as written', () => {
    const result = transformShObjectTranslation({
      project_id: 'AWE', country: 'dz', number: 8, lang: 'fr', name: 'Petit pot',
      preparedby: 'Cherid Houria', copyeditedby: '',
    } as ShLegacyObjectText);
    expect(extraOf(result).credits_as_written).toEqual({ author: 'Cherid Houria' });
  });
});
