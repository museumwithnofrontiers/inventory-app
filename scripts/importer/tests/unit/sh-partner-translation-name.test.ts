/**
 * A Sharing History partner name row without a name (ES_01_A, es, #2343) is
 * a legacy data error: the translation is skipped, as a museum translation
 * without a name is, and never given a name made up by the importer.
 */

import { describe, it, expect } from 'vitest';
import { transformShPartnerTranslation } from '../../src/domain/transformers/sh-partner-transformer.js';
import type { ShLegacyPartner } from '../../src/domain/types/sh-legacy.js';

const partner: ShLegacyPartner = {
  partners_id: 'ES_01_A',
  country: 'es',
  partner_category: 'museums',
  name: 'Museo Nacional de Antropología',
};

describe('SH partner translation name', () => {
  it('keeps the name the row has', () => {
    const { data } = transformShPartnerTranslation(
      partner,
      { partners_id: 'ES_01_A', lang: 'en', name: 'National Museum of Anthropology' },
      { source: 'mwnf3_sharing_history' }
    );

    expect(data.name).toBe('National Museum of Anthropology');
  });

  it.each([[''], ['   ']])('rejects a row whose name is %j', (name) => {
    expect(() =>
      transformShPartnerTranslation(
        partner,
        {
          partners_id: 'ES_01_A',
          lang: 'es',
          name,
          description: 'El Museo Nacional de Antropología…',
        },
        { source: 'mwnf3_sharing_history' }
      )
    ).toThrow('SH partner translation missing name: ES_01_A:es');
  });
});
