import { describe, expect, it } from 'vitest';

import { transformShObject } from '../../src/domain/transformers/sh-object-transformer.js';
import { transformShMonument } from '../../src/domain/transformers/sh-monument-transformer.js';
import { transformShMonumentDetail } from '../../src/domain/transformers/sh-monument-detail-transformer.js';

describe('SH item internal_name selection', () => {
  it('throws for SH objects when no translation has a usable name', () => {
    expect(() =>
      transformShObject(
        {
          project_id: 'SH1',
          country: 'eg',
          number: 1,
          partners_id: null,
          inventory_id: null,
          start_date: null,
          end_date: null,
          pd_country: null,
          translations: [
            { project_id: 'SH1', country: 'eg', number: 1, lang: 'en', name: null },
            { project_id: 'SH1', country: 'eg', number: 1, lang: 'fr', name: '   ' },
          ],
        },
        'eng'
      )
    ).toThrow(
      'SH Object mwnf3_sharing_history:sh_objects:sh1:eg:1 missing required name field in all translations'
    );
  });

  it('throws for SH monuments when no translation has a usable name', () => {
    expect(() =>
      transformShMonument(
        {
          project_id: 'SH1',
          country: 'eg',
          number: 1,
          partners_id: null,
          start_date: null,
          end_date: null,
          pd_country: null,
          translations: [
            { project_id: 'SH1', country: 'eg', number: 1, lang: 'en', name: null },
            { project_id: 'SH1', country: 'eg', number: 1, lang: 'fr', name: '   ' },
          ],
        },
        'eng'
      )
    ).toThrow(
      'SH Monument mwnf3_sharing_history:sh_monuments:sh1:eg:1 missing required name field in all translations'
    );
  });

  it('throws for SH monument details when no translation has a usable name', () => {
    expect(() =>
      transformShMonumentDetail(
        {
          project_id: 'SH1',
          country: 'eg',
          number: 1,
          detail_id: 2,
          translations: [
            {
              project_id: 'SH1',
              country: 'eg',
              number: 1,
              detail_id: 2,
              lang: 'en',
              name: '   ',
              description: '',
              location: '',
              date: '',
              artist: '',
            },
            {
              project_id: 'SH1',
              country: 'eg',
              number: 1,
              detail_id: 2,
              lang: 'fr',
              name: '   ',
              description: '',
              location: '',
              date: '',
              artist: '',
            },
          ],
        },
        'eng'
      )
    ).toThrow(
      'SH Monument Detail mwnf3_sharing_history:sh_monument_details:sh1:eg:1:2 missing required name field in all translations'
    );
  });

  it('orders an SH monument detail by its number', () => {
    const translation = {
      project_id: 'SH1',
      country: 'eg',
      number: 1,
      detail_id: 2,
      lang: 'en',
      name: 'Minaret',
      description: '',
      location: '',
      date: '',
      artist: '',
    };
    const result = transformShMonumentDetail(
      { project_id: 'SH1', country: 'eg', number: 1, detail_id: 2, translations: [translation] },
      'eng'
    );

    expect(result.data.display_order).toBe(2);
  });
});
