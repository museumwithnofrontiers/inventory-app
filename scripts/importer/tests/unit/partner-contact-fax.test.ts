/**
 * The partner-level fax (#1959): legacy museums, institutions and Sharing
 * History partners all have a `fax` column next to `phone`. It lands in
 * partner_translations.contact_fax the way phone lands in contact_phone -
 * copied onto every language row - instead of being dropped at import.
 */

import { describe, it, expect } from 'vitest';
import { transformMuseumTranslation } from '../../src/domain/transformers/museum-transformer.js';
import { transformInstitutionTranslation } from '../../src/domain/transformers/institution-transformer.js';
import { transformShPartnerTranslation } from '../../src/domain/transformers/sh-partner-transformer.js';
import type { LegacyInstitution, LegacyMuseum } from '../../src/domain/types/legacy.js';
import type { ShLegacyPartner } from '../../src/domain/types/sh-legacy.js';

const museum = (overrides: Partial<LegacyMuseum> = {}): LegacyMuseum => ({
  museum_id: 'Mus01',
  country: 'es',
  name: 'Museo Arqueológico Nacional',
  project_id: 'ISL',
  ...overrides,
});

const institution = (overrides: Partial<LegacyInstitution> = {}): LegacyInstitution => ({
  institution_id: 'Ins01',
  country: 'es',
  name: 'Ministerio de Cultura',
  ...overrides,
});

const shPartner = (overrides: Partial<ShLegacyPartner> = {}): ShLegacyPartner => ({
  partners_id: 'SHP01',
  country: 'es',
  partner_category: 'museum',
  name: 'Museo de Almería',
  ...overrides,
});

describe('partner-level fax', () => {
  it('carries a museum fax into contact_fax, next to its phone', () => {
    const { data } = transformMuseumTranslation(museum({ phone: '+34 91 577 79 12', fax: '+34 91 431 68 40' }), {
      museum_id: 'Mus01',
      country: 'es',
      lang: 'en',
      name: 'National Archaeological Museum',
    });

    expect(data.contact_phone).toBe('+34 91 577 79 12');
    expect(data.contact_fax).toBe('+34 91 431 68 40');
  });

  it('carries an institution fax into contact_fax', () => {
    const { data } = transformInstitutionTranslation(institution({ fax: '+34 91 701 70 00' }), {
      institution_id: 'Ins01',
      country: 'es',
      lang: 'en',
      name: 'Ministry of Culture',
    });

    expect(data.contact_fax).toBe('+34 91 701 70 00');
  });

  it('carries a Sharing History partner fax into contact_fax', () => {
    const { data } = transformShPartnerTranslation(
      shPartner({ fax: '+34 950 17 55 10' }),
      { partners_id: 'SHP01', lang: 'en', name: 'Museum of Almería' },
      { source: 'mwnf3_sharing_history' }
    );

    expect(data.contact_fax).toBe('+34 950 17 55 10');
  });

  it('writes null, never undefined, when there is no fax', () => {
    const { data: museumData } = transformMuseumTranslation(museum(), {
      museum_id: 'Mus01',
      country: 'es',
      lang: 'en',
      name: 'National Archaeological Museum',
    });
    const { data: shData } = transformShPartnerTranslation(
      shPartner({ fax: '' }),
      { partners_id: 'SHP01', lang: 'en', name: 'Museum of Almería' },
      { source: 'mwnf3_sharing_history' }
    );

    expect(museumData.contact_fax).toBeNull();
    expect(shData.contact_fax).toBeNull();
  });
});
