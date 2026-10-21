import { describe, expect, it } from 'vitest';

import { transformShObjectTranslation } from '../../src/domain/transformers/sh-object-transformer.js';
import { transformShMonumentTranslation } from '../../src/domain/transformers/sh-monument-transformer.js';

// Legacy Sharing History prints an institution's name in its own language as
// a line of its own, beside the English one: "Holding Institution (original
// language)" on an object, "Responsible Institution (original language)" on a
// monument. The import keeps both names (Pascal, 2026-10-21).
const extraOf = (result: { data: { extra: string | null } } | null) =>
  JSON.parse(result?.data.extra ?? '{}') as Record<string, unknown>;

describe('SH institution names in their own language', () => {
  it("keeps an object's holding institution in its own language beside the English holder", () => {
    const result = transformShObjectTranslation({
      project_id: 'AWE',
      country: 'es',
      number: 1,
      lang: 'en',
      name: 'Kaftan',
      holding_museum: 'National Museum of Anthropology',
      holding_institution_org: 'Museo Nacional de Antropología',
    } as never);
    expect(result?.data.holder).toBe('National Museum of Anthropology');
    expect(extraOf(result).holding_institution_org).toBe('Museo Nacional de Antropología');
  });

  it('keeps it when it is the only name legacy has', () => {
    const result = transformShObjectTranslation({
      project_id: 'AWE',
      country: 'pt',
      number: 70,
      lang: 'en',
      name: 'José Mouzinho da Silveira',
      holding_institution_org: 'Ministério das Finanças',
    } as never);
    expect(result?.data.holder).toBe('Ministério das Finanças');
    expect(extraOf(result).holding_institution_org).toBe('Ministério das Finanças');
  });

  it("keeps a monument's responsible institution in its own language", () => {
    const result = transformShMonumentTranslation({
      project_id: 'AWE',
      country: 'tn',
      number: 1,
      lang: 'en',
      name: 'Palais-Musée du Bardo',
      responsible_institution_org: 'Institut national du Patrimoine',
    } as never);
    expect(extraOf(result).responsible_institution_org).toBe('Institut national du Patrimoine');
  });
});
