/**
 * Legacy's Sharing History partner list printed `sh_partners.city`, one
 * value for every language ("Roma", "Lisboa"), not a translation's own city
 * ("Rome", "Lisbon"). The importer keeps it in the translation's extra, as
 * it keeps the row's other language-free fields.
 */

import { describe, it, expect } from 'vitest';
import { transformShPartner } from '../../src/domain/transformers/sh-partner-transformer.js';
import type { ShLegacyPartner } from '../../src/domain/types/sh-legacy.js';

const partner: ShLegacyPartner = {
  partners_id: 'it_02',
  country: 'it',
  partner_category: 'institutions',
  name: 'MIBACT | Borghese Gallery',
  city: 'Roma',
};

describe('SH partner base city', () => {
  it("keeps legacy's base city in extra", () => {
    expect(transformShPartner(partner).extra.city).toBe('Roma');
  });

  it.each([[null], [''], ['  ']])('leaves it out when the row has none (%j)', (city) => {
    expect(transformShPartner({ ...partner, city }).extra).not.toHaveProperty('city');
  });
});
